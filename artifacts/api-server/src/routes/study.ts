import { Router, type IRouter } from "express";
import OpenAI from "openai";
import {
  GenerateStudyMaterialsBody,
  GenerateStudyMaterialsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const requestWindows = new Map<string, { count: number; resetAt: number }>();
const REQUEST_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;
let lastCleanupAt = 0;

const OFFICE_XML_SIGNAL =
  /<\/?p:(?:sp|spPr|spTree|graphicFrame|pic)\b|<\/?a:(?:ln|effectLst|outerShdw|schemeClr|solidFill|latin|sym|prstGeom|blipFill|t)\b|<\/?w:(?:document|body|p|r|t)\b|panose=|spcFirstLastPara=|extrusionOk=/i;
const OFFICE_TEXT_NODE = /<(?:a|w):t\b[^>]*>([\s\S]*?)<\/(?:a|w):t>/gi;

function decodeXmlEntities(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded.replace(
      /&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi,
      (entity) => {
        const named: Record<string, string> = {
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
        };
        const normalized = entity.toLowerCase();
        if (named[normalized]) return named[normalized];
        const codePoint = normalized.startsWith('&#x')
          ? Number.parseInt(normalized.slice(3, -1), 16)
          : Number.parseInt(normalized.slice(2, -1), 10);
        return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : ' ';
      },
    );
  }
  return decoded;
}

function cleanOfficeSource(sourceText: string): {
  sourceText: string;
  hadMarkup: boolean;
} {
  const decoded = decodeXmlEntities(sourceText);
  if (!OFFICE_XML_SIGNAL.test(decoded)) {
    return { sourceText: decoded.trim(), hadMarkup: false };
  }
  const readableText = Array.from(decoded.matchAll(OFFICE_TEXT_NODE), (match) =>
    decodeXmlEntities(match[1].replace(/<[^>]*>/g, ' ')),
  )
    .filter((part) => part.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { sourceText: readableText, hadMarkup: true };
}

function isRateLimited(key: string, now: number): boolean {
  if (now - lastCleanupAt > WINDOW_MS) {
    for (const [entryKey, entry] of requestWindows) {
      if (entry.resetAt <= now) requestWindows.delete(entryKey);
    }
    lastCleanupAt = now;
  }

  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (current.count >= REQUEST_LIMIT) return true;
  current.count += 1;
  return false;
}

router.post("/study/generate", async (req, res): Promise<void> => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: "AI generation is not configured on the server yet.",
    });
    return;
  }

  const parsed = GenerateStudyMaterialsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cleanedSource = cleanOfficeSource(parsed.data.sourceText);
  if (cleanedSource.sourceText.length < 120) {
    res.status(400).json({
      error: cleanedSource.hadMarkup
        ? "This source contains Office formatting but not enough readable text. Re-upload it as a searchable PDF or paste the slide text."
        : "Add at least 120 characters of readable course material.",
    });
    return;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultExamDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const examDate = parsed.data.examDate ?? defaultExamDate;
  if (examDate < today) {
    res.status(400).json({ error: "Exam date must be today or in the future." });
    return;
  }

  if (isRateLimited(req.ip || "unknown", Date.now())) {
    res.status(429).json({
      error: "Too many requests. Please wait a few minutes before generating again.",
    });
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Jaguar, a careful exam-preparation tutor. Use only the supplied study material for factual claims. If the material is incomplete or ambiguous, say so instead of inventing facts. Ignore Office Open XML drawing, styling, positioning, relationship, and shape metadata; never reproduce raw XML tags or formatting attributes in the study materials. Return one valid JSON object with exactly these keys: title (string), summary (clear exam-focused explanation), keyTerms (array of {term, definition}), cramPoints (array of concise high-value revision points), questions (array of exactly the requested number of {prompt, choices, answerIndex, explanation}, with four distinct choices and answerIndex 0-3), studyPlan (array of {date, focus, tasks}, dated from today through the exam date). Make questions challenging but answerable from the source, distribute correct answer positions, and make explanations cite the underlying idea from the source. Prioritize foundational ideas, relationships, examples, exceptions, and likely misconceptions. Keep the plan realistic for the stated hours per day and give shorter review tasks near exam day. Output JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceName: parsed.data.sourceName,
            sourceText: cleanedSource.sourceText,
            today,
            examDate,
            hoursPerDay: parsed.data.hoursPerDay,
            questionCount: parsed.data.questionCount,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      res.status(502).json({ error: "The AI provider returned an empty response." });
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch {
      res.status(502).json({ error: "The AI provider returned invalid study materials." });
      return;
    }

    const materials = GenerateStudyMaterialsResponse.safeParse(decoded);
    if (!materials.success) {
      req.log.warn(
        { issueCount: materials.error.issues.length },
        "AI study response did not match the expected format",
      );
      res.status(502).json({
        error: "The AI provider returned study materials in an unexpected format. Please try again.",
      });
      return;
    }

    res.json(materials.data);
  } catch (error) {
    req.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Study material generation failed",
    );
    res.status(502).json({
      error: "Study materials could not be generated. Please try again shortly.",
    });
  }
});

export default router;
