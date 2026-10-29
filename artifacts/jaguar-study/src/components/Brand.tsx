import { Check, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { THEMES, useTheme } from '@/lib/theme';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const EMBLEM = `${basePath}/jaguar-outline.png`;

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
    const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="theme-switch" ref={ref} data-open={open}>
      <button type="button" className="theme-trigger" aria-haspopup="true" aria-expanded={open} aria-label={`Color theme: ${theme.label}`} onClick={() => setOpen((value) => !value)} data-testid="button-theme">
        <Palette size={14} aria-hidden="true" />
        <span className="theme-swatch" style={{ background: theme.accent }} />
        {!compact && <span>{theme.label}</span>}
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Choose a color theme">
          {THEMES.map((option) => (
            <button key={option.id} type="button" role="menuitemradio" aria-checked={theme.id === option.id} className="theme-option" onClick={() => { setTheme(option.id); setOpen(false); }} data-testid={`button-theme-${option.id}`}>
              <span className="theme-swatch lg" style={{ background: option.accent }} />
              {option.label}{theme.id === option.id && <Check size={14} className="ml-auto" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
