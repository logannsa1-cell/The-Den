export function readMigrationPreference(key: string, read: (key: string) => string | null) {
  try {
    const value = read(key);
    return { available: true as const, preference: value === 'sync' ? 'sync' as const : value === 'local' ? 'local' as const : 'pending' as const };
  } catch {
    return { available: false as const, preference: null };
  }
}
