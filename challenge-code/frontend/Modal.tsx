import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null; // to restore focus on close
    const dialog = dialogRef.current!;
    (dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // stop the page behind from scrolling

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap: Tab from the last element wraps to the first, Shift+Tab from the first wraps to the last.
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  // A portal renders at the end of <body>, so no parent's overflow or z-index can clip the dialog.
  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop, not inside the dialog
      }}
      style={{ position: "fixed", inset: 0, background: "rgb(0 0 0 / 0.5)", display: "grid", placeItems: "center" }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{ background: "white", padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <button onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete account</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <p>This cannot be undone.</p>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button onClick={() => setOpen(false)}>Delete</button>
      </Modal>
    </>
  );
}
