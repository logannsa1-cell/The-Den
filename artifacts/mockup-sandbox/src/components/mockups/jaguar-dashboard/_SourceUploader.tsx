import { type DragEvent, useRef, useState } from 'react';
import { CheckCircle2, FileText, LoaderCircle, Paperclip, Presentation, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
// Mockup-only: no files leave the browser and no study material is generated.
async function readStudyFile(_file: File): Promise<string> { throw new Error('Design preview only. Upload files in the Jaguar app to generate materials.'); }
function sanitizeStudyText(text: string) { return {text, removedOfficeMarkup: false}; }

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_SOURCE_CHARS = 180000;
export const ACCEPTED = '.pdf,.docx,.pptx,.txt,.md,.csv';
const EXTS = ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'];

export type SourceEntry = { id: string; file: File; status: 'reading' | 'ready' | 'error'; text: string; error?: string; cleaned?: boolean };

export function combineSources(files: SourceEntry[]): string {
  const parts: string[] = [];
  files.filter((f) => f.status === 'ready').forEach((f, i) => parts.push(`=== Source ${i + 1}: ${f.file.name} ===\n${f.text}`));
  return parts.join('\n\n');
}

function sizeLabel(bytes: number) { return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }

type Props = { files: SourceEntry[]; onFiles: (fn: (prev: SourceEntry[]) => SourceEntry[]) => void; disabled?: boolean };

export function SourceUploader({ files, onFiles, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = combineSources(files).length;
  const over = total > MAX_SOURCE_CHARS;

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    const incoming = Array.from(list);
    const entries: SourceEntry[] = incoming.map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      if (!EXTS.includes(ext)) return { id, file, status: 'error', text: '', error: 'Unsupported format. Use PDF, DOCX, PPTX, TXT, MD, or CSV.' };
      if (file.size > MAX_FILE_BYTES) return { id, file, status: 'error', text: '', error: `This file is ${sizeLabel(file.size)}. Each file must be 15 MB or less.` };
      return { id, file, status: 'reading', text: '' };
    });
    onFiles((prev) => [...prev, ...entries]);
    entries.filter((e) => e.status === 'reading').forEach(async (entry) => {
      let patch: Partial<SourceEntry>;
      try {
        const cleaned = sanitizeStudyText(await readStudyFile(entry.file));
        if (cleaned.text.trim().length < 30) {
          patch = { status: 'error', error: cleaned.removedOfficeMarkup ? 'Only Office formatting was found, no readable text. Export as a searchable PDF.' : 'Not enough readable text. Scanned pages and image-only slides cannot be read yet.' };
        } else patch = { status: 'ready', text: cleaned.text, cleaned: cleaned.removedOfficeMarkup };
      } catch (cause) {
        patch = { status: 'error', error: cause instanceof Error ? cause.message : 'This file could not be read.' };
      }
      onFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, ...patch } : f)));
    });
    if (input.current) input.current.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); if (!disabled) addFiles(e.dataTransfer.files); };

  return (
    <div className="source-uploader">
      <div className={`upload-zone${dragging ? ' dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <span className="upload-icon"><Upload size={17} /></span>
        <div className="upload-copy"><strong>Drop course files here</strong><span>PDF, DOCX, PPTX, TXT, MD, CSV. Pick several at once. 15 MB each.</span></div>
        <button className="file-button" type="button" disabled={disabled} onClick={() => input.current?.click()} data-testid="button-browse"><Paperclip size={13} /> Add files</button>
        <input ref={input} className="sr-only" type="file" multiple accept={ACCEPTED} onChange={(e) => addFiles(e.target.files)} data-testid="input-file" aria-label="Choose study files" />
      </div>

      {files.length > 0 && (
        <ul className="file-list" data-testid="list-source-files">
          {files.map((f) => {
            const ext = f.file.name.split('.').pop()?.toLowerCase();
            const Icon = ext === 'pptx' ? Presentation : FileText;
            return (
              <li key={f.id} className={`file-row ${f.status}`} data-testid={`row-file-${f.id}`}>
                <span className="file-icon"><Icon size={14} /></span>
                <span className="file-meta">
                  <strong>{f.file.name}</strong>
                  <small>
                    {f.status === 'reading' && <><LoaderCircle size={11} className="spin-icon" /> Reading on this device</>}
                    {f.status === 'ready' && <><CheckCircle2 size={11} /> Ready · {f.text.length.toLocaleString()} characters{f.cleaned ? ' · Office markup removed' : ''}</>}
                    {f.status === 'error' && <><TriangleAlert size={11} /> {f.error}</>}
                  </small>
                </span>
                <button className="icon-button" type="button" onClick={() => onFiles((prev) => prev.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.file.name}`} data-testid={`button-remove-file-${f.id}`}><X size={13} /></button>
              </li>
            );
          })}
          <li className="file-list-foot">
            <span>{files.filter((f) => f.status === 'ready').length} of {files.length} ready</span>
            <button type="button" className="text-button" onClick={() => onFiles(() => [])} data-testid="button-clear-files"><Trash2 size={12} /> Clear files</button>
          </li>
        </ul>
      )}

      <div className={`char-meter${over ? ' over' : ''}`} data-testid="text-char-count">
        <span style={{ transform: `scaleX(${Math.min(1, total / MAX_SOURCE_CHARS)})` }} />
        <em>{total.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()} characters combined</em>
      </div>
      {over && <p className="field-error" role="alert" data-testid="error-char-limit">Combined sources are {(total - MAX_SOURCE_CHARS).toLocaleString()} characters over the limit. Remove a file or upload a smaller document. Nothing is cut off silently.</p>}
    </div>
  );
}
