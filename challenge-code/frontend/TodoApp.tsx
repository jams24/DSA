import { useEffect, useReducer, useState } from "react";

interface Todo {
  id: string;
  text: string;
  done: boolean;
}
type Filter = "all" | "active" | "completed";
type Action =
  | { type: "add"; text: string }
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "remove"; id: string }
  | { type: "toggleAll" }
  | { type: "clearCompleted" };

// A reducer keeps every state transition in one pure, testable function.
function todosReducer(todos: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case "add":
      return [...todos, { id: crypto.randomUUID(), text: action.text, done: false }];
    case "toggle":
      return todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case "edit":
      return todos.map((t) => (t.id === action.id ? { ...t, text: action.text } : t));
    case "remove":
      return todos.filter((t) => t.id !== action.id);
    case "toggleAll": {
      const allDone = todos.every((t) => t.done);
      return todos.map((t) => ({ ...t, done: !allDone }));
    }
    case "clearCompleted":
      return todos.filter((t) => !t.done);
  }
}

const STORAGE_KEY = "todos-v1";
function load(): Todo[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return []; // private mode, corrupted JSON, or no storage at all
  }
}

function TodoItem({ todo, dispatch }: { todo: Todo; dispatch: React.Dispatch<Action> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const save = () => {
    const text = draft.trim();
    if (text) dispatch({ type: "edit", id: todo.id, text });
    else dispatch({ type: "remove", id: todo.id }); // emptying a todo deletes it
    setEditing(false);
  };
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={() => dispatch({ type: "toggle", id: todo.id })} aria-label={`Mark "${todo.text}" ${todo.done ? "not done" : "done"}`} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          aria-label="Edit todo"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(todo.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span onDoubleClick={() => setEditing(true)} style={{ textDecoration: todo.done ? "line-through" : undefined }}>
          {todo.text}
        </span>
      )}
      <button onClick={() => dispatch({ type: "remove", id: todo.id })} aria-label={`Delete "${todo.text}"`}>
        ×
      </button>
    </li>
  );
}

export default function TodoApp() {
  const [todos, dispatch] = useReducer(todosReducer, undefined, load);
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      /* storage full or unavailable: the app still works in memory */
    }
  }, [todos]);

  // Derived state: compute it, don't store it (no chance of it going out of sync).
  const visible = todos.filter((t) => (filter === "all" ? true : filter === "active" ? !t.done : t.done));
  const left = todos.filter((t) => !t.done).length;

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          dispatch({ type: "add", text: text.trim() });
          setText("");
        }}
      >
        {todos.length > 0 && <button type="button" onClick={() => dispatch({ type: "toggleAll" })} aria-label="Toggle all" />}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" aria-label="New todo" />
      </form>
      <ul>
        {visible.map((t) => (
          <TodoItem key={t.id} todo={t} dispatch={dispatch} />
        ))}
      </ul>
      {todos.length > 0 && (
        <footer>
          <span aria-live="polite">
            {left} item{left === 1 ? "" : "s"} left
          </span>
          {(["all", "active", "completed"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
          {todos.some((t) => t.done) && <button onClick={() => dispatch({ type: "clearCompleted" })}>Clear completed</button>}
        </footer>
      )}
    </section>
  );
}
