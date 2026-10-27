import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStudyContent, GeminiError } from "./gemini-study";

test("provider retry budget recovers capacity failures without retrying quotas or credentials", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  const options = { model: "test", modes: [], questionCount: 1, messages: [{ role: "system", content: "test" }, { role: "user", content: "{}" }] };
  try {
    for (const status of [429, 401]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; clock += 20000; return new Response("", { status }); };
      await assert.rejects(generateStudyContent(options), (e: unknown) => e instanceof GeminiError && e.status === status);
      assert.equal(calls, 1);
    }
    let slowCalls = 0;
    globalThis.fetch = async () => {
      slowCalls++;
      clock += 20000;
      return slowCalls === 1 ? new Response("", { status: 503 }) : Response.json({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }],
      });
    };
    assert.equal((await generateStudyContent(options)).choices[0].finish_reason, "stop");
    assert.equal(slowCalls, 2);
    slowCalls = 0;
    globalThis.fetch = async () => { slowCalls++; clock += 20000; return new Response("", { status: 503 }); };
    await assert.rejects(generateStudyContent(options), (e: unknown) => e instanceof GeminiError && e.status === 503);
    assert.equal(slowCalls, 2, "repeated slow capacity failures stop after one recovery attempt");
    slowCalls = 0;
    globalThis.fetch = async () => { slowCalls++; clock += 61000; return new Response("", { status: 503 }); };
    await assert.rejects(generateStudyContent(options), (e: unknown) => e instanceof GeminiError && e.status === 503);
    assert.equal(slowCalls, 1, "very slow failures must not repeat");
    let calls = 0;
    const events: unknown[] = [];
    globalThis.fetch = async () => {
      calls++;
      clock += calls === 1 ? 100 : 34000;
      return calls === 1 ? new Response("", { status: 503 }) : Response.json({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }],
      });
    };
    const result = await generateStudyContent({ ...options, onAttempt: (event) => events.push(event) });
    assert.equal(calls, 2);
    assert.equal(result.choices[0].finish_reason, "stop");
    assert.equal(events.length, 2);
    assert.deepEqual(events[0], { model: "test", attempt: 1, durationMs: 100, status: 503, retry: true });
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return Response.json({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
          summary: "## Cells\nCells are the basic units of life.",
          questions: [{ question: "What is the basic unit of life?" }],
        }) }] } }],
      });
      clock += 61000;
      return new Response("", { status: 503 });
    };
    const recovered = await generateStudyContent({ ...options, modes: ["summary", "timed"],
      messages: [options.messages[0], { role: "user", content: JSON.stringify({ sourceText: "Cells form tissues. ".repeat(120) }) }],
    });
    const recoveredMaterial = JSON.parse(recovered.choices[0].message.content || "{}");
    assert.equal(recoveredMaterial.questions.length, 1, "completed exam must survive failed expansion");
    assert.match(recoveredMaterial.summary, /Cells are the basic units of life/);
    assert.match(recoveredMaterial.summary, /Detail expansion unavailable/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
