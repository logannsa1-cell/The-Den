import assert from "node:assert/strict";
import test from "node:test";
import { generateStudyContent } from "./gemini-study";

test("summary targets 7,000 words and tutor lesson 5,000 for substantial sources", async () => {
  const originalFetch = globalThis.fetch;
  const configs: { systemInstruction: { parts: { text: string }[] }; generationConfig: { maxOutputTokens: number; responseJsonSchema?: unknown } }[] = [];
  const draft = {
    summary: `## Biology\n${"word ".repeat(4600)}`,
    tutorLesson: `## Biology\n${"word ".repeat(3300)}`,
    cramPoints: ["Keep this concise."],
  };
  try {
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      configs.push(request);
      return Response.json({ candidates: [{
        finishReason: "STOP",
         content: { parts: [{ text: configs.length === 1 ? JSON.stringify(draft) : `## Biology\n${"Expanded ".repeat(configs.length === 2 ? 5100 : 7100)}` }] },
      }] });
    };
    const result = await generateStudyContent({
      model: "test", modes: ["summary", "tutor", "cram"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: JSON.stringify({ sourceText: "source ".repeat(5000) }) }],
    });
    assert.equal(configs.length, 3, "drafts above the old thresholds still require expansion");
    assert.equal(configs[0].generationConfig.maxOutputTokens, 64000);
    const schema = JSON.stringify(configs[0].generationConfig.responseJsonSchema);
    assert.match(schema, /about 7000 words/);
    assert.match(schema, /about 5000 words/);
    assert.match(schema, /at most 360 words/);
    assert.match(schema, /Return 16 to 24 items/);
    assert.match(configs[1].systemInstruction.parts[0].text, /about 5000 words in this section/);
    assert.match(configs[2].systemInstruction.parts[0].text, /about 7000 words in this section/);
    assert.match(configs[1].systemInstruction.parts[0].text, /5000 words/);
    assert.match(configs[2].systemInstruction.parts[0].text, /7000 words/);
    assert.equal(configs[1].generationConfig.maxOutputTokens, 24000);
    const material = JSON.parse(result.choices[0].message.content!);
    assert.ok(material.tutorLesson.split(/\s+/).filter(Boolean).length >= 5000);
    assert.ok(material.summary.split(/\s+/).filter(Boolean).length >= 7000);
    assert.deepEqual(material.cramPoints, draft.cramPoints);
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

test("short sources are not expanded just to meet a length target", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const draft = { summary: "Short reference.", tutorLesson: "Short lesson.", cramPoints: ["Recall cue."] };
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(draft) }] } }] });
    };
    const result = await generateStudyContent({
      model: "test", modes: ["summary", "tutor", "cram"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: JSON.stringify({ sourceText: "source ".repeat(100) }) }],
    });
    assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(result.choices[0].message.content!), draft);
  } finally { globalThis.fetch = originalFetch; }
});

test("failed detail expansion retains all drafts and questions with a visible notice", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const draft = { summary: "## Chemistry — Week 10\nOriginal notes.", tutorLesson: "## Biology — Week 1\nOriginal lesson.", questions: [{ prompt: "Keep me" }], cramPoints: ["Recall cue."] };
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls > 1) return new Response(null, { status: 429 });
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(draft) }] } }] });
    };
    const result = await generateStudyContent({
      model: "test", modes: ["summary", "tutor", "cram"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: JSON.stringify({ sourceText: "source ".repeat(5000) }) }],
    });
    const material = JSON.parse(result.choices[0].message.content!);
    assert.ok(calls <= 3, "at most two in-flight expansions, then stop on quota failure");
    assert.ok(material.summary.startsWith(draft.summary));
    assert.ok(material.tutorLesson.startsWith(draft.tutorLesson));
    assert.match(material.summary, /Detail expansion unavailable/);
    assert.match(material.tutorLesson, /Detail expansion unavailable/);
    assert.match(material.summary, /The 7,000-word target was not met/);
    assert.match(material.tutorLesson, /The 5,000-word target was not met/);
    assert.deepEqual(material.questions, draft.questions);
    assert.deepEqual(material.cramPoints, draft.cramPoints);
  } finally { globalThis.fetch = originalFetch; }
});

test("both reading modes share the expansion budget without reordering subjects", async () => {
  const originalFetch = globalThis.fetch;
  const order: string[] = [];
  let active = 0;
  let peak = 0;
  const draft = { summary: "## Biology\nSummary one.\n## Chemistry\nSummary two.", tutorLesson: "## Biology\nLesson one.\n## Chemistry\nLesson two." };
  try {
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      let text = JSON.stringify(draft);
      if (request.generationConfig.responseMimeType === "text/plain") {
        const section = JSON.parse(request.contents[0].parts[0].text).sectionToDevelop as string;
        order.push(section.includes("Lesson") ? "tutor" : "summary");
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        text = `${section.split("\n")[0]}\n${"Developed explanation ".repeat(50)}`;
      }
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] });
    };
    const result = await generateStudyContent({
      model: "test", modes: ["summary", "tutor"], questionCount: 5,
      messages: [{ role: "system", content: "Test" }, { role: "user", content: JSON.stringify({ sourceText: "source ".repeat(5000) }) }],
    });
    assert.deepEqual(order, ["tutor", "summary", "tutor", "summary"]);
    assert.equal(peak, 2);
    const material = JSON.parse(result.choices[0].message.content!);
    for (const field of ["summary", "tutorLesson"]) assert.ok(material[field].indexOf("## Biology") < material[field].indexOf("## Chemistry"));
  } finally { globalThis.fetch = originalFetch; }
});
