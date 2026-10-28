import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crashDiagnostic } from './crash-diagnostic';

test('reports only allowlisted error class and bundled source locations', () => {
  const error = new TypeError('Private study content');
  error.stack = 'TypeError: Private study content\n at render (https://example.com/assets/index-ab12.js:32:456)\n at https://example.com/private-user?token=secret:1:2\n at https://example.com/assets/chunk-CD34.js:4:5';
  assert.equal(crashDiagnostic(error), 'TypeError\nindex-ab12.js:32:456\nchunk-CD34.js:4:5');
});

test('custom error names and stack content are not exposed', () => {
  const error = new Error('Private notes');
  error.name = 'Private user information';
  error.stack = 'Private stack information';
  assert.equal(crashDiagnostic(error), 'Error');
});

test('a missing stack is safe', () => {
  const error = new Error('hidden');
  error.stack = undefined;
  assert.equal(crashDiagnostic(error), 'Error');
});
