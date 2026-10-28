import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletePersonalNote, readPersonalNote, savePersonalNote } from './personal-notes';

test('personal notes save and load independently for each account and study set', () => {
  const previous = globalThis.localStorage;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  try {
    assert.equal(savePersonalNote('user/one', 'set:one', '# Recall this'), true);
    assert.equal(readPersonalNote('user/one', 'set:one'), '# Recall this');
    assert.equal(readPersonalNote('user/one', 'set:two'), '');
    assert.equal(readPersonalNote('user/two', 'set:one'), '');
    assert.equal(deletePersonalNote('user/one', 'set:one'), true);
    assert.equal(readPersonalNote('user/one', 'set:one'), '');
  } finally {
    if (previous === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('storage errors are returned instead of claiming the note was saved', () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
  } });
  try {
    assert.equal(savePersonalNote('user', 'set', 'note'), false);
    assert.equal(readPersonalNote('user', 'set'), '');
  } finally {
    if (previous === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});
