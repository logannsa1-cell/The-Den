export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const EMBLEM = '/__mockup/images/jaguar-icon.svg';

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

