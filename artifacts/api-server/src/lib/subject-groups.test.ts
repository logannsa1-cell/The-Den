import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSubjectQuestions } from "./subject-groups";

test("subjects stay contiguous without changing question objects", () => {
  const questions = ["[Biology] One", "[Chemistry] Two", "[Biology] Three", "[Physics] Four"].map((prompt, id) => ({ prompt, id }));
  assert.deepEqual(groupSubjectQuestions(questions).map(q => q.id), [0, 2, 1, 3]);
  assert.deepEqual(questions.map(q => q.id), [0, 1, 2, 3]);
  assert.strictEqual(groupSubjectQuestions([{ prompt: "Old question" }])[0].prompt, "Old question");
});

test("grouping separately preserves the two/five theory part boundaries", () => {
  const questions = ["[Biology] A1", "[Physics] A2", "[Chemistry] B1", "[Biology] B2", "[Chemistry] B3", "[Physics] B4", "[Biology] B5"].map((prompt, id) => ({ prompt, id }));
  const grouped = [...groupSubjectQuestions(questions.slice(0, 2)), ...groupSubjectQuestions(questions.slice(2))];
  assert.deepEqual(grouped.slice(0, 2).map(q => q.id), [0, 1]);
  assert.deepEqual(grouped.slice(2).map(q => q.id), [2, 4, 3, 6, 5]);
});
