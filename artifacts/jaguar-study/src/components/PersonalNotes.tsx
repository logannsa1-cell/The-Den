import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { readPersonalNote, savePersonalNote } from '@/lib/personal-notes';
import { RichNotes } from './RichNotes';

const MAX_NOTE_LENGTH = 30000;

export function PersonalNotes({ userId, setId }: { userId: string; setId: string }) {
  const [note, setNote] = useState(() => readPersonalNote(userId, setId));
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(() => savePersonalNote(userId, setId, readPersonalNote(userId, setId)));

  const update = (value: string) => {
    const next = value.slice(0, MAX_NOTE_LENGTH);
    setNote(next);
    setSaved(savePersonalNote(userId, setId, next));
  };

  return (
    <section className="personal-notes" aria-labelledby="personal-notes-heading" data-testid="personal-notes">
      <header className="personal-notes-head">
        <div>
          <h3 id="personal-notes-heading">My notes</h3>
          <p>Write in Markdown. These notes stay on this device.</p>
        </div>
        <button className="quiet-button" type="button" onClick={() => setPreview((value) => !value)} aria-pressed={preview} data-testid="button-toggle-personal-note-preview">
          {preview ? <><EyeOff size={14} /> Edit</> : <><Eye size={14} /> Preview</>}
        </button>
      </header>
      {preview
        ? note.trim()
          ? <div className="personal-note-preview"><RichNotes text={note} testId="personal-note-preview" /></div>
          : <p className="personal-note-empty">Nothing written yet. Switch to Edit to add a note.</p>
        : <label className="personal-note-editor">
          <span className="sr-only">Your personal study notes</span>
          <textarea value={note} maxLength={MAX_NOTE_LENGTH} onChange={(event) => update(event.target.value)} placeholder={'# A useful idea\n\n- Something to remember\n- A question to revisit'} data-testid="input-personal-notes" />
        </label>}
      <footer className="personal-notes-foot">
        <span role="status" data-testid="status-personal-notes">{saved ? 'Saved on this device' : 'Could not save on this device'}</span>
        <span>{note.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}</span>
      </footer>
    </section>
  );
}
