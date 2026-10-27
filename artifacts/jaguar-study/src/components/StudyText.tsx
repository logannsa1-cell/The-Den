import katex from 'katex';
import 'katex/contrib/mhchem';

// Only KaTeX's escaped, untrusted-mode output becomes HTML, never source HTML.
export function StudyText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?<!\\)\$(?!\s)[^$\n]+?(?<!\s)\$)/g);
  return <>{parts.map((part, i) => {
    const display = part.startsWith('$$') || part.startsWith('\\[');
    const math = display || part.startsWith('\\(') || (part.startsWith('$') && part.endsWith('$') && part.length > 2);
    if (!math) return <span key={i}>{part}</span>;
    const formula = part.slice(display || part.startsWith('\\(') ? 2 : 1, display || part.startsWith('\\(') ? -2 : -1);
    try {
      const html = katex.renderToString(formula, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 200, maxSize: 20 });
      return <span key={i} className={display ? 'study-math display-math' : 'study-math'} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span key={i} title="This equation could not be formatted">{formula}</span>;
    }
  })}</>;
}
