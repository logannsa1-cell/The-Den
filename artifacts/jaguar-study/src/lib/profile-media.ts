import { useCallback, useEffect, useState } from 'react';
import { deleteSources, loadSources, saveSources } from '@/lib/source-store';

export type MediaKind = 'avatar' | 'banner';
export const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MEDIA_LIMIT: Record<MediaKind, number> = { avatar: 3 * 1024 * 1024, banner: 6 * 1024 * 1024 };

const keyFor = (userId: string, kind: MediaKind) => `profile:${userId}:${kind}`;

export function validateMedia(file: File, kind: MediaKind): string {
  if (!MEDIA_TYPES.includes(file.type)) return 'Use a PNG, JPG, WEBP, or GIF image.';
  if (file.size > MEDIA_LIMIT[kind]) return `Image must be ${MEDIA_LIMIT[kind] / 1048576} MB or less.`;
  return '';
}

/** Image bytes live in this device's IndexedDB only, keyed per user. Rendered with object URLs that are revoked on cleanup. */
export function useProfileMedia(userId: string, kind: MediaKind) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) { setBlob(null); setLoading(false); return; }
    let alive = true;
    setBlob(null);
    setLoading(true);
    loadSources(keyFor(userId, kind)).then((s) => { if (alive) { setBlob(s[0]?.blob ?? null); setLoading(false); } });
    return () => { alive = false; };
  }, [userId, kind]);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const save = useCallback(async (file: File) => {
    await saveSources(keyFor(userId, kind), [{ name: file.name, type: file.type, blob: file }]);
    setBlob(file);
  }, [userId, kind]);
  const remove = useCallback(async () => { await deleteSources(keyFor(userId, kind)); setBlob(null); }, [userId, kind]);
  return { url, loading, save, remove };
}
