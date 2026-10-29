const escapeColor = (value: string) => (/^#[\da-f]{6}$/i.test(value) ? value : '#a996c2');

export function jaguarSvgMarkup(accent: string, background: string | null = '#0b0b0d') {
  const color = escapeColor(accent);
  const backdrop = background ? `<rect width="48" height="48" rx="11" fill="${escapeColor(background)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">${backdrop}
    <rect x="1" y="1" width="46" height="46" rx="10" stroke="${color}" stroke-width="1.5"/>
    <path d="M12 16.5 9 9l10 4.5M36 16.5 39 9l-10 4.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 17c2.6-3.1 6.6-4.7 12-4.7s9.4 1.6 12 4.7l-1.3 13.1c-.4 4.1-4.8 7.6-10.7 9.4-5.9-1.8-10.3-5.3-10.7-9.4L12 17Z" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M15.5 20.8c2.2-1.8 4.5-1.8 6.8 0M25.7 20.8c2.3-1.8 4.6-1.8 6.8 0" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="m16.7 18.5 2 2.8m-5.2-1 2.7 2.4m15.1-4.2-2 2.8m5.2-1-2.7 2.4" stroke="${color}" stroke-opacity=".74" stroke-width="1.2" stroke-linecap="round"/>
    <path d="m21 28.1 3-1.3 3 1.3-3 2.4-3-2.4Z" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M24 30.5v2.3m0 0c-1.2 1.5-3 2.2-5.2 2m5.2-2c1.2 1.5 3 2.2 5.2 2M16 30l-4-1.5m4.7 4-4.6.2m19.9-2.7 4-1.5m-4.7 4 4.6.2" stroke="${color}" stroke-width="1.25" stroke-linecap="round"/>
  </svg>`;
}

export function jaguarEmblemDataUri(accent: string, background: string | null = '#0b0b0d') {
  return `data:image/svg+xml,${encodeURIComponent(jaguarSvgMarkup(accent, background))}`;
}
