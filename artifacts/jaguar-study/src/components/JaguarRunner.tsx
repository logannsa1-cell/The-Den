export function JaguarRunner({ label }: { label: string }) {
  return (
    <div className="jaguar-runner" role="status" aria-live="polite" data-testid="status-generating">
      <div className="jaguar-track" aria-hidden="true">
        <svg className="jaguar-svg" viewBox="0 0 120 56" width="96" height="45" focusable="false">
          <g className="jaguar-body">
            {/* Far legs sit behind the shoulders and haunches. */}
            <path className="leg leg-b" d="M34 28 Q30 36 35 42 L28 49 Q24 49 24 52 L32 52 L41 42 L40 28Z" fill="var(--accent-2)" opacity=".65" />
            <path className="leg leg-a" d="M81 27 Q89 33 84 40 L94 46 Q98 46 97 50 L90 50 L76 40 L75 29Z" fill="var(--accent-2)" opacity=".65" />
            <path className="jaguar-tail" d="M88 24 C100 29 111 25 111 17 C111 10 104 9 102 13" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
            <path d="M107 10 Q111 11 111 16" fill="none" stroke="var(--accent-ink)" strokeWidth="3.5" strokeLinecap="round" />
            {/* Low head, broad shoulders, tucked belly and muscular rear. */}
            <path d="M12 18 Q8 11 13 10 Q17 9 19 15 L25 15 Q29 9 36 11 C50 13 65 10 78 13 Q91 14 94 24 Q96 32 86 35 Q77 38 68 32 Q57 29 46 34 Q35 39 27 31 L18 31 Q10 32 7 27 L5 23 Q4 20 12 18Z" fill="var(--accent)" />
            <path d="M25 27 Q34 35 45 30 Q57 26 68 29 Q76 35 85 31" fill="none" stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" opacity=".8" />
            <path d="M34 16 Q28 23 33 30 M80 17 Q88 21 85 28" fill="none" stroke="var(--accent-ink)" strokeWidth="1.2" opacity=".35" />
            {/* Broken rings with central dots read as jaguar rosettes. */}
            <g fill="none" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" opacity=".8">
              <path d="M38 17 q-4 0 -3 4 l3 2 3 -2 M49 15 l-3 2 1 4 4 0 2 -3 M61 16 l-3 -1 -2 3 2 3 3 -1 M73 17 l-3 1 0 4 4 1 2 -3 M86 21 l-3 1 0 4 3 1 M43 27 l-2 -2 -3 2 1 3 M57 25 l-3 -1 -2 3 3 2 3 -1 M69 27 l-2 -2 -3 1 0 3 3 1" />
            </g>
            <g fill="var(--accent-ink)" opacity=".9">
              <circle cx="49" cy="18" r=".8" /><circle cx="59" cy="18" r=".7" />
              <circle cx="72" cy="20" r=".8" /><circle cx="55" cy="27" r=".7" />
              <circle cx="24" cy="18" r="1.1" /><circle cx="26" cy="23" r=".9" />
              <circle cx="21" cy="26" r=".8" />
            </g>
            <path d="M12 14 Q12 11 15 13 L16 16Z" fill="var(--accent-ink)" />
            <path d="M7 24 Q13 20 18 24 L17 29 Q11 31 8 27Z" fill="var(--accent-2)" />
            <path d="M5 22 L10 22 L7 25Z" fill="var(--accent-ink)" />
            <path d="M14 19 L20 18 L18 21Z" fill="var(--accent-ink)" />
            <circle cx="16.5" cy="19.5" r=".75" fill="var(--text)" />
            <path d="M8 27 Q12 28 14 26 M12 24 L2 23 M13 26 L3 28" stroke="var(--accent-ink)" strokeWidth=".8" fill="none" strokeLinecap="round" />
            <path className="leg leg-a" d="M29 28 Q25 35 22 40 L13 46 Q8 46 8 50 L17 50 Q22 46 28 43 L37 31Z" fill="var(--accent)" />
            <path className="leg leg-b" d="M78 28 Q70 33 74 40 L82 47 Q84 50 90 49 L90 46 L84 43 L82 37 L89 30Z" fill="var(--accent)" />
            <path d="M30 31 L32 33 M81 31 L83 33" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
        <span className="jaguar-ground" />
      </div>
      <p>{label}</p>
    </div>
  );
}
