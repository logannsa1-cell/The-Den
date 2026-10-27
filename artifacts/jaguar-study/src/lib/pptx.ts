export type SlideElement =
  | { kind: 'text'; x: number; y: number; w: number; h: number; paragraphs: string[]; sizeCqw: number | null; placed: boolean }
  | { kind: 'image'; x: number; y: number; w: number; h: number; src: string };
export type ParsedDeck = { ratio: number; slides: SlideElement[][]; urls: string[] };

function first(el: Element, tag: string) { return el.getElementsByTagName(tag)[0] as Element | undefined; }
function num(el: Element | undefined, attr: string) { return Number(el?.getAttribute(attr) ?? NaN); }

export async function parsePptx(blob: Blob): Promise<ParsedDeck> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const parser = new DOMParser();
  const presXml = await zip.file('ppt/presentation.xml')?.async('text');
  let cx = 12192000; let cy = 6858000;
  if (presXml) {
    const size = first(parser.parseFromString(presXml, 'application/xml').documentElement, 'p:sldSz');
    if (size) { cx = num(size, 'cx') || cx; cy = num(size, 'cy') || cy; }
  }
  const slideWidthPt = cx / 12700;
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const urls: string[] = [];
  const slides: SlideElement[][] = [];
  for (const name of names) {
    const xml = await zip.file(name)!.async('text');
    const doc = parser.parseFromString(xml, 'application/xml').documentElement;
    const relsPath = name.replace('slides/', 'slides/_rels/') + '.rels';
    const relsXml = await zip.file(relsPath)?.async('text');
    const rels = new Map<string, string>();
    if (relsXml) {
      for (const rel of Array.from(parser.parseFromString(relsXml, 'application/xml').getElementsByTagName('Relationship'))) {
        rels.set(rel.getAttribute('Id') ?? '', rel.getAttribute('Target') ?? '');
      }
    }
    const elements: SlideElement[] = [];
    let flowY = 0.06;
    for (const sp of Array.from(doc.getElementsByTagName('p:sp'))) {
      const paragraphs = Array.from(sp.getElementsByTagName('a:p'))
        .map((p) => Array.from(p.getElementsByTagName('a:t')).map((t) => t.textContent ?? '').join(''))
        .filter((t) => t.trim());
      if (!paragraphs.length) continue;
      const off = first(sp, 'a:off'); const ext = first(sp, 'a:ext');
      const sz = num(first(sp, 'a:rPr'), 'sz');
      const sizeCqw = Number.isFinite(sz) ? ((sz / 100) / slideWidthPt) * 100 : null;
      if (off && ext && Number.isFinite(num(off, 'x'))) {
        elements.push({ kind: 'text', x: num(off, 'x') / cx, y: num(off, 'y') / cy, w: num(ext, 'cx') / cx, h: num(ext, 'cy') / cy, paragraphs, sizeCqw, placed: true });
      } else {
        const h = Math.min(0.5, 0.08 * paragraphs.length + 0.06);
        elements.push({ kind: 'text', x: 0.06, y: flowY, w: 0.88, h, paragraphs, sizeCqw, placed: false });
        flowY = Math.min(0.9, flowY + h + 0.02);
      }
    }
    for (const pic of Array.from(doc.getElementsByTagName('p:pic'))) {
      const embed = first(pic, 'a:blip')?.getAttribute('r:embed');
      const target = embed ? rels.get(embed) : undefined;
      const off = first(pic, 'a:off'); const ext = first(pic, 'a:ext');
      if (!target || !off || !ext) continue;
      const path = target.startsWith('../') ? `ppt/${target.slice(3)}` : `ppt/slides/${target}`;
      const file = zip.file(path);
      if (!file || !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(path)) continue;
      const data = await file.async('blob');
      const typed = path.toLowerCase().endsWith('.svg') ? new Blob([data], { type: 'image/svg+xml' }) : data;
      const src = URL.createObjectURL(typed);
      urls.push(src);
      elements.unshift({ kind: 'image', x: num(off, 'x') / cx, y: num(off, 'y') / cy, w: num(ext, 'cx') / cx, h: num(ext, 'cy') / cy, src });
    }
    slides.push(elements);
  }
  return { ratio: cx / cy, slides, urls };
}
