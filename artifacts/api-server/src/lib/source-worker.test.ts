import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

// Exercise the actual production-bundled worker, including PDF.js' worker asset.
const workerFile = path.resolve("artifacts/api-server/dist/source-worker.mjs");
function parse(name: string, bytes: Uint8Array): Promise<{ text: string; pages: string[]; notice: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, { workerData: { name, bytes }, stdout: true, stderr: true });
    worker.stdout.resume(); worker.stderr.resume();
    const timeout = setTimeout(() => { void worker.terminate(); reject(new Error("test timeout")); }, 22000);
    worker.once("message", message => {
      clearTimeout(timeout); void worker.terminate();
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    });
    worker.once("error", error => { clearTimeout(timeout); reject(error); });
  });
}
const requireWeb = createRequire(path.resolve("artifacts/jaguar-study/package.json"));
const JSZip = requireWeb("jszip");
async function zip(entries: Record<string, string>) {
  const archive = new JSZip();
  for (const [name, text] of Object.entries(entries)) archive.file(name, text);
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("UTF-8 notes preserve readable content", async () => {
  const text = "Biology Week 1\nCells are the basic unit of life. Plants have cell walls.";
  assert.equal((await parse("biology.txt", Buffer.from(text))).text, text);
});
test("binary disguised as text fails explicitly", async () => {
  await assert.rejects(parse("biology.txt", Buffer.from("Not text\0more content for length")), /not a readable/);
});
test("DOCX text joins split runs and decodes entities without exposing XML", async () => {
  const bytes = await zip({ "word/document.xml": '<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Biology Week 001: </w:t></w:r><w:r><w:t>Cells &amp; their structures.</w:t></w:r></w:p><w:p><w:r><w:t>Learn the nucleus and membrane.</w:t></w:r></w:p></w:body></w:document>' });
  const result = await parse("biology.docx", bytes);
  assert.match(result.text, /Cells & their structures/);
  assert.ok(!result.text.includes("<w:"));
  assert.equal(result.pages.length, 1);
});
test("PPTX follows presentation slide order rather than filenames", async () => {
  const slide = (text: string) => `<p:sld xmlns:p="p" xmlns:a="a"><p:sp><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sp></p:sld>`;
  const bytes = await zip({
    "ppt/presentation.xml": '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels": '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
    "ppt/slides/slide1.xml": slide("Second lesson: Chemical reactions explained."),
    "ppt/slides/slide2.xml": slide("First lesson: Atoms and elements explained."),
  });
  const result = await parse("chemistry.pptx", bytes);
  assert.match(result.pages[0], /^First lesson/);
  assert.match(result.pages[1], /^Second lesson/);
  assert.match(result.notice, /not original/);
});
test("Office DTD entities are refused", async () => {
  const bytes = await zip({ "word/document.xml": '<!DOCTYPE foo [<!ENTITY bar "expanded">]><w:document><w:t>&bar;</w:t></w:document>' });
  await assert.rejects(parse("unsafe.docx", bytes), /custom XML entities/);
});
test("oversized source fails rather than silently truncating", async () => {
  await assert.rejects(parse("large.txt", Buffer.from("study ".repeat(31000))), /too much text/);
});
test("zip expansion limit is checked before inflating document XML", async () => {
  const bytes = await zip({ "word/document.xml": "x".repeat(17 * 1024 * 1024) });
  await assert.rejects(parse("large.docx", bytes), /safe reading limit/);
});
test("damaged PDF fails with actionable error", async () => {
  await assert.rejects(parse("broken.pdf", Buffer.from("%PDF-1.7\nbad pdf")), /could not be read/);
});
test("uploaded Word reference extracts real paragraphs", async () => {
  const bytes = await readFile("attached_assets/SOCIAL_STUDIES_YEAR_8_1793114279250.docx");
  const result = await parse("social-studies.docx", bytes);
  assert.ok(result.text.length > 500);
  assert.ok(!result.text.includes("<w:"));
});
test("uploaded tutor PDF loads bundled PDF worker and returns readable pages", async () => {
  const bytes = await readFile("attached_assets/Studley_AI_-_Genetics_and_Variation_—_Tutor_Lesson_1793122779107.pdf");
  const result = await parse("tutor.pdf", bytes);
  assert.ok(result.pages.length > 1);
  assert.match(result.text, /genetic/i);
  assert.ok(result.text.length > 1000);
});
