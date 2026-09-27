import { randomUUID } from 'crypto';

export const generateId = (): string => randomUUID().replace(/-/g, '');

export const generateRequestId = (): string => `req_${generateId()}`;

export const pick = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const omit = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of keys) {
    delete result[key as string];
  }
  return result as Omit<T, K>;
};

export const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d+)$/, 'org-$1');
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const isEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === '';

export const safeJsonParse = <T>(value: string, fallback: T | null = null): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const isUuid = (value: string): boolean => /^[a-f0-9-]{32,}$/i.test(value);

export const truncate = (value: string, length: number): string => {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3)}...`;
};

export const getSecondsFromNow = (seconds: number): number => Math.floor(Date.now() / 1000) + seconds;

export const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Resolve a slug that is not already taken, appending `-1`, `-2`, ... as needed.
 * `exists` must consider every row the uniqueness constraint covers (including
 * soft-deleted ones) so the result is guaranteed insertable.
 */
export const resolveUniqueSlug = async (
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> => {
  if (!(await exists(base))) return base;
  // The suffix space is unbounded in practice; 100 attempts is a safety valve
  // rather than a real limit, and a final check guarantees we never return a
  // slug that is still taken.
  for (let i = 1; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};
