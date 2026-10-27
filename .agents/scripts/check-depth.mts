import { readFileSync, writeFileSync } from "node:fs";
import { generateStudyContent } from "../../artifacts/api-server/src/lib/gemini-study";
const route = readFileSync("artifacts/api-server/src/routes/study.ts", "utf8");
const prompt = route.match(/`You are Jaguar,[\s\S]*?Return JSON only\.`/)![0].slice(1, -1);
const result = await generateStudyContent({
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  modes: ["summary", "tutor", "cram"], questionCount: 2,
  messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify({
    sourceText: readFileSync("/tmp/jaguar-reference/lesson.txt", "utf8"),
    modes: ["summary", "tutor", "cram"], questionCount: 2,
  }) }],
});
const value = JSON.parse(result.choices[0].message.content || "{}");
writeFileSync("/tmp/jaguar-reference/generated.json", JSON.stringify(value));
console.log(JSON.stringify({ finish: result.choices[0].finish_reason,
  summaryWords: value.summary?.split(/\s+/).length, tutorWords: value.tutorLesson?.split(/\s+/).length,
  cramWords: value.cramPoints?.join(" ").split(/\s+/).length,
}));
