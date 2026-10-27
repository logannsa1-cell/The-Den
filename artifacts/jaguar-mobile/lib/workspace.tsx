import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import {
  extractStudySource, getListStudySetsQueryKey, useDeleteStudySet, useExtractStudySource, useGenerateStudyMaterials, useListStudySets, useUpsertStudySet,
} from '@workspace/api-client-react';
import {
  ALL_MODES, EXTS, MAX_FILE_BYTES, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, clean, errorMessage, intIn, newId, sizeLabel, toInput,
  type StudyMode, type StudySet,
} from '@/lib/study';
import { readJson, userKey, writeJson } from '@/lib/storage';
import { deleteSources, keepOriginal, paginate, readBase64, saveSources, type StoredSource } from '@/lib/sources';

export type SourceEntry = {
  id: string; name: string; uri: string; size: number; mimeType?: string;
  status: 'queued' | 'reading' | 'ready' | 'error' | 'cancelled';
  text: string; pages: string[]; notice?: string; error?: string; offline?: boolean;
};

export type GenState =
  | { phase: 'idle' }
  | { phase: 'generating'; modes: StudyMode[] }
  | { phase: 'error'; modes: StudyMode[]; message: string; offline: boolean }
  | { phase: 'done'; setId: string; synced: boolean }
  /** Generated, but neither the account nor this device could store it. Held in memory only. */
  | { phase: 'unsaved'; set: StudySet; message: string };

type Ctx = {
  userId: string;
  sets: StudySet[];
  remoteIds: Set<string>;
  backups: StudySet[];
  query: ReturnType<typeof useListStudySets>;
  files: SourceEntry[];
  addFiles: (picked: { uri: string; name: string; size?: number | null; mimeType?: string | null }[]) => void;
  removeFile: (id: string) => void;
  retryFile: (id: string) => void;
  cancelReading: () => void;
  clearFiles: () => void;
  readingIndex: { current: number; total: number } | null;
  combinedLength: number;
  consent: boolean | null;
  giveConsent: () => void;
  modes: StudyMode[];
  setModes: (m: StudyMode[]) => void;
  questionCount: string; setQuestionCount: (v: string) => void;
  examMinutes: string; setExamMinutes: (v: string) => void;
  validate: () => string;
  gen: GenState;
  generate: () => Promise<string | null>;
  resetGen: () => void;
  retryUnsaved: () => Promise<void>;
  retrySave: (set: StudySet) => Promise<boolean>;
  savingIds: Set<string>;
  deleteSet: (set: StudySet) => Promise<boolean>;
  updateMastered: (set: StudySet, term: string, ok: boolean) => void;
  getSet: (id: string) => StudySet | undefined;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

function combine(files: SourceEntry[]) {
  return files.filter((f) => f.status === 'ready').map((f, i) => `=== Source ${i + 1}: ${f.name} ===\n${f.text}`).join('\n\n');
}
function sourceLabel(files: SourceEntry[]) {
  const names = files.filter((f) => f.status === 'ready').map((f) => f.name);
  const label = names.length > 2 ? `${names[0]}, ${names[1]} +${names.length - 2} more` : names.join(', ');
  return (label || 'Notes').slice(0, 160);
}

/** Mounted once per signed-in user (keyed by userId) so no state leaks across accounts. */
export function WorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => [...getListStudySetsQueryKey(), userId] as const, [userId]);
  const query = useListStudySets({
    query: { queryKey, enabled: !!userId, staleTime: 0, refetchInterval: 15000, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always' },
  });
  const abortRef = useRef<AbortController | null>(null);
  const extract = useExtractStudySource({
    mutation: { mutationFn: ({ data }) => extractStudySource(data, { signal: abortRef.current?.signal }) },
  });
  const generateM = useGenerateStudyMaterials();
  const upsert = useUpsertStudySet();
  const remove = useDeleteStudySet();
  const extractRef = useRef(extract.mutateAsync); extractRef.current = extract.mutateAsync;
  const generateRef = useRef(generateM.mutateAsync); generateRef.current = generateM.mutateAsync;
  const upsertRef = useRef(upsert.mutateAsync); upsertRef.current = upsert.mutateAsync;
  const removeRef = useRef(remove.mutateAsync); removeRef.current = remove.mutateAsync;

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const backupKey = userKey(userId, 'backups');
  const [backups, setBackups] = useState<StudySet[]>([]);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [modes, setModesRaw] = useState<StudyMode[]>([...ALL_MODES]);
  const [questionCount, setQuestionCount] = useState('50');
  const [examMinutes, setExamMinutes] = useState('120');
  const [files, setFiles] = useState<SourceEntry[]>([]);
  const filesRef = useRef<SourceEntry[]>([]); filesRef.current = files;
  const [gen, setGen] = useState<GenState>({ phase: 'idle' });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const busyReading = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    readJson<StudySet[]>(backupKey, []).then((b) => { if (alive.current) setBackups(Array.isArray(b) ? b : []); });
    readJson<boolean>(userKey(userId, 'upload-consent'), false).then((v) => { if (alive.current) setConsent(!!v); });
    readJson<StudyMode[] | null>(userKey(userId, 'modes'), null).then((m) => {
      if (alive.current && Array.isArray(m)) { const v = ALL_MODES.filter((x) => m.includes(x)); if (v.length) setModesRaw(v); }
    });
  }, [backupKey, userId]);

  // Only reflect a backup in state once it is really on disk.
  const writeBackups = useCallback(async (next: StudySet[]) => {
    const ok = await writeJson(backupKey, next);
    if (ok && alive.current) setBackups(next);
    return ok;
  }, [backupKey]);
  const consentRef = useRef(consent); consentRef.current = consent;

  // Native has no window focus: refetch saved sets when the app returns to the foreground.
  const refetchRef = useRef(query.refetch); refetchRef.current = query.refetch;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && alive.current) void refetchRef.current(); });
    return () => { sub.remove(); abortRef.current?.abort(); };
  }, []);
  const backupsRef = useRef(backups); backupsRef.current = backups;

  const remoteSets = useMemo(() => (query.data ?? []) as StudySet[], [query.data]);
  const remoteIds = useMemo(() => new Set(remoteSets.map((s) => s.id)), [remoteSets]);
  // A pending local backup wins over the account copy with the same id until it is confirmed saved.
  const sets = useMemo(() => {
    const local = new Map(backups.map((b) => [b.id, b]));
    return [...backups.filter((b) => !remoteIds.has(b.id)), ...remoteSets.map((r) => local.get(r.id) ?? r)];
  }, [backups, remoteSets, remoteIds]);

  // Drop a backup only when the account copy is confirmed identical; otherwise it may hold newer edits.
  useEffect(() => {
    if (!query.isSuccess) return;
    const same = (b: StudySet) => {
      const r = remoteSets.find((x) => x.id === b.id);
      return !!r && JSON.stringify(toInput(r)) === JSON.stringify(toInput(b));
    };
    if (backupsRef.current.some(same)) void writeBackups(backupsRef.current.filter((b) => !same(b)));
  }, [remoteSets, query.isSuccess, writeBackups]);

  const putRemote = useCallback((saved: StudySet) => {
    qc.setQueryData<StudySet[]>(queryKey as unknown as readonly unknown[], (old) => [saved, ...(old ?? []).filter((s) => s.id !== saved.id)]);
  }, [qc, queryKey]);

  /* ---------- extraction: one file at a time, visible progress ---------- */
  const pump = useCallback(async () => {
    if (busyReading.current) return;
    busyReading.current = true;
    cancelled.current = false;
    try {
      for (;;) {
        if (!alive.current || cancelled.current || !consentRef.current) break;
        const next = filesRef.current.find((f) => f.status === 'queued');
        if (!next) break;
        setFiles((prev) => prev.map((f) => (f.id === next.id ? { ...f, status: 'reading', error: undefined } : f)));
        let patch: Partial<SourceEntry>;
        try {
          const base64 = await readBase64(next.uri);
          if (!alive.current || cancelled.current) throw new Error('cancelled');
          abortRef.current = new AbortController();
          const res = await extractRef.current({ data: { name: next.name, base64 } });
          abortRef.current = null;
          const text = clean(res.text ?? '');
          if (text.replace(/\s/g, '').length < 20) {
            patch = { status: 'error', error: res.notice || 'No readable text was found. Scanned or image-only pages cannot be read; export the file with selectable text.' };
          } else {
            patch = { status: 'ready', text, pages: res.pages?.length ? res.pages.map((p) => clean(p)) : paginate(text), notice: res.notice || undefined };
          }
        } catch (cause) {
          const e = errorMessage(cause);
          patch = { status: 'error', error: e.text, offline: e.offline };
        }
        if (!alive.current) break;
        if (cancelled.current) patch = { status: 'cancelled', error: 'Reading cancelled.' };
        setFiles((prev) => prev.map((f) => (f.id === next.id && (f.status === 'reading' || f.status === 'cancelled') ? { ...f, ...patch } : f)));
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      busyReading.current = false;
    }
  }, []);

  useEffect(() => {
    if (files.some((f) => f.status === 'queued') && !busyReading.current) void pump();
  }, [files, pump]);

  const addFiles: Ctx['addFiles'] = (picked) => {
    // Files are only sent for extraction after the upload disclosure is accepted.
    if (!consentRef.current) return;
    const entries: SourceEntry[] = picked.map((p) => {
      const ext = p.name.split('.').pop()?.toLowerCase() ?? '';
      const base: SourceEntry = { id: newId(), name: p.name, uri: p.uri, size: p.size ?? 0, mimeType: p.mimeType ?? undefined, status: 'queued', text: '', pages: [] };
      if (!EXTS.includes(ext)) return { ...base, status: 'error', error: 'Unsupported format. Use PDF, DOCX, PPTX, TXT, MD or CSV.' };
      if ((p.size ?? 0) > MAX_FILE_BYTES) return { ...base, status: 'error', error: `This file is ${sizeLabel(p.size ?? 0)}. Each file must be 15 MB or less.` };
      return base;
    });
    setFiles((prev) => [...prev, ...entries]);
    if (gen.phase === 'error') setGen({ phase: 'idle' });
  };
  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const retryFile = (id: string) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'queued', error: undefined } : f)));
  const cancelReading = () => {
    cancelled.current = true;
    abortRef.current?.abort();
    setFiles((prev) => prev.map((f) => (f.status === 'queued' || f.status === 'reading' ? { ...f, status: 'cancelled', error: 'Reading cancelled.' } : f)));
  };
  const clearFiles = () => { cancelled.current = true; abortRef.current?.abort(); setFiles([]); };

  const inQueue = files.filter((f) => f.status === 'queued' || f.status === 'reading' || f.status === 'ready');
  const readingIndex = files.some((f) => f.status === 'reading')
    ? { current: inQueue.filter((f) => f.status === 'ready').length + 1, total: inQueue.length }
    : null;
  const combinedLength = combine(files).length;

  const giveConsent = () => { setConsent(true); void writeJson(userKey(userId, 'upload-consent'), true); };
  const setModes = (m: StudyMode[]) => { setModesRaw(m); void writeJson(userKey(userId, 'modes'), m); };

  const count = intIn(questionCount, 1, 50);
  const minutes = intIn(examMinutes, 1, 180);
  const needsCount = modes.includes('objective') || modes.includes('timed');

  const validate = () => {
    if (!modes.length) return 'Pick at least one mode.';
    if (needsCount && count === null) return 'Objective questions must be a whole number from 1 to 50.';
    if (modes.includes('timed') && minutes === null) return 'Exam minutes must be a whole number from 1 to 180.';
    if (files.some((f) => f.status === 'reading' || f.status === 'queued')) return 'Wait for your files to finish reading.';
    if (files.some((f) => f.status === 'error' || f.status === 'cancelled')) return 'Remove or retry files that could not be read. Every included file must be readable.';
    const text = combine(files);
    if (text.replace(/=== Source[^\n]*===/g, '').trim().length < MIN_SOURCE_CHARS) return 'Add a readable file with at least 120 characters of course material.';
    if (text.length > MAX_SOURCE_CHARS) return `Combined files are ${text.length.toLocaleString()} characters, over the ${MAX_SOURCE_CHARS.toLocaleString()} limit. Remove a file; nothing is cut off automatically.`;
    return '';
  };

  const saveToAccount = useCallback(async (set: StudySet): Promise<boolean> => {
    if (!alive.current) return false;
    setSavingIds((s) => new Set(s).add(set.id));
    try {
      const saved = await upsertRef.current({ id: set.id, data: toInput(set) });
      if (!alive.current) return true;
      putRemote(saved as StudySet);
      // Remove the backup only if it is the exact version that was just saved.
      const sent = JSON.stringify(toInput(set));
      await writeBackups(backupsRef.current.filter((b) => !(b.id === set.id && JSON.stringify(toInput(b)) === sent)));
      return true;
    } catch {
      return false;
    } finally {
      if (alive.current) setSavingIds((s) => { const n = new Set(s); n.delete(set.id); return n; });
    }
  }, [putRemote, writeBackups]);

  const generate = async (): Promise<string | null> => {
    if (gen.phase === 'generating') return null;
    const invalid = validate();
    if (invalid) return invalid;
    const snapshot = files.filter((f) => f.status === 'ready');
    const sourceText = combine(snapshot);
    const sourceName = sourceLabel(snapshot);
    const chosen = [...modes];
    setGen({ phase: 'generating', modes: chosen });
    try {
      const result = await generateRef.current({
        data: {
          sourceName, sourceText, hoursPerDay: 1,
          questionCount: needsCount && count ? count : 10,
          modes: chosen,
          ...(chosen.includes('timed') && minutes ? { examMinutes: minutes } : {}),
        },
      });
      if (!alive.current) return null;
      const created: StudySet = {
        ...result,
        modes: result.modes ?? chosen,
        ...(chosen.includes('timed') && minutes ? { examMinutes: result.examMinutes ?? minutes } : {}),
        id: newId(), sourceName, sourceText, createdAt: new Date().toISOString(), masteredTerms: [],
      };
      // Safe per-user backup first, so a failed account save never loses the generated set.
      const backedUp = await writeBackups([created, ...backupsRef.current.filter((b) => b.id !== created.id)]);
      if (!alive.current) return null;
      const stored: StoredSource[] = [];
      for (const f of snapshot) {
        const uri = await keepOriginal(userId, created.id, f.uri, f.name);
        stored.push({ name: f.name, uri, mimeType: f.mimeType, size: f.size, pages: f.pages, notice: f.notice });
      }
      if (!alive.current) return null;
      await saveSources(userId, created.id, stored);
      if (!alive.current) return null;
      const synced = await saveToAccount(created);
      if (!alive.current) return null;
      if (!synced && !backedUp) {
        setGen({ phase: 'unsaved', set: created, message: 'Your materials were generated but could not be saved to your account or this device. Keep the app open and retry saving.' });
        return null;
      }
      setGen({ phase: 'done', setId: created.id, synced });
      setFiles([]);
      return null;
    } catch (cause) {
      const e = errorMessage(cause);
      if (alive.current) setGen({ phase: 'error', modes: chosen, message: e.text, offline: e.offline });
      return null;
    }
  };

  const retryUnsaved = async () => {
    if (gen.phase !== 'unsaved') return;
    const set = gen.set;
    const synced = await saveToAccount(set);
    const backedUp = synced || (await writeBackups([set, ...backupsRef.current.filter((b) => b.id !== set.id)]));
    if (!alive.current) return;
    if (synced || backedUp) { setGen({ phase: 'done', setId: set.id, synced }); setFiles([]); }
    else setGen({ phase: 'unsaved', set, message: 'Still not saved. Check your connection and free some storage, then retry.' });
  };

  const deleteSet = async (set: StudySet) => {
    try {
      if (remoteIds.has(set.id)) {
        await removeRef.current({ id: set.id });
        qc.setQueryData<StudySet[]>(queryKey as unknown as readonly unknown[], (old) => (old ?? []).filter((s) => s.id !== set.id));
      }
      if (backupsRef.current.some((b) => b.id === set.id) && !(await writeBackups(backupsRef.current.filter((b) => b.id !== set.id)))) return false;
      await deleteSources(userId, set.id);
      return true;
    } catch {
      return false;
    }
  };

  const updateMastered = (set: StudySet, term: string, ok: boolean) => {
    const m = new Set(set.masteredTerms ?? []);
    if (ok) m.add(term); else m.delete(term);
    const updated = { ...set, masteredTerms: Array.from(m) };
    if (remoteIds.has(set.id)) {
      putRemote(updated);
      upsertRef.current({ id: set.id, data: toInput(updated) }).catch(() => {
        // Keep the newer progress locally instead of losing it.
        if (alive.current) void writeBackups([updated, ...backupsRef.current.filter((b) => b.id !== set.id)]);
      });
    } else {
      void writeBackups(backupsRef.current.map((b) => (b.id === set.id ? updated : b)));
    }
  };

  const value: Ctx = {
    userId, sets, remoteIds, backups, query, files, addFiles, removeFile, retryFile, cancelReading, clearFiles, readingIndex, combinedLength,
    consent, giveConsent, modes, setModes, questionCount, setQuestionCount, examMinutes, setExamMinutes, validate,
    gen, generate, resetGen: () => setGen({ phase: 'idle' }), retryUnsaved, retrySave: saveToAccount, savingIds, deleteSet, updateMastered,
    getSet: (id) => sets.find((s) => s.id === id),
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
