import { useCallback, useEffect, useState } from "react";

type State<T> = { status: "loading"; data?: T } | { status: "success"; data: T } | { status: "error"; error: Error; data?: T };

const cache = new Map<string, unknown>(); // module-level: shared by every component, survives unmounts

export function useFetch<T>(url: string | null, init?: RequestInit) {
  const [state, setState] = useState<State<T>>(() => (url && cache.has(url) ? { status: "success", data: cache.get(url) as T } : { status: "loading" }));
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    // stale-while-revalidate: show the cached value immediately, refresh in the background
    const cached = cache.get(url) as T | undefined;
    setState(cached === undefined ? { status: "loading" } : { status: "loading", data: cached });
    fetch(url, { ...init, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      })
      .then((data) => {
        cache.set(url, data);
        setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // unmounted or url changed: ignore, no state update
        setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)), data: cached });
      });
    return () => controller.abort();
    // `init` is deliberately left out: an inline object would be new on every render and loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, version]);

  return { ...state, refetch };
}

interface User {
  id: number;
  name: string;
}

export default function UserCard({ id }: { id: number }) {
  const res = useFetch<User>(`/api/users/${id}`);
  if (res.status === "error" && !res.data)
    return (
      <p role="alert">
        Failed: {res.error.message} <button onClick={res.refetch}>Retry</button>
      </p>
    );
  if (!res.data) return <p>Loading…</p>;
  return (
    <p>
      {res.data.name} {res.status === "loading" && <small>(refreshing)</small>}
    </p>
  );
}
