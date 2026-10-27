import { Link } from 'wouter';
import { ArrowRight, BookOpen, Columns2, ListChecks, LogIn, PenLine, Timer } from 'lucide-react';
import { BrandLockup, EMBLEM, RosetteCorners, ThemeSwitcher } from '@/components/Brand';
import { THEMES, useTheme } from '@/lib/theme';

const MODES = [
  { Icon: BookOpen, title: 'Note Summary', copy: 'Your notes rewritten as clear headings, short paragraphs and lists. Hide them, recall, reveal.' },
  { Icon: Timer, title: 'Time-Based Test or Exam', copy: 'Press start, the clock runs down. No answers shown until you submit or time is up.' },
  { Icon: ListChecks, title: 'Objective Questions', copy: 'A to E options pulled from what your course actually covered, with explanations.' },
  { Icon: PenLine, title: 'Theory Test', copy: 'Write answers for parts a, b and c, then compare with a model answer and mark yourself.' },
];

export default function Landing() {
  const { setTheme, theme } = useTheme();
  return (
    <main className="landing-page">
      <RosetteCorners />
      <nav className="landing-nav" aria-label="Main">
        <Link href="/" className="landing-brand" data-testid="link-home"><BrandLockup size={40} /></Link>
        <div className="landing-nav-actions">
          <ThemeSwitcher compact />
          <Link href="/sign-in" className="landing-signin" data-testid="link-sign-in">Sign in</Link>
          <Link href="/sign-up" className="landing-cta" data-testid="link-sign-up">Get started <ArrowRight size={15} /></Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy reveal">
          <span className="eyebrow">Jaguar · exam prep</span>
          <h1 data-testid="text-landing-heading">Use your notes to study well</h1>
          <p>Use your notes to study better.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="landing-cta hero-cta" data-testid="link-start-studying">Start studying <ArrowRight size={16} /></Link>
            <Link href="/sign-in" className="hero-secondary" data-testid="link-returning-student"><LogIn size={15} /> I have an account</Link>
          </div>
        </div>
        <div className="hero-art reveal" aria-hidden="true">
          <div className="hero-halo" />
          <img src={EMBLEM} alt="" className="hero-emblem" />
          <div className="hero-ticket t1"><Timer size={13} /> 18:42 left</div>
          <div className="hero-ticket t2"><span className="choice-letter">C</span> Calvin cycle</div>
          <div className="hero-ticket t3"><PenLine size={13} /> (b) Explain why...</div>
        </div>
      </section>

      <section className="landing-modes">
        <div className="section-kicker">01 / Four ways in</div>
        <div className="mode-board">
          {MODES.map(({ Icon, title, copy }, i) => (
            <article key={title} className={`mode-card m${i}`}>
              <span className="mode-icon"><Icon size={18} /></span>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split">
        <div className="section-kicker">02 / Side by side</div>
        <div className="split-layout">
          <h2>Notes on one side. Your slides on the other.</h2>
          <div className="split-demo">
            <div className="demo-notes"><b>Light reactions</b><i /><i /><i className="short" /><b>Calvin cycle</b><i /><i className="short" /></div>
            <div className="demo-source"><Columns2 size={16} /><span>Slide 7 / 24</span></div>
          </div>
          <p>Drop several PDFs and slide decks at once. Jaguar reads them on your device, builds one set, and keeps the pages next to the explanation so you can check every line.</p>
        </div>
      </section>

      <section className="landing-themes">
        <div className="section-kicker">03 / Your colour</div>
        <h2>Black and violet by default. Rose, Ocean or Jungle if you want.</h2>
        <div className="theme-row">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className={`theme-tile${theme.id === t.id ? ' on' : ''}`} onClick={() => setTheme(t.id)} style={{ background: t.bg, color: t.text, borderColor: theme.id === t.id ? t.accent : t.line }} data-testid={`button-landing-theme-${t.id}`}>
              <span style={{ background: t.accent }} />{t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <img src={EMBLEM} alt="" className="final-emblem" />
        <h2>Exam is soon. Start tonight.</h2>
        <Link href="/sign-up" className="landing-cta hero-cta" data-testid="link-create-account-bottom">Make your study space <ArrowRight size={16} /></Link>
      </section>
      <footer className="landing-footer"><BrandLockup size={26} /><span>Study with what you already have.</span><Link href="/sign-in" data-testid="link-footer-sign-in">Sign in</Link></footer>
    </main>
  );
}
