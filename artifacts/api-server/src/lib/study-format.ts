/** Constrain provider output before applying the existing runtime validation. */
export function studyFormat(modes: string[], questionCount: number) {
  const text = { type: "string" };
  const object = (properties: Record<string, unknown>) => ({
    type: "object", properties, required: Object.keys(properties),
  });
  const array = (items: unknown, minItems: number, maxItems = minItems) => ({
    type: "array", items,
    description: minItems === maxItems ? `Return exactly ${minItems} items.` : `Return ${minItems} to ${maxItems} items.`,
  });
  const count = modes.includes("objective") || modes.includes("timed") ? questionCount : 0;
  const theoryCount = modes.includes("timed") ? 7 : modes.includes("theory") ? 5 : 0;
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "study_materials",
      schema: object({
        title: text,
        summary: { ...text, description: "Long, very detailed reference notes: target 2800–4500 words for substantial multi-topic files, proportionately shorter for short sources. Separate ## Subject — Week N: Topic heading for EVERY supplied subject/week pair, in subject order then numeric week order. Never collapse weeks into one subject overview. Without weeks, use ## Subject — Topic. Explain every source topic, mechanisms, comparisons and examples; longer than tutorLesson. Empty when not selected." },
        tutorLesson: { ...text, description: "Substantial guided teaching: target 1800–3200 words for substantial multi-topic files, proportionately shorter for short sources. Separate ## Subject — Week N: Topic heading for EVERY supplied subject/week pair, in subject order then numeric week order. Never collapse weeks into one subject overview. Without weeks, use ## Subject — Topic. Explain what, why and how, examples, checks and answers. Shorter than summary, not a duplicate. Empty when not selected." },
        keyTerms: array(object({ term: text, definition: text }), 8, 16),
        cramPoints: array({ ...text, description: "One concise last-minute recall cue, usually 8–18 words. Entire cram sheet at most 180 words." }, modes.includes("cram") ? 8 : 0, modes.includes("cram") ? 12 : 0),
        questions: array(object({
          prompt: { ...text, description: "For multi-subject sources begin with [Subject] using an actual source subject. Group by subject. Never use Integrated, General, Mixed or a combined-subject label." }, choices: array(text, 5),
          answerIndex: { type: "integer", description: "Index of the correct choice, from 0 through 4." }, explanation: text,
        }), count),
        theoryQuestions: array(object({
          prompt: { ...text, description: "For multi-subject sources begin with [Subject] using ONE actual source subject. All three parts must belong to that subject. Never use Integrated, General, Mixed, Scientific Foundations or a combined-subject label. Multiple questions per subject are allowed; do not invent cross-subject questions to reach the required count. Group by subject within each exam part." },
          parts: array(object({
            label: { type: "string", enum: ["a", "b", "c"] },
            question: text, modelAnswer: text,
          }), 3),
        }), theoryCount),
        studyPlan: array(object({ date: text, focus: text, tasks: array(text, 1, 10) }), 0, 14),
      }),
    },
  };
}
