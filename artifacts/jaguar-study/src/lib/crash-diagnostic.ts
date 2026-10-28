/** Only error categories and bundled code locations may leave the raw error.
 * Never include its message, arbitrary stack text, URLs, query strings or user data. */
export function crashDiagnostic(error: Error): string {
  const names = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'SecurityError', 'QuotaExceededError'];
  const category = names.includes(error.name) ? error.name : 'Error';
  const frames = [...(error.stack ?? '').matchAll(/\/assets\/([a-zA-Z0-9_-]+\.js):(\d+):(\d+)(?=[\s)]|$)/g)]
    .slice(0, 5)
    .map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  return [category, ...frames].join('\n');
}
