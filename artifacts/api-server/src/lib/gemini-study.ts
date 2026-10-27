import { studyFormat } from "./study-format";

export class GeminiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "GeminiError"; }
}

export async function generateStudyContent(options: {
  model: string; modes: string[]; questionCount: number;
  messages: { role: string; content: string }[];
}) {
  // Retry only explicit transient failures, not credentials, quotas or malformed
  // requests. One shared deadline bounds the entire operation.
  const signal = AbortSignal.timeout(180_000);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
  response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.messages[0].content }] },
      contents: [{ role: "user", parts: [{ text: options.messages[1].content }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: studyFormat(options.modes, options.questionCount).json_schema.schema,
        maxOutputTokens: 24000,
      },
    }),
  });
  if (![500, 502, 503, 504].includes(response.status) || attempt === 2) break;
  await response.body?.cancel();
  await new Promise<void>((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
  signal.throwIfAborted();
  }
  if (!response) throw new GeminiError(503, "Generation service unavailable");
  if (!response.ok) throw new GeminiError(response.status, "Generation service request failed");
  const body = await response.json() as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const candidate = body.candidates?.[0];
  return {
    choices: [{
      finish_reason: candidate?.finishReason === "STOP" ? "stop" : candidate?.finishReason === "MAX_TOKENS" ? "length" : "blocked",
      message: { content: candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") },
    }],
  };
}
