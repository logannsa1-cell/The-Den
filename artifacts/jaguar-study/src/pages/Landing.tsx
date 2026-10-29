import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { BrandLockup, ThemeSwitcher } from '@/components/Brand';

type SampleMode = 'summary' | 'tutor' | 'cram' | 'objective';
const SAMPLE_SOURCE = `Photosynthesis happens in the chloroplast. The light-dependent reactions take place on the thylakoid membrane: light energy splits water, releasing oxygen, and produces ATP and NADPH. The Calvin cycle takes place in the stroma, where ATP and NADPH are used to fix carbon dioxide into glucose.`;
const SAMPLE_TABS: { id: SampleMode; label: string }[] = [
  { id: 'summary', label: 'Note summary' }, { id: 'tutor', label: 'Tutor lesson' }, { id: 'cram', label: 'Cram sheet' }, { id: 'objective', label: 'Objective questions' },
];

function SampleBody({ mode }: { mode: SampleMode }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (mode === 'summary') return (<div className="sample-doc summary-doc">
    <h4>Photosynthesis</h4>
    <p>Photosynthesis happens in the chloroplast and runs in two linked stages.</p>
    <h5>1. Light-dependent reactions</h5>
    <ul><li>Location: thylakoid membrane.</li><li>Light energy splits water, so oxygen is released.</li><li>Products passed on: ATP and NADPH.</li></ul>
    <h5>2. Calvin cycle</h5>
    <ul><li>Location: stroma.</li><li>Uses ATP and NADPH to fix carbon dioxide into glucose.</li></ul>
  </div>);
  if (mode === 'tutor') return (<div className="sample-doc tutor-doc">
    <p>Think of the chloroplast as a small factory with two rooms. In the first room, the thylakoid membrane, light is the power supply. That energy splits water, which is why plants release oxygen.</p>
    <p>The first room does not make sugar. It charges two carriers, ATP and NADPH, and sends them to the second room, the stroma.</p>
    <p className="doc-check"><b>Check yourself:</b> if light stops, why would the Calvin cycle soon slow down too?</p>
  </div>);
  if (mode === 'cram') return (<ol className="sample-doc cram-doc">
    <li>Chloroplast: two stages.</li><li>Thylakoid: light splits water, gives O<sub>2</sub>, ATP, NADPH.</li><li>Stroma: Calvin cycle fixes CO<sub>2</sub> into glucose.</li><li>No light, no ATP/NADPH, Calvin cycle stalls.</li>
  </ol>);
  const choices = ['Thylakoid membrane', 'Stroma', 'Nucleus', 'Cell wall', 'Mitochondrion'];
  return (<div className="sample-doc exam-doc">
    <p><b>1.</b> Where does the Calvin cycle take place?</p>
    <div className="sample-choices">{choices.map((c, i) => (
      <button key={c} type="button" className={picked === i ? (i === 1 ? 'right' : 'wrong') : ''} onClick={() => setPicked(i)} data-testid={`button-sample-choice-${i}`}>
        <span>{String.fromCharCode(65 + i)}.</span> {c}
      </button>))}
    </div>
    {picked !== null && <p className="sample-feedback" data-testid="text-sample-feedback">{picked === 1 ? 'Correct. The source places the Calvin cycle in the stroma.' : 'Not quite. The source says the Calvin cycle takes place in the stroma (B).'}</p>}
  </div>);
}

export default function Landing() {
  const [mode, setMode] = useState<SampleMode>('summary');
  return (
    <main className="landing-page calm">
      <nav className="landing-nav" aria-label="Main">
        <Link href="/" className="landing-brand" data-testid="link-home"><BrandLockup size={32} /></Link>
        <div className="landing-nav-actions">
          <ThemeSwitcher compact />
          <Link href="/sign-in" className="landing-signin" data-testid="link-sign-in">Sign in</Link>
          <Link href="/sign-up" className="landing-cta" data-testid="link-sign-up">Create account</Link>
        </div>
      </nav>

      <section className="calm-hero">
        <h1 data-testid="text-landing-heading">Use your notes to study <em className="editorial-accent">well</em></h1>
        <p>Add a PDF or slide deck. Read a summary or lesson, then try questions with the source open beside it.</p>
        <div className="hero-actions">
          <Link href="/sign-up" className="landing-cta" data-testid="link-start-studying">Create account <ArrowRight size={15} /></Link>
          <Link href="/sign-in" className="hero-secondary" data-testid="link-returning-student">Sign in instead</Link>
        </div>
      </section>

      <section className="sample-preview" aria-labelledby="sample-heading">
        <div className="sample-label"><h2 id="sample-heading">Example: Photosynthesis</h2><span>Sample only</span></div>
        <div className="sample-tabs" role="tablist" aria-label="Example modes">
          {SAMPLE_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} className={mode === t.id ? 'on' : ''} onClick={() => setMode(t.id)} data-testid={`tab-sample-${t.id}`}>{t.label}</button>)}
        </div>
        <div className="sample-split">
          <div className="sample-output" role="tabpanel" data-testid="panel-sample"><SampleBody key={mode} mode={mode} /></div>
          <aside className="sample-source"><div className="sample-source-head">Source</div><p>{SAMPLE_SOURCE}</p></aside>
        </div>
      </section>

      <section className="calm-section">
        <h2>Choose how to study</h2>
        <dl className="calm-list">
          <div><dt>Note summary</dt><dd>Detailed notes, split into sections. Hide them to check what you remember.</dd></div>
          <div><dt>Tutor lesson</dt><dd>A step-by-step explanation, with examples where they help.</dd></div>
          <div><dt>Cram sheet</dt><dd>The points to go over before exam day.</dd></div>
          <div><dt>Timed exam</dt><dd>Multiple choice, then written questions. See the answers after you submit.</dd></div>
          <div><dt>Practice questions</dt><dd>Choose A–E for multiple choice, or write answers to parts a, b and c.</dd></div>
        </dl>
      </section>

      <footer className="landing-footer"><BrandLockup size={24} /><Link href="/sign-up" data-testid="link-create-account-bottom">Create an account</Link><Link href="/sign-in" data-testid="link-footer-sign-in">Sign in</Link></footer>
    </main>
  );
}
