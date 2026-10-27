import type { ReactNode } from 'react';

type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' };

// Plain-text rendering only: React escapes everything, raw HTML tags are stripped to text.
function inline(text: string): ReactNode[] {
  const safe = text.replace(/<\/?[a-z][^>]*>/gi, '');
  return safe.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean).map((part, i) =>
    (part.startsWith('**') && part.endsWith('**') && part.length > 4) || (part.startsWith('__') && part.endsWith('__') && part.length > 4)
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part.replace(/`+/g, '').replace(/(^|\s)\*(\S)/g, '$1$2').replace(/(\S)\*(?=\s|$|[.,;:])/g, '$1')}</span>);
}

const isRow = (l: string) => l.startsWith('|') && l.endsWith('|') && l.length > 2;
const isSep = (l: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l);
const cells = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function parseNotes(source: string): Block[] {
  let text = source.replace(/\r\n?/g, '\n').trim();
  if (!text.includes('\n') && text.length > 420) {
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
    const chunks: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) chunks.push(sentences.slice(i, i + 3).join('').trim());
    text = chunks.join('\n\n');
  }
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  const lines = text.split('\n').map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { flush(); continue; }
    if (isRow(line) || (line.includes('|') && isSep(lines[i + 1] ?? ''))) {
      flush();
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length && lines[j] && (isRow(lines[j]) || lines[j].includes('|'))) { if (!isSep(lines[j])) rows.push(cells(lines[j])); j++; }
      i = j - 1;
      if (rows.length) {
        const width = Math.max(...rows.map((r) => r.length));
        const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
        blocks.push({ type: 'table', head: pad(rows[0]), rows: rows.slice(1).map(pad) });
      }
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ type: 'hr' }); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'quote') last.lines.push(quote[1]); else blocks.push({ type: 'quote', lines: [quote[1]] });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^(?:[-*\u2022])\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) { flush(); blocks.push({ type: 'h', level: Math.min(heading[1].length, 3), text: heading[2].replace(/[#*]+$/g, '').trim() }); }
    else if (bullet || ordered) {
      flush();
      const type = bullet ? 'ul' : 'ol';
      const item = (bullet ?? ordered)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) last.items.push(item); else blocks.push({ type, items: [item] });
    } else if (/^\*\*[^*]+\*\*:?$/.test(line) || (line.length < 70 && line.endsWith(':') && !para.length)) {
      flush(); blocks.push({ type: 'h', level: 3, text: line.replace(/\*\*/g, '').replace(/:$/, '') });
    } else para.push(line);
  }
  flush();
  return blocks;
}

const CALLOUT = /^(think about it|check (your )?understanding|worked example|example|exam tip|common mistake|key idea|remember|summary|quick check)/i;

export function RichNotes({ text, testId = 'text-rich-notes' }: { text: string; testId?: string }) {
  const blocks = parseNotes(text);
  return (
    <div className="rich-notes" data-testid={testId}>
      {blocks.map((block, i) => {
        if (block.type === 'h') {
          const cls = CALLOUT.test(block.text.replace(/\*\*/g, '')) ? 'callout-head' : undefined;
          return block.level <= 1 ? <h2 key={i} className={cls}>{inline(block.text)}</h2> : block.level === 2 ? <h3 key={i} className={cls}>{inline(block.text)}</h3> : <h4 key={i} className={cls}>{inline(block.text)}</h4>;
        }
        if (block.type === 'p') return <p key={i}>{inline(block.text)}</p>;
        if (block.type === 'hr') return <hr key={i} />;
        if (block.type === 'quote') return <blockquote key={i}>{block.lines.map((l, j) => <p key={j}>{inline(l)}</p>)}</blockquote>;
        if (block.type === 'table') return (
          <div key={i} className="notes-table-wrap" role="region" aria-label="Comparison table" tabIndex={0} data-testid={`table-notes-${i}`}>
            <table className="notes-table">
              <thead><tr>{block.head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>
              <tbody>{block.rows.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th key={k} scope="row">{inline(c)}</th> : <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        const items = block.items.map((item, j) => <li key={j}>{inline(item)}</li>);
        return block.type === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>;
      })}
    </div>
  );
}
