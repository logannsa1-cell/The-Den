import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { readJson, removeKey, userKey, writeJson } from '@/lib/storage';

/** Device-local metadata for a set's source files. Original bytes never sync to the account. */
export type StoredSource = {
  name: string;
  uri: string | null;
  mimeType?: string;
  size?: number;
  pages: string[];
  notice?: string;
};

const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'file';

function setDir(userId: string, setId: string) {
  return new Directory(Paths.document, 'jaguar-sources', safe(userId), safe(setId));
}

export async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => reject(new Error('Could not read that file.'));
      r.readAsDataURL(blob);
    });
  }
  return new File(uri).base64();
}

/** Copies an original into app documents so it can be reopened later on this device. */
export async function keepOriginal(userId: string, setId: string, uri: string, name: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const dir = setDir(userId, setId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${Date.now().toString(36)}-${safe(name)}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export const sourcesKey = (userId: string, setId: string) => userKey(userId, 'sources', setId);

export async function loadSources(userId: string, setId: string): Promise<StoredSource[]> {
  const list = await readJson<StoredSource[]>(sourcesKey(userId, setId), []);
  return list.map((s) => ({ ...s, uri: s.uri && originalExists(s.uri) ? s.uri : null }));
}

export function originalExists(uri: string) {
  if (Platform.OS === 'web') return false;
  try { return new File(uri).exists; } catch { return false; }
}

export function saveSources(userId: string, setId: string, list: StoredSource[]) {
  return writeJson(sourcesKey(userId, setId), list);
}

export async function deleteSources(userId: string, setId: string) {
  await removeKey(sourcesKey(userId, setId));
  if (Platform.OS === 'web') return;
  try { const dir = setDir(userId, setId); if (dir.exists) dir.delete(); } catch { /* ignore */ }
}

/** Splits the account-saved combined text back into per-file previews when no local pages exist. */
export function previewFromSourceText(sourceText: string, fallbackName: string): StoredSource[] {
  const parts = sourceText.split(/^=== Source \d+: (.+?) ===$/m);
  const out: StoredSource[] = [];
  if (parts.length < 3) out.push({ name: fallbackName, uri: null, pages: paginate(sourceText) });
  else for (let i = 1; i < parts.length; i += 2) out.push({ name: parts[i], uri: null, pages: paginate(parts[i + 1] ?? '') });
  return out;
}

export function paginate(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const slides = t.split(/\n(?=Slide \d+:)/);
  if (slides.length > 1) return slides.map((s) => s.trim());
  const pages: string[] = [];
  const paras = t.split(/\n{2,}|\n/);
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n' + p).length > 1600 && cur) { pages.push(cur.trim()); cur = p; } else cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages;
}
