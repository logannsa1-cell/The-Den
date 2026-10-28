import { Check, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { THEMES, useTheme } from '@/lib/theme';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const EMBLEM = `${basePath}/jaguar-outline.svg`;

export function Emblem({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={EMBLEM} alt="" width={size} height={size} className={`emblem ${className}`} style={{ width: size, height: size }} />;
}

export function BrandLockup({ size = 40, caption }: { size?: number; caption?: string }) {
  return (
    <span className="brand-lockup">
      <Emblem size={size} />
      <span><span className="brand-name">Jaguar</span>{caption && <span className="brand-caption">{caption}</span>}</span>
    </span>
  );
}

export function RosetteCorners() {
  return (
    <div className="rosette-layer" aria-hidden="true">
      <span className="rosettes rosettes-tl" />
      <span className="rosettes rosettes-br" />
      <img src={EMBLEM} alt="" className="corner-jaguar" />
    </div>
  );
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="theme-switch" ref={ref}>
      <button type="button" className="theme-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="button-theme">
        <Palette size={14} aria-hidden="true" /><span className="theme-swatch" style={{ background: theme.accent }} />{!compact && <span>{theme.label}</span>}
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="menuitemradio" aria-checked={theme.id === t.id} className="theme-option" onClick={() => { setTheme(t.id); setOpen(false); }} data-testid={`button-theme-${t.id}`}>
              <span className="theme-swatch lg" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }} />
              {t.label}{theme.id === t.id && <Check size={13} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
