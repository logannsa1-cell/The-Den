import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStudyContent, GeminiError } from "./gemini-study";

test("provider retry budget preserves successful slow responses and stops slow failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  const options = { model: "test", modes: [], questionCount: 1, messages: [{ role: "system", content: "test" }, { role: "user", content: "{}" }] };
  try {
    for (const status of [503, 429, 401]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; clock += 20000; return new Response("", { status }); };
      await assert.rejects(generateStudyContent(options), (e: unknown) => e instanceof GeminiError && e.status === status);
      assert.equal(calls, 1);
    }
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
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
