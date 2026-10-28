import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { BrandLockup, ThemeSwitcher } from '@/components/Brand';
import { THEMES, useTheme } from '@/lib/theme';

type SampleMode = 'summary' | 'tutor' | 'cram' | 'objective';
const SAMPLE_SOURCE = `Photosynthesis happens in the chloroplast. The light-dependent reactions take place on the thylakoid membrane: light energy splits water, releasing oxygen, and produces ATP and NADPH. The Calvin cycle takes place in the stroma, where ATP and NADPH are used to fix carbon dioxide into glucose.`;
const SAMPLE_TABS: { id: SampleMode; label: string }[] = [
  { id: 'summary', label: 'Note Summary' }, { id: 'tutor', label: 'Tutor Lesson' }, { id: 'cram', label: 'Cram Sheet' }, { id: 'objective', label: 'Objective' },
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
  const { setTheme, theme } = useTheme();
  const [mode, setMode] = useState<SampleMode>('summary');
  return (
    <main className="landing-page calm">
      <nav className="landing-nav" aria-label="Main">
        <Link href="/" className="landing-brand" data-testid="link-home"><BrandLockup size={32} /></Link>
        <div className="landing-nav-actions">
          <ThemeSwitcher compact />
          <Link href="/sign-in" className="landing-signin" data-testid="link-sign-in">Sign in</Link>
          <Link href="/sign-up" className="landing-cta" data-testid="link-sign-up">Get started</Link>
        </div>
      </nav>

      <section className="calm-hero">
        <h1 data-testid="text-landing-heading">Use your notes to study well</h1>
        <p>Upload your course PDFs and slides. Jaguar turns them into summaries, lessons, cram sheets and exam papers, with your original pages kept beside every explanation.</p>
        <div className="hero-actions">
          <Link href="/sign-up" className="landing-cta" data-testid="link-start-studying">Start studying <ArrowRight size={15} /></Link>
          <Link href="/sign-in" className="hero-secondary" data-testid="link-returning-student">I have an account</Link>
        </div>
      </section>

      <section className="sample-preview" aria-labelledby="sample-heading">
        <div className="sample-label"><h2 id="sample-heading">Example study view</h2><span>Sample text, not your material</span></div>
        <div className="sample-tabs" role="tablist" aria-label="Example modes">
          {SAMPLE_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} className={mode === t.id ? 'on' : ''} onClick={() => setMode(t.id)} data-testid={`tab-sample-${t.id}`}>{t.label}</button>)}
        </div>
        <div className="sample-split">
          <div className="sample-output" role="tabpanel" data-testid="panel-sample"><SampleBody key={mode} mode={mode} /></div>
          <aside className="sample-source"><div className="sample-source-head">Source</div><p>{SAMPLE_SOURCE}</p></aside>
        </div>
      </section>

      <section className="calm-section">
        <h2>What you can make from one upload</h2>
        <dl className="calm-list">
          <div><dt>Note Summary</dt><dd>Long, detailed notes with headings. Hide them, recall, then reveal.</dd></div>
          <div><dt>Tutor Lesson</dt><dd>A teaching walk-through with examples, written from your material.</dd></div>
          <div><dt>Cram Sheet</dt><dd>Short points for the night before.</dd></div>
          <div><dt>Timed exam</dt><dd>Section A objective and Section B theory on a running clock. Answers stay hidden until you submit.</dd></div>
          <div><dt>Objective and theory practice</dt><dd>A to E questions with explanations, and a/b/c theory parts with model answers.</dd></div>
        </dl>
      </section>

      <section className="calm-section">
        <h2>Colour</h2>
        <div className="theme-row">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className={`theme-tile${theme.id === t.id ? ' on' : ''}`} onClick={() => setTheme(t.id)} aria-pressed={theme.id === t.id} data-testid={`button-landing-theme-${t.id}`}>
              <span style={{ background: t.accent }} />{t.label}
            </button>
          ))}
        </div>
      </section>

      <footer className="landing-footer"><BrandLockup size={24} /><Link href="/sign-up" data-testid="link-create-account-bottom">Create an account</Link><Link href="/sign-in" data-testid="link-footer-sign-in">Sign in</Link></footer>
    </main>
  );
}
