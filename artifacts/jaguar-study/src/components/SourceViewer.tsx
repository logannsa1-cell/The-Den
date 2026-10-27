import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, Paperclip } from 'lucide-react';
import type { StoredSource } from '@/lib/source-store';
import { parsePptx, type Fill, type ParsedDeck, type SlideElement, type TextBody } from '@/lib/pptx';

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
        if (!alive) { void loaded.destroy(); return; }
        setDoc(loaded); onCountRef.current(loaded.numPages);
      } catch { if (alive) setError('This PDF could not be opened for preview.'); }
    })();
    return () => { alive = false; void loaded?.destroy(); };
  }, [blob]);
  // Re-render when the pane is resized so the page stays sharp at any split width.
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = wrap.current; if (!el || typeof ResizeObserver === 'undefined') return;
    let t = 0;
    const ro = new ResizeObserver(() => { window.clearTimeout(t); t = window.setTimeout(() => setW(Math.round(el.clientWidth / 24) * 24), 140); });
    ro.observe(el);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!doc || !canvas.current || !wrap.current) return;
    let active = true;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      try {
      const p = await doc.getPage(Math.min(page, doc.numPages));
      if (!active || !wrap.current || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const scale = ((wrap.current!.clientWidth || 900) / base.width) * Math.min(3, Math.max(1.5, window.devicePixelRatio || 1));
      const viewport = p.getViewport({ scale });
      const c = canvas.current!;
      c.width = viewport.width; c.height = viewport.height;
      task = p.render({ canvasContext: c.getContext('2d')!, viewport, canvas: c });
      await task!.promise;
      } catch { if (active) setError('This PDF page could not be rendered. Try reattaching the file.'); }
    })();
    return () => { active = false; task?.cancel(); };
  }, [doc, page, w]);
  if (error) return <div className="viewer-empty"><FileWarning size={18} />{error}</div>;
  return <div className="pdf-wrap" ref={wrap}>{!doc && <div className="viewer-skeleton" />}<canvas ref={canvas} className="pdf-canvas" data-testid="canvas-pdf-page" /></div>;
}

function fillCss(f: Fill): CSSProperties {
  if (f.kind === 'solid') return { background: f.color };
  if (f.kind === 'grad') return { background: `linear-gradient(${(f.angle + 90) % 360}deg, ${f.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})` };
  if (f.kind === 'image') return f.tile ? { backgroundImage: `url("${f.src}")`, backgroundRepeat: 'repeat' } : { backgroundImage: `url("${f.src}")`, backgroundSize: '100% 100%' };
  return {};
}
const FALLBACK = (font: string) => /serif|garamond|times|georgia|cambria|book|palatino|baskerville/i.test(font) && !/sans/i.test(font) ? 'Georgia, "Times New Roman", serif' : /mono|courier|consol/i.test(font) ? 'ui-monospace, monospace' : 'Calibri, Carlito, "Segoe UI", system-ui, sans-serif';

function SlideText({ t }: { t: TextBody }) {
  return (
    <div className="pptx-text" style={{ justifyContent: t.anchor === 'middle' ? 'center' : t.anchor === 'bottom' ? 'flex-end' : 'flex-start', padding: `${t.insets[0]}px ${t.insets[1]}px ${t.insets[2]}px ${t.insets[3]}px`, whiteSpace: t.wrap ? 'pre-wrap' : 'pre', writingMode: t.vertical ? 'vertical-rl' : undefined }}>
      {t.paragraphs.map((p, i) => {
        const size = p.runs.reduce((m, r) => Math.max(m, r.sizePt), 0) || p.emptySizePt;
        return (
          <p key={i} style={{ textAlign: p.align, marginLeft: p.marL, textIndent: p.indent, lineHeight: p.lineSpacing ? p.lineSpacing * 1.2 : 1.2, marginTop: p.spaceBefore ? `${p.spaceBefore}pt` : 0, marginBottom: p.spaceAfter ? `${p.spaceAfter}pt` : 0, fontSize: `${size}pt`, minHeight: p.runs.length ? undefined : `${p.emptySizePt * 1.2}pt` }}>
            {p.bullet && <span style={{ display: 'inline-block', width: Math.max(0, -p.indent) || '0.9em', textIndent: 0 }}>{p.bullet}</span>}
            {p.runs.map((r, k) => r.br ? <br key={k} /> : (
              <span key={k} style={{ fontSize: `${r.sizePt}pt`, fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? 'italic' : undefined, textDecoration: r.underline ? 'underline' : undefined, color: r.color, fontFamily: `"${r.font}", ${FALLBACK(r.font)}` }}>{r.text}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function SlideShape({ el }: { el: SlideElement }) {
  const box: CSSProperties = { left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rot || el.flipH || el.flipV ? `rotate(${el.rot}deg) scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` : undefined };
  const g = el.geom;
  const radius = g.kind === 'ellipse' ? '50%' : g.kind === 'roundRect' ? g.radius : undefined;
  const border = el.line && g.kind !== 'path' ? `${el.line.width}px ${el.line.dash ? 'dashed' : 'solid'} ${el.line.color}` : undefined;
  const unflip: CSSProperties | undefined = el.flipH || el.flipV ? { transform: `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` } : undefined;
  return (
    <div className="pptx-el" style={box} data-layer={el.layer}>
      {g.kind === 'path' ? (
        <svg className="pptx-fill" viewBox={`0 0 ${g.vw} ${g.vh}`} preserveAspectRatio="none" aria-hidden>
          {el.fill.kind === 'grad' && <defs><linearGradient id={`g-${el.id}`} gradientTransform={`rotate(${el.fill.angle} .5 .5)`}>{el.fill.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</linearGradient></defs>}
          {el.fill.kind === 'image' && <defs><pattern id={`g-${el.id}`} width="1" height="1" patternContentUnits="objectBoundingBox"><image href={el.fill.src} width="1" height="1" preserveAspectRatio="none" /></pattern></defs>}
          <path d={g.d} fill={el.fill.kind === 'solid' ? el.fill.color : el.fill.kind === 'none' ? 'none' : `url(#g-${el.id})`} stroke={el.line?.color ?? 'none'} strokeWidth={el.line ? el.line.width : 0} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (el.fill.kind !== 'none' || border) && <div className="pptx-fill" style={{ ...fillCss(el.fill), borderRadius: radius, border }} />}
      {el.image && (
        <div className="pptx-fill" style={{ borderRadius: radius, overflow: 'hidden', border }}>
          <img src={el.image.src} alt="" draggable={false} style={{ position: 'absolute', left: `${(-el.image.crop[0] / Math.max(0.01, 1 - el.image.crop[0] - el.image.crop[2])) * 100}%`, top: `${(-el.image.crop[1] / Math.max(0.01, 1 - el.image.crop[1] - el.image.crop[3])) * 100}%`, width: `${100 / Math.max(0.01, 1 - el.image.crop[0] - el.image.crop[2])}%`, height: `${100 / Math.max(0.01, 1 - el.image.crop[1] - el.image.crop[3])}%`, maxWidth: 'none' }} />
        </div>
      )}
      {el.text && <div className="pptx-fill" style={unflip}><SlideText t={el.text} /></div>}
    </div>
  );
}

function PptxSlide({ blob, slide, onCount }: { blob: Blob; slide: number; onCount: (n: number) => void }) {
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const onCountRef = useRef(onCount); onCountRef.current = onCount;
  useEffect(() => {
    let alive = true; let made: ParsedDeck | null = null;
    parsePptx(blob).then((d) => { made = d; if (alive) { setDeck(d); onCountRef.current(d.slides.length); } else d.urls.forEach((u) => URL.revokeObjectURL(u)); }).catch(() => alive && setError('These slides could not be opened for preview.'));
    return () => { alive = false; made?.urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [blob]);
  // Whole-stage scaling: the slide is laid out at native size, then scaled as one unit so text never re-wraps.
  useEffect(() => {
    const el = frame.current; if (!el || !deck) return;
    const fit = () => setScale(el.clientWidth / deck.width);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [deck]);
  if (error) return <div className="viewer-empty"><FileWarning size={18} />{error}</div>;
  if (!deck) return <div className="viewer-skeleton" style={{ aspectRatio: '16 / 9' }} />;
  const s = deck.slides[Math.min(slide, deck.slides.length) - 1];
  if (!s) return <div className="viewer-empty">This deck has no slides.</div>;
  const custom = deck.fonts.filter((f) => !/^(calibri|calibri light|arial|georgia|times new roman)$/i.test(f));
  return (
    <div>
      <div className="slide-frame" ref={frame} style={{ aspectRatio: `${deck.ratio}` }} data-testid="view-pptx-slide">
        <div className="slide-stage" style={{ width: deck.width, height: deck.height, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden', ...fillCss(s.background) }}>
          {s.elements.map((el) => <SlideShape key={el.id} el={el} />)}
        </div>
      </div>
      <p className="viewer-note" data-testid="text-slide-limits">
        Approximate slide preview from the PPTX file, not PowerPoint itself.
        {s.skipped > 0 && ` ${s.skipped} chart, table, diagram or unsupported picture ${s.skipped === 1 ? 'object is' : 'objects are'} not shown on this slide.`}
        {custom.length > 0 && ` Fonts (${custom.slice(0, 3).join(', ')}${custom.length > 3 ? '…' : ''}) use a close substitute if not installed.`}
        {' '}For an exact copy, attach a PDF export of the deck.
      </p>
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
