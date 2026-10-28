const noteKey = (userId: string, setId: string) =>
  `jaguar-personal-notes-v1:${encodeURIComponent(userId)}:${encodeURIComponent(setId)}`;

export function readPersonalNote(userId: string, setId: string): string {
  try { return localStorage.getItem(noteKey(userId, setId)) ?? ''; }
  catch { return ''; }
}

export function savePersonalNote(userId: string, setId: string, text: string): boolean {
  try {
    localStorage.setItem(noteKey(userId, setId), text);
    return true;
  } catch {
    return false;
  }
}

export function deletePersonalNote(userId: string, setId: string): boolean {
  try {
    localStorage.removeItem(noteKey(userId, setId));
    return true;
  } catch {
    return false;
  }
}
