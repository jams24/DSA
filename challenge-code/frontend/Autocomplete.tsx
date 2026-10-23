import { useEffect, useId, useRef, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

/** Replace with a real request, e.g. fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal }). */
async function searchApi(query: string, signal: AbortSignal): Promise<string[]> {
  const all = ["Apple", "Apricot", "Avocado", "Banana", "Blackberry", "Blueberry", "Cherry", "Grape", "Mango", "Melon"];
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, 200 + Math.random() * 300); // random latency makes races realistic
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
  return all.filter((f) => f.toLowerCase().includes(query.toLowerCase()));
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export default function Autocomplete({ onSelect }: { onSelect?: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const cache = useRef(new Map<string, string[]>());
  const debounced = useDebounced(query.trim(), 250);
  const listId = useId();

  useEffect(() => {
    if (!debounced) return;
    const cached = cache.current.get(debounced);
    if (cached) {
      setResults(cached);
      setStatus("success");
      return;
    }
    // Aborting the previous request when the query changes means a slow, stale response
    // can never overwrite the results for what the user typed last.
    const controller = new AbortController();
    setStatus("loading");
    searchApi(debounced, controller.signal)
      .then((items) => {
        cache.current.set(debounced, items);
        setResults(items);
        setStatus("success");
        setActive(-1);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [debounced]);

  const choose = (value: string) => {
    setQuery(value);
    setOpen(false);
    setActive(-1);
    onSelect?.(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && debounced !== "" && query.trim() !== "";
  return (
    <div style={{ position: "relative", width: 320 }}>
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search fruit"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {showList && (
        <ul id={listId} role="listbox" style={{ position: "absolute", insetInline: 0, margin: 0, padding: 0, listStyle: "none", background: "white", border: "1px solid #ccc" }}>
          {status === "loading" && <li aria-live="polite">Loading…</li>}
          {status === "error" && <li role="alert">Something went wrong. Keep typing to retry.</li>}
          {status === "success" && results.length === 0 && <li>No matches</li>}
          {status === "success" &&
            results.map((r, i) => (
              <li
                key={r}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown + preventDefault fires before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                onMouseEnter={() => setActive(i)}
                style={{ padding: 6, background: i === active ? "#eef" : undefined, cursor: "pointer" }}
              >
                <Highlight text={r} query={debounced} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
