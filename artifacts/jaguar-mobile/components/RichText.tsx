import React from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

/* ---------- LaTeX -> readable Unicode (native, no WebView) ---------- */

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', y: 'ʸ', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', k: 'ᵏ', m: 'ᵐ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', T: 'ᵀ', ' ': ' ' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ', ' ': ' ' };
const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', propto: '∝', sim: '∼',
  infty: '∞', partial: '∂', nabla: '∇', sum: 'Σ', prod: 'Π', int: '∫', oint: '∮', degree: '°', circ: '°', angle: '∠', perp: '⊥', parallel: '∥',
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', rightleftharpoons: '⇌', Leftrightarrow: '⇔', uparrow: '↑', downarrow: '↓',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', therefore: '∴', because: '∵', ldots: '…', cdots: '⋯', dots: '…',
  log: 'log', ln: 'ln', sin: 'sin', cos: 'cos', tan: 'tan', lim: 'lim', max: 'max', min: 'min', exp: 'exp', quad: '  ', qquad: '    ', ',': ' ', ';': ' ', '!': '', ' ': ' ', '%': '%', '$': '$', '{': '{', '}': '}',
};

function mapScript(body: string, table: Record<string, string>, mark: string) {
  const chars = Array.from(body);
  return chars.every((ch) => table[ch]) ? chars.map((ch) => table[ch]).join('') : `${mark}(${body})`;
}

function readGroup(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] === '{') {
    let depth = 1; let j = i + 1;
    while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
    return [s.slice(i + 1, j - 1), j];
  }
  if (s[i] === '\\') { const m = s.slice(i).match(/^\\[a-zA-Z]+/); if (m) return [m[0], i + m[0].length]; }
  return [s[i] ?? '', i + 1];
}

function chem(body: string) {
  return body
    .replace(/<=>|<->/g, ' ⇌ ').replace(/->/g, ' → ').replace(/<-/g, ' ← ')
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, c: string) => mapScript(c, SUP, '^'))
    .replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, n: string) => a + mapScript(n, SUB, '_'));
}

export function latexToText(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const m = src.slice(i).match(/^\\([a-zA-Z]+|.)/);
      const name = m?.[1] ?? '';
      i += 1 + name.length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, j] = readGroup(src, i); const [b, k] = readGroup(src, j); i = k;
        const na = latexToText(a); const nb = latexToText(b);
        const wrap = (t: string) => (t.length > 1 && /[+\-−×·\s]/.test(t) ? `(${t})` : t);
        out += `${wrap(na)}⁄${wrap(nb)}`;
      } else if (name === 'sqrt') {
        let root = '';
        if (src[i] === '[') { const end = src.indexOf(']', i); root = src.slice(i + 1, end); i = end + 1; }
        const [a, j] = readGroup(src, i); i = j;
        const inner = latexToText(a);
        out += `${root ? mapScript(root, SUP, '^') : ''}√${inner.length > 1 ? `(${inner})` : inner}`;
      } else if (name === 'ce' || name === 'pu') {
        const [a, j] = readGroup(src, i); i = j; out += chem(a);
      } else if (['text', 'mathrm', 'mathbf', 'mathit', 'textbf', 'operatorname', 'mathsf', 'boldsymbol', 'vec', 'hat', 'bar', 'overline', 'underline'].includes(name)) {
        const [a, j] = readGroup(src, i); i = j;
        const t = latexToText(a);
        out += name === 'vec' ? `${t}⃗` : name === 'hat' ? `${t}̂` : name === 'bar' || name === 'overline' ? `${t}̄` : t;
      } else if (['left', 'right', 'big', 'Big', 'bigl', 'bigr', 'displaystyle', 'limits'].includes(name)) {
        /* sizing commands carry no meaning in plain text */
      } else if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name];
      } else {
        out += name;
      }
    } else if (ch === '^' || ch === '_') {
      const [a, j] = readGroup(src, i + 1); i = j;
      out += mapScript(latexToText(a), ch === '^' ? SUP : SUB, ch);
    } else if (ch === '{' || ch === '}') {
      i++;
    } else if (ch === '&') {
      out += ' '; i++;
    } else {
      out += ch; i++;
    }
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/* ---------- Inline text with math ---------- */

const MATH_SPLIT = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?<!\\)\$(?!\s)[^$\n]+?(?<!\s)\$)/g;

export function MathText({ text, style }: { text: string; style?: TextStyle | TextStyle[] }) {
  const c = useColors();
  const parts = text.split(MATH_SPLIT).filter((p) => p !== '');
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const display = part.startsWith('$$') || part.startsWith('\\[');
        const isMath = display || part.startsWith('\\(') || (part.startsWith('$') && part.endsWith('$') && part.length > 2);
        if (!isMath) return renderBold(part, i, c.foreground);
        const body = part.slice(display || part.startsWith('\\(') ? 2 : 1, display || part.startsWith('\\(') ? -2 : -1);
        const t = latexToText(body);
        return display
          ? <Text key={i} style={{ color: c.primaryLight, fontFamily: 'Inter_500Medium' }}>{`\n${t}\n`}</Text>
          : <Text key={i} style={{ color: c.primaryLight, fontFamily: 'Inter_500Medium' }}>{t}</Text>;
      })}
    </Text>
  );
}

function renderBold(part: string, key: number, color: string) {
  const safe = part.replace(/<\/?[a-z][^>]*>/gi, '').replace(/`+/g, '');
  const pieces = safe.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean);
  return (
    <Text key={key}>
      {pieces.map((p, j) => (p.length > 4 && ((p.startsWith('**') && p.endsWith('**')) || (p.startsWith('__') && p.endsWith('__')))
        ? <Text key={j} style={{ fontFamily: 'Inter_700Bold', color }}>{p.slice(2, -2)}</Text>
        : <Text key={j}>{p.replace(/(^|\s)\*(\S)/g, '$1$2').replace(/(\S)\*(?=\s|$|[.,;:])/g, '$1')}</Text>))}
    </Text>
  );
}

/** Prompts may start with "[Subject]" — render it as a label. */
export function SubjectPrompt({ text, style }: { text: string; style?: TextStyle }) {
  const c = useColors();
  const m = text.match(/^\[([^\]\n]{1,80})\]\s*([\s\S]*)$/);
  if (!m) return <MathText text={text} style={style} />;
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.subject, { color: c.primary }]}>{m[1].toUpperCase()}</Text>
      <MathText text={m[2]} style={style} />
    </View>
  );
}

/* ---------- Markdown blocks ---------- */

type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'quote'; lines: string[] }
  | { type: 'math'; text: string }
  | { type: 'hr' };

const isRow = (l: string) => l.startsWith('|') && l.endsWith('|') && l.length > 2;
const isSep = (l: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l);
const cells = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());

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
    if (/^\$\$[\s\S]*\$\$$/.test(line) && line.length > 4) { flush(); blocks.push({ type: 'math', text: line.slice(2, -2) }); continue; }
    if (line === '$$' || line === '\\[') {
      flush(); const end = line === '$$' ? '$$' : '\\]'; const body: string[] = []; let j = i + 1;
      while (j < lines.length && lines[j] !== end) body.push(lines[j++]);
      blocks.push({ type: 'math', text: body.join(' ') }); i = j; continue;
    }
    if (isRow(line) || (line.includes('|') && isSep(lines[i + 1] ?? ''))) {
      flush();
      const rows: string[][] = []; let j = i;
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
      flush(); const last = blocks[blocks.length - 1];
      if (last && last.type === 'quote') last.lines.push(quote[1]); else blocks.push({ type: 'quote', lines: [quote[1]] });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^(?:[-*\u2022])\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) { flush(); blocks.push({ type: 'h', level: Math.min(heading[1].length, 3), text: heading[2].replace(/[#*]+$/g, '').trim() }); }
    else if (bullet || ordered) {
      flush(); const type = bullet ? 'ul' : 'ol'; const item = (bullet ?? ordered)![1];
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

export function RichNotes({ text, size = 16, testID }: { text: string; size?: number; testID?: string }) {
  const c = useColors();
  const blocks = React.useMemo(() => parseNotes(text), [text]);
  const body: TextStyle = { color: c.foreground, fontFamily: 'Inter_400Regular', fontSize: size, lineHeight: size * 1.6 };
  return (
    <View testID={testID} style={{ gap: 12 }}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const callout = CALLOUT.test(b.text);
          const fs = b.level <= 1 ? size + 8 : b.level === 2 ? size + 4 : size + 1;
          return (
            <View key={i} style={[callout && { borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: 10 }, { marginTop: b.level <= 2 ? 14 : 6 }]}>
              <MathText text={b.text} style={{ color: callout ? c.primaryLight : c.foreground, fontFamily: 'Inter_700Bold', fontSize: fs, lineHeight: fs * 1.25 }} />
            </View>
          );
        }
        if (b.type === 'p') return <MathText key={i} text={b.text} style={body} />;
        if (b.type === 'hr') return <View key={i} style={{ height: 1, backgroundColor: c.border, marginVertical: 6 }} />;
        if (b.type === 'math') return (
          <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={[styles.mathBlock, { backgroundColor: c.primarySoft, borderColor: c.border }]}>
            <Text style={{ color: c.primaryLight, fontFamily: 'Inter_500Medium', fontSize: size + 1 }}>{latexToText(b.text)}</Text>
          </ScrollView>
        );
        if (b.type === 'quote') return (
          <View key={i} style={[styles.quote, { borderLeftColor: c.primary, backgroundColor: c.card }]}>
            {b.lines.map((l, j) => <MathText key={j} text={l} style={body} />)}
          </View>
        );
        if (b.type === 'table') return (
          <ScrollView key={i} horizontal style={[styles.table, { borderColor: c.border }]} accessibilityLabel="Comparison table">
            <View>
              {[b.head, ...b.rows].map((row, r) => (
                <View key={r} style={[styles.tr, { borderBottomColor: c.border, backgroundColor: r === 0 ? c.cardRaised : 'transparent' }]}>
                  {row.map((cell, k) => (
                    <View key={k} style={styles.td}>
                      <MathText text={cell} style={{ ...body, fontSize: size - 2, lineHeight: (size - 2) * 1.45, fontFamily: r === 0 || k === 0 ? 'Inter_600SemiBold' : 'Inter_400Regular' }} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
        return (
          <View key={i} style={{ gap: 8 }}>
            {b.items.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: size, lineHeight: size * 1.6, minWidth: 18 }}>{b.type === 'ol' ? `${j + 1}.` : '•'}</Text>
                <View style={{ flex: 1 }}><MathText text={item} style={body} /></View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subject: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  mathBlock: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  quote: { borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, gap: 6 },
  table: { borderWidth: 1, borderRadius: 12 },
  tr: { flexDirection: 'row', borderBottomWidth: 1 },
  td: { width: 160, padding: 10 },
});
