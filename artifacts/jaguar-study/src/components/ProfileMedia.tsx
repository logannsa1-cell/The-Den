import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Settings, Trash2, X } from 'lucide-react';
import { useProfileMedia, validateMedia, type MediaKind } from '@/lib/profile-media';

type Media = ReturnType<typeof useProfileMedia>;

function MediaEditor({ kind, media, onDone, notify }: { kind: MediaKind; media: Media; onDone: () => void; notify: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const pick = (f: File | undefined) => {
    if (!f) return;
    const msg = validateMedia(f, kind);
    setError(msg);
    setFile(msg ? null : f);
  };
  const shown = preview ?? media.url;
  const label = kind === 'avatar' ? 'Profile picture' : 'Banner';
  return (
    <div className="media-editor" role="dialog" aria-label={`Edit ${label.toLowerCase()}`} data-testid={`editor-${kind}`}>
      <div className="media-editor-head"><strong>{label}</strong><button className="icon-button" type="button" onClick={onDone} aria-label="Close" data-testid={`button-close-${kind}`}><X size={13} /></button></div>
      <div className={`media-preview ${kind}`}>{shown ? <img src={shown} alt={`${label} preview`} /> : <span>No image</span>}</div>
      <p className="device-note">Saved on this device only. It will not appear on your other devices yet.</p>
      {error && <p className="field-error" role="alert" data-testid={`error-${kind}`}>{error}</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} data-testid={`input-${kind}`} />
      <div className="media-actions">
        <button className="quiet-button" type="button" onClick={() => input.current?.click()} data-testid={`button-choose-${kind}`}><ImagePlus size={13} /> Choose image</button>
        {file && <button className="small-primary" type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await media.save(file); notify(`${label} saved on this device.`); onDone(); } catch { setError('This browser could not store the image. Free some space and try again.'); }
          finally { setBusy(false); }
        }} data-testid={`button-save-${kind}`}>Save</button>}
        {media.url && !file && <button className="text-button danger-text" type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await media.remove(); notify(`${label} removed.`); onDone(); }
          catch { setError('This browser could not remove the image. Please try again.'); }
          finally { setBusy(false); }
        }} data-testid={`button-remove-${kind}`}><Trash2 size={11} /> Remove</button>}
      </div>
    </div>
  );
}

export function ProfileHeader({ initial, name, avatar, banner, notify, children }: { initial: string; name: string; avatar: Media; banner: Media; notify: (m: string) => void; children: ReactNode }) {
  const [editing, setEditing] = useState<MediaKind | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); setEditing(null); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <section className="profile-hero reveal" style={{ zIndex: settingsOpen ? 30 : undefined }} data-testid="section-profile">
      <div className="banner" style={banner.url ? { backgroundImage: `url(${banner.url})` } : undefined} data-testid="img-banner">
        <button className="banner-edit" type="button" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(!settingsOpen); setEditing(null); }} data-testid="button-profile-settings"><Settings size={13} /> Settings</button>
      </div>
      <div className="profile-row">
        <div className="profile-avatar" aria-label="Profile picture" data-testid="profile-avatar">
          {avatar.url ? <img src={avatar.url} alt={`${name} profile`} /> : <span>{initial}</span>}
        </div>
        <div className="profile-copy">{children}</div>
      </div>
      {settingsOpen && !editing && <div className="media-editor" role="region" aria-label="Profile settings">
        <div className="media-editor-head"><strong>Profile settings</strong><button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={13} /></button></div>
        <button className="quiet-button" type="button" onClick={() => setEditing('avatar')} data-testid="button-edit-avatar"><Camera size={13} /> Change profile picture</button>
        <button className="quiet-button" type="button" onClick={() => setEditing('banner')} data-testid="button-edit-banner"><ImagePlus size={13} /> Change banner</button>
      </div>}
      {settingsOpen && editing && <MediaEditor key={editing} kind={editing} media={editing === 'avatar' ? avatar : banner} onDone={() => setEditing(null)} notify={notify} />}
    </section>
  );
}
