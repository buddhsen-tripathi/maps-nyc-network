/**
 * In-memory TTL cache with in-flight request deduplication.
 *
 * - If fresh data exists for `key`, returns it immediately.
 * - If a fetch is in flight for `key`, returns the same promise (no thundering
 *   herd when multiple clients hit a cold cache simultaneously).
 * - Otherwise fetches via `fn`, stores the result for `ttlMs`, and returns it.
 */

type Entry<T> = {
  data?: T;
  expires: number;
  promise?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();

export function memoize<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry) {
    if (entry.data !== undefined && entry.expires > now) {
      return Promise.resolve(entry.data);
    }
    if (entry.promise) {
      return entry.promise;
    }
  }

  const promise = fn()
    .then((data) => {
      store.set(key, { data, expires: Date.now() + ttlMs });
      return data;
    })
    .catch((err) => {
      // Don't cache failures, let the next caller retry.
      store.delete(key);
      throw err;
    });

  store.set(key, { expires: now + ttlMs, promise });
  return promise;
}

export function clearCache() {
  store.clear();
}
