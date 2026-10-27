import { StudyText } from './StudyText';

/** Subject labels live in prompt text so saved sets and exports retain them. */
export function SubjectPrompt({ text }: { text: string }) {
  const match = text.match(/^\[([^\]\n]{1,80})\]\s*([\s\S]*)$/);
  if (!match) return <StudyText text={text} />;
  return <span className="subject-prompt"><span className="subject-label">{match[1]}</span><StudyText text={match[2]} /></span>;
}
