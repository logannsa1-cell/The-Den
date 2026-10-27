import type { StudySet as ApiStudySet, TheoryQuestion } from '@workspace/api-client-react';

export type KeyTerm = { term: string; definition: string };
export type StudyQuestion = { prompt: string; choices: string[]; answerIndex: number; explanation: string };
export type StudyDay = { date: string; focus: string; tasks: string[] };
export type StudyMode = 'summary' | 'timed' | 'objective' | 'theory' | 'tutor' | 'cram';
export type { TheoryQuestion };
export type StudySet = Omit<ApiStudySet, 'masteredTerms'> & { masteredTerms?: string[] };

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

function normalizeStudyText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeStudyText(input: string): {
  text: string;
  removedOfficeMarkup: boolean;
} {
  const decoded = decodeXmlEntities(input);
  if (OFFICE_XML_SIGNAL.test(decoded)) {
    const readableParts = Array.from(decoded.matchAll(OFFICE_TEXT_NODE), (match) =>
      decodeXmlEntities(match[1].replace(/<[^>]*>/g, ' ')),
    ).filter((part) => part.trim().length > 0);
    return {
      text: normalizeStudyText(readableParts.join(' ')),
      removedOfficeMarkup: true,
    };
  }

  return {
    text: normalizeStudyText(decoded),
    removedOfficeMarkup: false,
  };
}

export async function readStudyFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md" || extension === "csv") {
    return file.text();
  }
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return pages.join("\n");
  }
  if (extension === "pptx") {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const number = (name: string) => Number(name.match(/slide(\d+)/)?.[1] ?? 0);
        return number(a) - number(b);
      });
    const slides = await Promise.all(
      slideFiles.map(async (name) => {
        const xml = await zip.file(name)?.async("text");
        if (!xml) return "";
        const text = Array.from(xml.matchAll(OFFICE_TEXT_NODE), (match) =>
          decodeXmlEntities(match[1].replace(/<[^>]*>/g, ' ')),
        ).join(' ');
        return text ? `Slide ${name.match(/slide(\d+)/)?.[1]}: ${text}` : '';
      }),
    );
    return slides.join("\n");
  }
  throw new Error("That file type is not supported. Choose PDF, DOCX, PPTX, TXT, MD, or CSV.");
}
