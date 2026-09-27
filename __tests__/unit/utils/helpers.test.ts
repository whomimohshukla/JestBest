import {
  chunkArray,
  generateRequestId,
  isUuid,
  omit,
  pick,
  resolveUniqueSlug,
  safeJsonParse,
  safeJsonStringify,
  toSlug,
  truncate,
} from '../../../src/utils/helpers';

describe('toSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toSlug('My Workspace')).toBe('my-workspace');
  });

  it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(toSlug('Acme   //  QA  Labs!!')).toBe('acme-qa-labs');
  });

  it('trims leading and trailing separators', () => {
    expect(toSlug('  --Hello--  ')).toBe('hello');
  });

  it('returns an empty string when there are no usable characters', () => {
    expect(toSlug('!!!')).toBe('');
    expect(toSlug('   ')).toBe('');
  });

  it('prefixes an all-digit slug so it is not confused with an id', () => {
    expect(toSlug('2026')).toBe('org-2026');
  });
});

describe('resolveUniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    const exists = jest.fn().mockResolvedValue(false);
    await expect(resolveUniqueSlug('acme', exists)).resolves.toBe('acme');
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it('appends the first free numeric suffix', async () => {
    const taken = new Set(['acme', 'acme-1', 'acme-2']);
    const exists = jest.fn((slug: string) => Promise.resolve(taken.has(slug)));
    await expect(resolveUniqueSlug('acme', exists)).resolves.toBe('acme-3');
  });

  it('keeps looking well past ten collisions', async () => {
    const taken = new Set(Array.from({ length: 40 }, (_, i) => (i === 0 ? 'acme' : `acme-${i}`)));
    const exists = jest.fn((slug: string) => Promise.resolve(taken.has(slug)));
    await expect(resolveUniqueSlug('acme', exists)).resolves.toBe('acme-40');
  });

  it('never returns a slug the caller reported as taken', async () => {
    // Everything is taken forever: the fallback must still be unique-ish and,
    // critically, must not silently return a colliding value.
    const exists = jest.fn().mockResolvedValue(true);
    const result = await resolveUniqueSlug('acme', exists);
    expect(result).not.toBe('acme');
  });
});

describe('pick / omit', () => {
  const source = { a: 1, b: 2, c: 3 };

  it('pick keeps only the requested keys', () => {
    expect(pick(source, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('pick drops keys whose value is undefined', () => {
    expect(pick({ a: 1, b: undefined } as Record<string, unknown>, ['a', 'b'])).toEqual({ a: 1 });
  });

  it('omit removes the requested keys', () => {
    expect(omit(source, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('omit does not mutate the source', () => {
    omit(source, ['a']);
    expect(source).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('leaves a string of exactly the limit untouched', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });

  it('truncates longer strings with an ellipsis', () => {
    expect(truncate('1234567890', 5)).toBe('12...');
  });
});

describe('safeJsonParse / safeJsonStringify', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns the fallback for invalid JSON instead of throwing', () => {
    expect(safeJsonParse('not json', { a: 0 })).toEqual({ a: 0 });
    expect(safeJsonParse('not json')).toBeNull();
  });

  it('stringifies circular structures without throwing', () => {
    const circular: Record<string, unknown> = { name: 'x' };
    circular.self = circular;
    expect(() => safeJsonStringify(circular)).not.toThrow();
    // Falls back to String(value) rather than propagating a TypeError.
    expect(safeJsonStringify(circular)).toBe(String(circular));
  });
});

describe('chunkArray', () => {
  it('splits into equal chunks and keeps the remainder', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });
});

describe('generateRequestId / isUuid', () => {
  it('prefixes request ids', () => {
    expect(generateRequestId()).toMatch(/^req_[0-9a-f]{32}$/);
  });

  it('produces unique ids', () => {
    expect(generateRequestId()).not.toBe(generateRequestId());
  });

  it('recognises uuid-like values', () => {
    expect(isUuid('550e8400e29b41d4a716446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
