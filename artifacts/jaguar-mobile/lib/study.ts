import type { StudySet as ApiStudySet, StudySetInput, TheoryQuestion, StudyQuestion, StudyTerm } from '@workspace/api-client-react';

export type StudyMode = 'summary' | 'timed' | 'objective' | 'theory' | 'tutor' | 'cram';
export type StudySet = Omit<ApiStudySet, 'masteredTerms'> & { masteredTerms?: string[] };
export type { TheoryQuestion, StudyQuestion, StudyTerm };

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_SOURCE_CHARS = 180000;
export const MIN_SOURCE_CHARS = 120;
export const EXTS = ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'];

export const MODE_INFO: { id: StudyMode; label: string; short: string; icon: string; blurb: string }[] = [
  { id: 'timed', label: 'Time based exam', short: 'Exam', icon: 'clock', blurb: 'Objective + theory, one clock' },
  { id: 'tutor', label: 'Tutor Lesson', short: 'Tutor', icon: 'award', blurb: 'Taught step by step' },
  { id: 'summary', label: 'Note Summary', short: 'Notes', icon: 'book-open', blurb: 'Long, very detailed notes' },
  { id: 'objective', label: 'Objective', short: 'Objective', icon: 'list', blurb: 'A to E with explanations' },
  { id: 'cram', label: 'Cram Sheet', short: 'Cram', icon: 'zap', blurb: 'Short, last-minute points' },
  { id: 'theory', label: 'Theory', short: 'Theory', icon: 'edit-3', blurb: 'Written a, b, c answers' },
];
export const ALL_MODES = MODE_INFO.map((m) => m.id);
export const modeLabel = (id: string) => MODE_INFO.find((m) => m.id === id)?.label ?? id;

export function setModes(set: StudySet): StudyMode[] {
  return set.modes?.length ? (set.modes as StudyMode[]) : ['summary', 'objective'];
}

const OFFICE_XML_SIGNAL =
  /<\/?p:(?:sp|spPr|spTree|graphicFrame|pic)\b|<\/?a:(?:ln|effectLst|outerShdw|schemeClr|solidFill|latin|sym|prstGeom|blipFill|t)\b|<\/?w:(?:document|body|p|r|t)\b|panose=|spcFirstLastPara=|extrusionOk=/i;
const OFFICE_TEXT_NODE = /<(?:a|w):t\b[^>]*>([\s\S]*?)<\/(?:a|w):t>/gi;

function decodeXmlEntities(value: string): string {
  let decoded = value;
  const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi, (entity) => {
      const n = entity.toLowerCase();
      if (named[n]) return named[n];
      const cp = n.startsWith('&#x') ? Number.parseInt(n.slice(3, -1), 16) : Number.parseInt(n.slice(2, -1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ' ';
    });
  }
  return decoded;
}

function normalize(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Same sanitiser as the website: never show raw Office XML as study text. */
export function clean(value: string): string {
  const decoded = decodeXmlEntities(value ?? '');
  if (OFFICE_XML_SIGNAL.test(decoded)) {
    const parts = Array.from(decoded.matchAll(OFFICE_TEXT_NODE), (m) => decodeXmlEntities(m[1].replace(/<[^>]*>/g, ' '))).filter((p) => p.trim());
    const text = normalize(parts.join(' '));
    return text || 'Unreadable document formatting was removed.';
  }
  return normalize(decoded) || value;
}

export function toInput(set: StudySet): StudySetInput {
  return {
    title: set.title.slice(0, 160) || 'Study set',
    sourceName: set.sourceName.slice(0, 160) || 'Notes',
    sourceText: set.sourceText,
    summary: set.summary.slice(0, 60000),
    keyTerms: set.keyTerms,
    cramPoints: set.cramPoints,
    questions: set.questions,
    studyPlan: set.studyPlan,
    masteredTerms: set.masteredTerms ?? [],
    ...(set.theoryQuestions ? { theoryQuestions: set.theoryQuestions } : {}),
    ...(set.modes ? { modes: set.modes } : {}),
    ...(set.examMinutes ? { examMinutes: set.examMinutes } : {}),
    ...(set.tutorLesson ? { tutorLesson: set.tutorLesson.slice(0, 60000) } : {}),
  };
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function sizeLabel(bytes: number) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function intIn(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

export function errorMessage(cause: unknown): { text: string; offline: boolean } {
  const msg = cause instanceof Error ? cause.message : String(cause ?? '');
  const status = (cause as { status?: number } | null)?.status;
  const data = (cause as { data?: { error?: string } } | null)?.data;
  if (!status && /network request failed|failed to fetch|network error|timed? ?out|aborted|load failed/i.test(msg)) {
    return { text: 'No connection reached Jaguar. Check your internet and retry. Your files are kept.', offline: true };
  }
  if (status === 429) return { text: 'Too many generation requests. Wait a moment before retrying. Your files are kept.', offline: false };
  if (status === 401) return { text: 'Your session expired. Sign in again, then retry.', offline: false };
  if (status === 413) return { text: 'That file is too large for extraction. Each file must be 15 MB or less.', offline: false };
  const detail = typeof data?.error === 'string' ? data.error : msg.replace(/^HTTP \d{3}[^:]*:\s*/, '');
  return { text: `${status ? 'The study service reported a problem. ' : ''}${detail || 'Try again. Your files are kept.'}`, offline: false };
}

export const L = (i: number) => String.fromCharCode(65 + i);
