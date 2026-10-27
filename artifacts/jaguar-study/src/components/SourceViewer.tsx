import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, Paperclip } from 'lucide-react';
import type { StoredSource } from '@/lib/source-store';
import { parsePptx, type ParsedDeck } from '@/lib/pptx';

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => Promise<void> };

function PdfPage({ blob, page, onCount }: { blob: Blob; page: number; onCount: (n: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState('');
  const onCountRef = useRef(onCount); onCountRef.current = onCount;
  useEffect(() => {
    let alive = true; let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
        loaded = (await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise) as unknown as PdfDoc;
        if (!alive) return;
        setDoc(loaded); onCountRef.current(loaded.numPages);
      } catch { if (alive) setError('This PDF could not be opened for preview.'); }
    })();
    return () => { alive = false; void loaded?.destroy(); };
  }, [blob]);
  useEffect(() => {
    if (!doc || !canvas.current || !wrap.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const p = await doc.getPage(Math.min(page, doc.numPages));
      const base = p.getViewport({ scale: 1 });
      const scale = (wrap.current!.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1);
      const viewport = p.getViewport({ scale });
      const c = canvas.current!;
      c.width = viewport.width; c.height = viewport.height;
      task = p.render({ canvasContext: c.getContext('2d')!, viewport, canvas: c });
      try { await task!.promise; } catch { /* cancelled */ }
    })();
    return () => task?.cancel();
  }, [doc, page]);
  if (error) return <div className="viewer-empty"><FileWarning size={18} />{error}</div>;
  return <div className="pdf-wrap" ref={wrap}>{!doc && <div className="viewer-skeleton" />}<canvas ref={canvas} className="pdf-canvas" data-testid="canvas-pdf-page" /></div>;
}

function PptxSlide({ blob, slide, onCount }: { blob: Blob; slide: number; onCount: (n: number) => void }) {
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [error, setError] = useState('');
  const onCountRef = useRef(onCount); onCountRef.current = onCount;
  useEffect(() => {
    let alive = true; let made: ParsedDeck | null = null;
    parsePptx(blob).then((d) => { made = d; if (alive) { setDeck(d); onCountRef.current(d.slides.length); } }).catch(() => alive && setError('These slides could not be opened for preview.'));
    return () => { alive = false; made?.urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [blob]);
  if (error) return <div className="viewer-empty"><FileWarning size={18} />{error}</div>;
  if (!deck) return <div className="viewer-skeleton" style={{ aspectRatio: '16 / 9' }} />;
  const els = deck.slides[slide - 1] ?? [];
  return (
    <div>
      <div className="slide-stage" style={{ aspectRatio: `${deck.ratio}` }} data-testid="view-pptx-slide">
        {els.length === 0 && <div className="viewer-empty">No text or pictures on this slide.</div>}
        {els.map((el, i) => el.kind === 'image'
          ? <img key={i} src={el.src} alt="" className="slide-el" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%` }} />
          : <div key={i} className={`slide-el slide-text${el.placed ? '' : ' unplaced'}`} style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, minHeight: `${el.h * 100}%`, fontSize: el.sizeCqw ? `${el.sizeCqw}cqw` : '2.1cqw' }}>{el.paragraphs.map((p, j) => <p key={j}>{p}</p>)}</div>)}
      </div>
      <p className="viewer-note">Simplified slide preview: real slide text and pictures at their saved positions. Themes, fonts and effects may differ from PowerPoint.</p>
    </div>
  );
}

type Props = { sources: StoredSource[] | null; onReattach: (files: File[]) => void };

export function SourceViewer({ sources, onReattach }: Props) {
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const attach = useRef<HTMLInputElement>(null);
  const previewable = (sources ?? []).filter((s) => /\.(pdf|pptx)$/i.test(s.name));
  useEffect(() => { setPage(1); setCount(0); }, [index]);
  useEffect(() => { setIndex(0); }, [sources]);

  if (sources === null) return <div className="viewer-shell"><div className="viewer-empty"><LoaderCircle size={16} className="spin-icon" /> Looking for your files on this device</div></div>;
  if (!previewable.length) {
    return (
      <div className="viewer-shell">
        <div className="viewer-empty" data-testid="text-reattach">
          <FileWarning size={20} />
          <strong>{sources.length ? 'No PDF or slides to preview' : 'Reattach source to preview'}</strong>
          <span>{sources.length ? 'Text-based files have no page view. Your notes are still on the left.' : 'Original files stay on the device they were added from. Reattach the PDF or PPTX here to see pages beside your notes.'}</span>
          <button className="quiet-button" type="button" onClick={() => attach.current?.click()} data-testid="button-reattach"><Paperclip size={13} /> Reattach PDF or PPTX</button>
          <input ref={attach} className="sr-only" type="file" multiple accept=".pdf,.pptx" onChange={(e) => { onReattach(Array.from(e.target.files ?? [])); e.target.value = ''; }} data-testid="input-reattach" />
        </div>
      </div>
    );
  }
  const current = previewable[Math.min(index, previewable.length - 1)];
  const isPdf = /\.pdf$/i.test(current.name);
  const go = (n: number) => setPage(Math.max(1, Math.min(count || 1, n)));
  return (
    <div className="viewer-shell">
      <div className="viewer-bar">
        <select className="field viewer-select" value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Choose source" data-testid="select-source">
          {previewable.map((s, i) => <option key={`${s.name}-${i}`} value={i}>{s.name}</option>)}
        </select>
        <div className="pager">
          <button className="icon-button" type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page" data-testid="button-prev-page"><ChevronLeft size={14} /></button>
          <label className="pager-input">{isPdf ? 'Page' : 'Slide'}
            <input type="number" min={1} max={count || 1} value={page} onChange={(e) => go(Number(e.target.value) || 1)} data-testid="input-page" />
            <span>/ {count || '...'}</span>
          </label>
          <button className="icon-button" type="button" onClick={() => go(page + 1)} disabled={!count || page >= count} aria-label="Next page" data-testid="button-next-page"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="viewer-body">
        {isPdf ? <PdfPage key={current.name + index} blob={current.blob} page={page} onCount={setCount} /> : <PptxSlide key={current.name + index} blob={current.blob} slide={page} onCount={setCount} />}
      </div>
    </div>
  );
}
