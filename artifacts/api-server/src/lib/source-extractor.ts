import { Worker } from "node:worker_threads";

export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_SOURCE_TEXT = 180_000;
export const sourceExtensions = new Set(["pdf", "pptx", "docx", "txt", "md", "csv"]);
export interface ExtractedSource { text: string; pages: string[]; notice: string }

/** Parsing stays off the HTTP event loop. Termination bounds malformed-document work. */
export function extractSource(name: string, bytes: Uint8Array, signal?: AbortSignal): Promise<ExtractedSource> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./source-worker.mjs", import.meta.url), {
      workerData: { name, bytes },
      resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32 },
      stdout: true,
      stderr: true,
    });
    // Parser warnings can contain document fragments; do not forward or persist them.
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const finish = (error?: Error, data?: ExtractedSource) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else resolve(data!);
    };
    const abort = () => finish(new Error("Upload cancelled."));
    const timer = setTimeout(() => finish(new Error("This file took too long to read. Try a smaller file or export it as a text-based PDF.")), 20_000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    worker.once("message", (message: { result?: ExtractedSource; error?: string }) => {
      if (message.error) finish(new Error(message.error));
      else if (message.result) finish(undefined, message.result);
      else finish(new Error("The document could not be read."));
    });
    worker.once("error", () => finish(new Error("This file could not be read within the document limits. Try a smaller text-based PDF.")));
    worker.once("exit", () => {
      if (!settled) finish(new Error("Document reading stopped. Try a smaller file."));
    });
  });
}
