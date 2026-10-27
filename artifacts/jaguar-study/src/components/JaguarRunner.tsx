export function JaguarRunner({ label }: { label: string }) {
  return (
    <div className="jaguar-runner" role="status" aria-live="polite" data-testid="status-generating">
      <div className="jaguar-track" aria-hidden="true">
        <svg className="jaguar-svg" viewBox="0 0 120 56" width="96" height="45">
          <g className="jaguar-body">
            <path d="M14 22 q-6 -8 2 -12 l4 5 q6 -2 12 1 q20 -4 44 0 q14 2 22 8 q8 -2 16 -10 q2 4 -2 9 q-6 7 -14 7 q-6 8 -22 8 q-24 2 -40 -2 q-10 -1 -16 -6 q-6 2 -8 -2 z" fill="var(--accent)" />
            <circle cx="16" cy="19" r="1.6" fill="var(--accent-ink)" />
            <circle cx="44" cy="24" r="2" fill="var(--accent-ink)" opacity=".5" /><circle cx="58" cy="21" r="2.2" fill="var(--accent-ink)" opacity=".5" />
            <circle cx="72" cy="26" r="2" fill="var(--accent-ink)" opacity=".5" /><circle cx="84" cy="22" r="1.8" fill="var(--accent-ink)" opacity=".5" />
          </g>
          <rect className="leg leg-a" x="30" y="32" width="4" height="16" rx="2" fill="var(--accent)" />
          <rect className="leg leg-b" x="38" y="32" width="4" height="16" rx="2" fill="var(--accent-2)" />
          <rect className="leg leg-a" x="78" y="32" width="4" height="16" rx="2" fill="var(--accent)" />
          <rect className="leg leg-b" x="86" y="32" width="4" height="16" rx="2" fill="var(--accent-2)" />
        </svg>
        <span className="jaguar-ground" />
      </div>
      <p>{label}</p>
    </div>
  );
}
