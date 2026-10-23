import { useCallback, useEffect, useRef, useState } from "react";

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function useInfiniteList<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false); // a ref, not state: it must block a second call in the same tick

  const loadMore = useCallback(async () => {
    if (inFlight.current || done) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setDone(page.nextCursor === null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [cursor, done, fetchPage]);

  return { items, loading, error, done, loadMore };
}

/** Calls onVisible whenever the returned ref's element scrolls into view (no scroll listeners). */
function useOnVisible(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    // rootMargin starts loading 300px before the sentinel is actually on screen
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && callback.current(), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

async function fetchPosts(cursor: string | null): Promise<Page<{ id: number; title: string }>> {
  const start = cursor ? Number(cursor) : 0;
  await new Promise((r) => setTimeout(r, 300));
  const items = Array.from({ length: 20 }, (_, i) => ({ id: start + i, title: `Post #${start + i + 1}` }));
  return { items, nextCursor: start + 20 < 100 ? String(start + 20) : null };
}

export default function Feed() {
  const { items, loading, error, done, loadMore } = useInfiniteList(fetchPosts);
  const sentinel = useOnVisible(loadMore, !error && !done);
  return (
    <div>
      <ul aria-busy={loading}>
        {items.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      {error && (
        <p role="alert">
          Couldn&apos;t load more. <button onClick={loadMore}>Retry</button>
        </p>
      )}
      {loading && <p aria-live="polite">Loading…</p>}
      {done && <p>You&apos;re all caught up.</p>}
      {/* the sentinel: when it nears the viewport, fetch the next page */}
      <div ref={sentinel} style={{ height: 1 }} />
    </div>
  );
}
