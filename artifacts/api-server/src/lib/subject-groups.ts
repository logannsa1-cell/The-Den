/** Keep subjects together without changing question counts or exam part boundaries. */
export function groupSubjectQuestions<T extends { prompt: string }>(questions: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const question of questions) {
    const subject = question.prompt.match(/^\[([^\]\n]{1,80})\]/)?.[1].trim().toLowerCase();
    // Old and single-subject sets have no labels; preserve their original order.
    if (!subject) return questions;
    const group = groups.get(subject) ?? [];
    group.push(question);
    groups.set(subject, group);
  }
  return [...groups.values()].flat();
}
