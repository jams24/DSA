import { useMemo, useState } from "react";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}
type SortDir = "asc" | "desc";

export function DataTable<T extends Record<string, unknown>>({ rows, columns, pageSizes = [5, 10, 25] }: { rows: T[]; columns: Column<T>[]; pageSizes?: number[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof T & string; dir: SortDir } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizes[0]);

  // filter -> sort -> paginate, memoized so typing elsewhere doesn't re-sort 10k rows
  const processed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) : rows;
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * dir;
    });
  }, [rows, columns, query, sort]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pageCount - 1); // a filter can shrink the page count under us
  const visible = processed.slice(current * pageSize, (current + 1) * pageSize);

  const cycleSort = (key: keyof T & string) => {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
    setPage(0);
  };

  return (
    <div>
      <input
        type="search"
        aria-label="Filter rows"
        placeholder="Filter…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
      />
      <table>
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : null;
              return (
                <th key={c.key} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} scope="col">
                  {c.sortable ? (
                    <button onClick={() => cycleSort(c.key)}>
                      {c.header} {dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No matching rows</td>
            </tr>
          ) : (
            visible.map((row, i) => (
              <tr key={String(row.id ?? i)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "")}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <nav aria-label="Pagination">
        <button onClick={() => setPage(current - 1)} disabled={current === 0}>
          Previous
        </button>
        <span>
          Page {current + 1} of {pageCount} ({processed.length} rows)
        </span>
        <button onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1}>
          Next
        </button>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
        >
          {pageSizes.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </nav>
    </div>
  );
}

// Usage
interface User extends Record<string, unknown> {
  id: number;
  name: string;
  age: number;
  email: string;
}
const USERS: User[] = [
  { id: 1, name: "Ada", age: 36, email: "ada@example.com" },
  { id: 2, name: "Linus", age: 28, email: "linus@example.com" },
  { id: 3, name: "Grace", age: 45, email: "grace@example.com" },
];
export default function Example() {
  return (
    <DataTable
      rows={USERS}
      columns={[
        { key: "name", header: "Name", sortable: true },
        { key: "age", header: "Age", sortable: true },
        { key: "email", header: "Email", render: (u) => <a href={`mailto:${u.email}`}>{u.email}</a> },
      ]}
    />
  );
}
