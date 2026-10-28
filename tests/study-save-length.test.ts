import assert from "node:assert/strict";
import test from "node:test";
import { UpsertStudySetBody, UpsertStudySetResponse, ListStudySetsResponse } from "../lib/api-zod/src/index";
import { toInput as webInput } from "../artifacts/jaguar-study/src/lib/study-input";
import { toInput as mobileInput } from "../artifacts/jaguar-mobile/lib/study";

test("long notes survive web/mobile serialization and save/list response round trips", () => {
  const set = {
    id: "long-notes-test", createdAt: new Date().toISOString(),
    title: "Long notes", sourceName: "test.txt", sourceText: "source ".repeat(30),
    summary: "Reference note with formulas α². ".repeat(5000) + "SUMMARY END",
    tutorLesson: "Detailed teaching explanation. ".repeat(4000) + "LESSON END",
    keyTerms: [], cramPoints: ["Keep this concise."], questions: [],
    studyPlan: [], masteredTerms: [],
  };
  for (const input of [webInput(set), mobileInput(set)]) {
    assert.equal(input.summary, set.summary);
    assert.equal(input.tutorLesson, set.tutorLesson);
    const stored = JSON.parse(JSON.stringify(UpsertStudySetBody.parse(input)));
    const saved = UpsertStudySetResponse.parse({ ...stored, id: set.id, createdAt: set.createdAt });
    const [reopened] = ListStudySetsResponse.parse(JSON.parse(JSON.stringify([saved])));
    assert.equal(reopened.summary, set.summary);
    assert.equal(reopened.tutorLesson, set.tutorLesson);
  }
});

test("remaining save ceilings reject rather than shorten the content", () => {
  const input = { title: "Notes", sourceName: "test.txt", sourceText: "s".repeat(120), summary: "x".repeat(240001), keyTerms: [], cramPoints: [], questions: [], studyPlan: [], masteredTerms: [] };
  assert.equal(UpsertStudySetBody.safeParse(input).success, false);
  assert.equal(input.summary.length, 240001);
  assert.equal(UpsertStudySetBody.safeParse({ ...input, summary: "x".repeat(240000), tutorLesson: "x".repeat(240000) }).success, true);
});
