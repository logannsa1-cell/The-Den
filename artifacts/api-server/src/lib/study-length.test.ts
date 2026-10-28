import assert from "node:assert/strict";
import test from "node:test";
import { generateStudyContent } from "./gemini-study";

test("long-form modes use doubled targets and depth thresholds without changing cram", async () => {
  const originalFetch = globalThis.fetch;
  const configs: { systemInstruction: { parts: { text: string }[] }; generationConfig: { maxOutputTokens: number; responseJsonSchema?: unknown } }[] = [];
  const draft = {
    summary: `## Biology\n${"word ".repeat(2300)}`,
    tutorLesson: `## Biology\n${"word ".repeat(1700)}`,
    cramPoints: ["Keep this concise."],
  };
  try {
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      configs.push(request);
      return Response.json({ candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: configs.length === 1 ? JSON.stringify(draft) : "## Biology\nExpanded source-grounded explanation." }] },
      }] });
    };
    const result = await generateStudyContent({
      model: "test", modes: ["summary", "tutor", "cram"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: JSON.stringify({ sourceText: "source ".repeat(5000) }) }],
    });
    assert.equal(configs.length, 3, "drafts above the old thresholds still require expansion");
    assert.equal(configs[0].generationConfig.maxOutputTokens, 48000);
    const schema = JSON.stringify(configs[0].generationConfig.responseJsonSchema);
    assert.match(schema, /5600–9000/);
    assert.match(schema, /3600–6400/);
    assert.match(schema, /at most 180 words/);
    assert.match(configs[1].systemInstruction.parts[0].text, /900–1400/);
    assert.match(configs[2].systemInstruction.parts[0].text, /1400–2000/);
    assert.equal(configs[1].generationConfig.maxOutputTokens, 12000);
    assert.deepEqual(JSON.parse(result.choices[0].message.content!).cramPoints, draft.cramPoints);
    configs.length = 0;
    await generateStudyContent({
      model: "test", modes: ["cram"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: "{}" }],
    });
    assert.equal(configs.length, 1);
    assert.equal(configs[0].generationConfig.maxOutputTokens, 24000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
