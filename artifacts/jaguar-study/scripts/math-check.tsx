import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudyText } from '../src/components/StudyText';
import { RichNotes } from '../src/components/RichNotes';
import { SubjectPrompt } from '../src/components/SubjectPrompt';

// tsx's standalone runner uses the classic JSX runtime.
Object.assign(globalThis, { React });

for (const text of [
  String.raw`$C + 2S \rightarrow CS_2$`,
  String.raw`$CaCO_3 \rightarrow CaO + CO_2$`,
  String.raw`$\rightleftharpoons$`,
  String.raw`\(x^2 + \frac{1}{2}\)`,
  String.raw`$$\ce{2H2 + O2 -> 2H2O}$$`,
]) {
  const html = renderToStaticMarkup(<StudyText text={text} />);
  assert.ok(html.includes('class="katex'), text);
  assert.ok(html.includes('<math'), 'accessible math output');
}
const notes = renderToStaticMarkup(<RichNotes text={String.raw`**Combination:** carbon and sulfur: $C + 2S \rightarrow CS_2$.`} />);
assert.match(notes, /<strong>/);
assert.match(notes, /class="katex/);
const unsafe = renderToStaticMarkup(<StudyText text={String.raw`<script>alert(1)</script> $\href{javascript:alert(1)}{click}$`} />);
assert.ok(!unsafe.includes('<script>') && !unsafe.includes('href="javascript:'));
const malformed = renderToStaticMarkup(<StudyText text={String.raw`$\badcommand{x}$`} />);
assert.match(malformed, /could not be formatted/);
const currency = renderToStaticMarkup(<StudyText text="Costs $20 and $30 today" />);
assert.ok(!currency.includes('class="katex'));
console.log('Equation, chemistry, formatting, safety and fallback checks passed.');
const subject = renderToStaticMarkup(<SubjectPrompt text="[Chemistry] Explain $CO_2$." />);
assert.match(subject, /subject-label">Chemistry/);
assert.match(subject, /class="katex/);
assert.ok(!subject.includes('[Chemistry]'));
const legacy = renderToStaticMarkup(<SubjectPrompt text="Original saved question" />);
assert.match(legacy, /Original saved question/);
assert.ok(!legacy.includes('subject-label'));
console.log('Subject labels and legacy question rendering passed.');
