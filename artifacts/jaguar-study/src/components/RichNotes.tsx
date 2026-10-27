import type { ReactNode } from 'react';

type Block = { type: 'h'; level: number; text: string } | { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] };

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part.replace(/`+/g, '').replace(/(^|\s)\*(\S)/g, '$1$2').replace(/(\S)\*(?=\s|$|[.,;:])/g, '$1')}</span>);
}

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
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
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

export function RichNotes({ text, testId = 'text-rich-notes' }: { text: string; testId?: string }) {
  const blocks = parseNotes(text);
  return (
    <div className="rich-notes" data-testid={testId}>
      {blocks.map((block, i) => {
        if (block.type === 'h') return block.level <= 1 ? <h2 key={i}>{inline(block.text)}</h2> : block.level === 2 ? <h3 key={i}>{inline(block.text)}</h3> : <h4 key={i}>{inline(block.text)}</h4>;
        if (block.type === 'p') return <p key={i}>{inline(block.text)}</p>;
        const items = block.items.map((item, j) => <li key={j}>{inline(item)}</li>);
        return block.type === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>;
      })}
    </div>
  );
}
