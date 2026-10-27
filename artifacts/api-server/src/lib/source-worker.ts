import { parentPort, workerData } from "node:worker_threads";
import { fromBuffer, type Entry } from "yauzl";
import { XMLParser } from "fast-xml-parser";

const MAX_TEXT = 180_000;
const MAX_XML = 16 * 1024 * 1024;
const MAX_EXPANDED = 80 * 1024 * 1024;
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, preserveOrder: true });
type XmlNode = Record<string, unknown>;
const array = (value: unknown): XmlNode[] => Array.isArray(value) ? value : [];

function decode(text: string) {
  return text.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (full, code, entity) => {
    if (code) {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[entity.toLowerCase()] ?? full;
  });
}

function extractXml(xml: string, textTag: string, paragraphTag: string): string {
  // No DTD/custom entity expansion or external resolution is permitted.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Documents with custom XML entities are not supported.");
  const walk = (nodes: XmlNode[]): string => nodes.map(node => {
    let text = "";
    for (const [key, value] of Object.entries(node)) {
      if (key === ":@") continue;
      if (key === textTag) text += array(value).map(n => decode(String(n["#text"] ?? ""))).join("");
      else if (key === "w:tab") text += "\t";
      else if (key === "w:br" || key === "a:br") text += "\n";
      else text += walk(array(value)) + (key === paragraphTag ? "\n" : "");
    }
    return text;
  }).join("");
  return walk(parser.parse(xml)).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function officeXml(bytes: Buffer, ext: string): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(new Error("This Office file is damaged or is not a supported document."));
      let size = 0, count = 0;
      const files = new Map<string, string>();
      const fail = (message: string) => { zip.close(); reject(new Error(message)); };
      zip.on("error", () => fail("This Office file could not be read."));
      zip.on("end", () => resolve(files));
      zip.on("entry", (entry: Entry) => {
        size += entry.uncompressedSize;
        count++;
        if (size > MAX_EXPANDED || count > 5000 || entry.generalPurposeBitFlag & 1) {
          return fail("This document is encrypted or expands beyond the safe reading limit. Export a smaller PDF.");
        }
        const wanted = ext === "docx" ? entry.fileName === "word/document.xml" :
          /^ppt\/slides\/slide\d+\.xml$/.test(entry.fileName) ||
          entry.fileName === "ppt/presentation.xml" || entry.fileName === "ppt/_rels/presentation.xml.rels";
        if (!wanted) { zip.readEntry(); return; }
        if (entry.uncompressedSize > MAX_XML) return fail("A document page exceeds the safe reading limit.");
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail("A document page could not be read.");
          const chunks: Buffer[] = [];
          let read = 0;
          stream.on("data", (chunk: Buffer) => {
            read += chunk.length;
            if (read > MAX_XML) { stream.destroy(); fail("A document page is too large."); }
            else chunks.push(chunk);
          });
          stream.on("error", () => fail("A document page could not be read."));
          stream.on("end", () => { files.set(entry.fileName, Buffer.concat(chunks).toString("utf8")); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

async function extract(name: string, bytes: Buffer) {
  const ext = name.split(".").pop()!.toLowerCase();
  let pages: string[] = [];
  let notice = "Accessible text preview. Original files stay on your device and are not synced.";
  if (["txt", "md", "csv"].includes(ext)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    if (text.includes("\0")) throw new Error("This is not a readable UTF-8 text file.");
    pages = [text.trim()];
  } else if (ext === "pdf") {
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("This file is not a valid PDF.");
    // PDF.js loads its own bundled worker module, not a network resource.
    const canvas = await import("@napi-rs/canvas");
    Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix, Path2D: canvas.Path2D, ImageData: canvas.ImageData });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", import.meta.url).href;
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    const doc = await task.promise;
    try {
      if (doc.numPages > 400) throw new Error("Please split PDFs longer than 400 pages.");
      let length = 0;
      for (let page = 1; page <= doc.numPages; page++) {
        const source = await doc.getPage(page);
        const content = await source.getTextContent();
        const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
        length += text.length;
        if (length > MAX_TEXT) throw new Error("This file contains too much text. Split it into smaller study sets.");
        pages.push(text);
        source.cleanup();
      }
    } finally { await doc.destroy(); }
    notice = "Accessible PDF text preview, not the original page layout. Scanned images are not transcribed.";
  } else if (ext === "docx" || ext === "pptx") {
    const files = await officeXml(bytes, ext);
    if (ext === "docx") {
      const document = files.get("word/document.xml");
      if (!document) throw new Error("This file does not contain a Word document.");
      pages = [extractXml(document, "w:t", "w:p")];
    } else {
      const rels = files.get("ppt/_rels/presentation.xml.rels") ?? "";
      const presentation = files.get("ppt/presentation.xml") ?? "";
      const plainParser = new XMLParser({ ignoreAttributes: false, processEntities: false });
      if (/<!DOCTYPE|<!ENTITY/i.test(rels + presentation)) throw new Error("Unsupported XML entities.");
      const relationships = plainParser.parse(rels)?.Relationships?.Relationship ?? [];
      const mapping = new Map<string, string>();
      for (const rel of Array.isArray(relationships) ? relationships : [relationships]) {
        const target = String(rel["@_Target"] ?? "");
        if (rel["@_TargetMode"] !== "External" && /^(\/ppt\/)?slides\/slide\d+\.xml$/.test(target)) {
          mapping.set(rel["@_Id"], target.startsWith("/") ? target.slice(1) : `ppt/${target}`);
        }
      }
      const ids = plainParser.parse(presentation)?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"] ?? [];
      let paths = (Array.isArray(ids) ? ids : [ids]).map(id => mapping.get(id["@_r:id"])).filter((p): p is string => !!p);
      if (!paths.length) paths = [...files.keys()].filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (paths.length > 400) throw new Error("Please split presentations longer than 400 slides.");
      pages = paths.map(path => extractXml(files.get(path) ?? "", "a:t", "a:p"));
      notice = "Accessible slide text preview, not original slide artwork or animations. Use the original file for diagrams and visual detail.";
    }
  } else throw new Error("Use a PDF, PPTX, DOCX, TXT, MD or CSV file.");
  const text = pages.map((page, i) => pages.length > 1 ? `Page ${i + 1}\n${page}` : page).join("\n\n").trim();
  if (text.length > MAX_TEXT) throw new Error("This file contains too much text. Split it into smaller study sets.");
  if (pages.join("").trim().length < 20) throw new Error("No readable text was found. Scanned documents need a text-based version.");
  return { text, pages, notice };
}

extract(workerData.name, Buffer.from(workerData.bytes))
  .then(result => parentPort?.postMessage({ result }))
  .catch((error: unknown) => parentPort?.postMessage({ error: error instanceof Error && /^(This |A document |Documents |Please |Unsupported |Use a |No readable)/.test(error.message) ? error.message : "This document could not be read. Try a text-based PDF or UTF-8 text file." }));
