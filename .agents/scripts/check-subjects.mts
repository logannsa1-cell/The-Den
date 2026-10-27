import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateStudyContent } from "../../artifacts/api-server/src/lib/gemini-study";
const route = readFileSync("artifacts/api-server/src/routes/study.ts", "utf8");
const prompt = route.match(/`You are Jaguar,[\s\S]*?Return JSON only\.`/)![0].slice(1, -1);
const sourceText = `=== Source 1: Biology.txt ===
Biology Week 1: Cells are the basic units of life. A nucleus contains genetic material. Week 2: Diffusion is net movement from high to low concentration. Week 10: Photosynthesis uses light, carbon dioxide and water to make glucose and oxygen.
=== Source 2: Chemistry.txt ===
Chemistry Week 1: Atoms contain protons, neutrons and electrons. Week 2: Elements contain one type of atom. Compounds contain chemically bonded elements. Week 10: Acids react with bases to make salt and water.
=== Source 3: Physics.txt ===
Physics Week 1: Speed is distance divided by time. Week 2: Forces can change motion. Week 10: Energy is conserved; it transfers between stores.`;
const modes = ["summary", "tutor", "cram", "timed", "theory", "objective"];
const result = await generateStudyContent({
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite", modes, questionCount: 6,
  messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({ sourceText, modes, questionCount: 6 }) }],
});
assert.equal(result.choices[0].finish_reason, "stop");
const value = JSON.parse(result.choices[0].message.content || "{}");
for (const field of ["summary", "tutorLesson"]) {
  for (const subject of ["Biology", "Chemistry", "Physics"]) {
    for (const week of [1, 2, 10]) assert.match(value[field], new RegExp(`## ${subject}[^\\n]*Week ${week}\\b`, "i"));
  }
  assert.ok(value[field].indexOf("Biology") < value[field].indexOf("Chemistry"));
  assert.ok(value[field].indexOf("Chemistry") < value[field].indexOf("Physics"));
}
assert.equal(value.questions.length, 6);
assert.equal(value.theoryQuestions.length, 7);
for (const questions of [value.questions, value.theoryQuestions]) {
  for (const q of questions) assert.match(q.prompt, /^\[(Biology|Chemistry|Physics)\]/);
  for (const subject of ["Biology", "Chemistry", "Physics"]) assert.ok(questions.some((q: {prompt: string}) => q.prompt.startsWith(`[${subject}]`)));
}
for (const q of value.questions) assert.equal(q.choices.length, 5);
for (const q of value.theoryQuestions) assert.equal(q.parts.map((p: {label: string}) => p.label).join(""), "abc");
console.log("Live multi-file generation passed: three subjects, Weeks 1/2/10, six A–E questions, seven theory questions with a/b/c.");
