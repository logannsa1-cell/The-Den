import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every device-local key is scoped to the signed-in Clerk user. */
export const userKey = (userId: string, ...parts: string[]) => `jaguar:${userId}:${parts.join(':')}`;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function removeKey(key: string) {
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
}
