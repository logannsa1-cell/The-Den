// Opt-in provider check. Uses the app's runtime key without logging credentials
// or source content. Bundle with esbuild and pass a UTF-8 source file as argv[2].
import { readFile } from "node:fs/promises";
import { generateStudyContent, GeminiError } from "../artifacts/api-server/src/lib/gemini-study";
import { GenerateStudyMaterialsResponse } from "../lib/api-zod/src/index";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("Generation key unavailable");
  const sourceText = await readFile(process.argv[2], "utf8");
  const route = await readFile("artifacts/api-server/src/routes/study.ts", "utf8");
  const prompt = route.match(/`(You are Jaguar,[\s\S]*?Return JSON only\.)`/)?.[1];
  if (!prompt) throw new Error("Cannot locate current generation instructions");
  const start = Date.now();
  const result = await generateStudyContent({
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    modes: ["summary", "tutor", "cram"], questionCount: 5,
    messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({
      sourceName: "Reference lesson", sourceText, modes: ["summary", "tutor", "cram"], questionCount: 5,
    }) }],
    onAttempt: (event) => console.log(JSON.stringify(event)),
  });
  const raw = JSON.parse(result.choices[0].message.content || "{}");
  const parsed = GenerateStudyMaterialsResponse.safeParse(raw);
  console.log(JSON.stringify({
    finishReason: result.choices[0].finish_reason, valid: parsed.success,
    durationMs: Date.now() - start, sourceWords: words(sourceText),
    summaryWords: words(raw.summary || ""), tutorWords: words(raw.tutorLesson || ""),
    cramWords: words((raw.cramPoints || []).join(" ")),
    depthNotices: [raw.summary, raw.tutorLesson].filter((s) => s?.includes("Detail expansion unavailable")).length,
  }));
  if (!parsed.success || result.choices[0].finish_reason !== "stop") process.exitCode = 1;
}
main().catch((error) => {
  console.log(JSON.stringify({ error: error instanceof Error ? error.name : "Unknown", status: error instanceof GeminiError ? error.status : undefined }));
  process.exitCode = 1;
});
