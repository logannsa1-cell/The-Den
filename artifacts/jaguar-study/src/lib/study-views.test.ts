import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setViews, studyViews } from './study-views';

test('all selected modes expose each view once in stable order', () => {
  const views = studyViews(['theory', 'cram', 'objective', 'summary', 'tutor', 'timed', 'summary']);
  assert.deepEqual(views.map(v => v.id), ['timed', 'tutor', 'summary', 'terms', 'flashcards', 'objective', 'cram', 'theory']);
  assert.ok(views.every(v => v.label && v.Icon));
});

test('notes bring their related views but exam-only sets do not', () => {
  assert.deepEqual(studyViews(['summary']).map(v => v.id), ['summary', 'terms', 'flashcards']);
  assert.deepEqual(studyViews(['timed', 'theory']).map(v => v.id), ['timed', 'theory']);
});

test('legacy sets retain notes, objective and existing cram content', () => {
  assert.deepEqual(setViews({ modes: [], cramPoints: ['Revision point'] }).map(v => v.id),
    ['summary', 'terms', 'flashcards', 'objective', 'cram']);
  assert.deepEqual(setViews({ cramPoints: [] }).map(v => v.id), ['summary', 'terms', 'flashcards', 'objective']);
});

test('explicit modes do not acquire unselected cram and empty lists remain usable', () => {
  assert.deepEqual(setViews({ modes: ['tutor'], cramPoints: ['old content'] }).map(v => v.id), ['tutor']);
  assert.deepEqual(studyViews([]).map(v => v.id), ['summary']);
});
