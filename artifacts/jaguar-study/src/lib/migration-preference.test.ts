import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMigrationPreference } from './migration-preference';

test('blocked storage does not throw during dashboard initialization', () => {
  assert.deepEqual(readMigrationPreference('account-key', () => { throw new DOMException('Blocked', 'SecurityError'); }), {
    available: false, preference: null,
  });
});

test('reads only the supplied account key and preserves migration choice', () => {
  for (const preference of ['sync', 'local'] as const) {
    assert.deepEqual(readMigrationPreference('account-key', (key) => {
      assert.equal(key, 'account-key');
      return preference;
    }), { available: true, preference });
  }
  assert.deepEqual(readMigrationPreference('account-key', () => null), { available: true, preference: 'pending' });
});
