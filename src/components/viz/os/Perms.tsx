"use client";

import { useState } from "react";
import { C, Narration, Segmented, SmallBtn } from "../kit";

// Unix permission bits: flip rwx bits, pick a user and an action, and watch which ONE class the kernel checks.
type Who = "ann" | "bob" | "eve" | "root";
type Act = 0 | 1 | 2; // r, w, x
const USERS: { value: Who; label: string; desc: string }[] = [
  { value: "ann", label: "ann (owner)", desc: "ann owns the file and is also in the staff group" },
  { value: "bob", label: "bob (staff)", desc: "bob isn't the owner, but he is in the staff group" },
  { value: "eve", label: "eve (other)", desc: "eve is neither the owner nor in staff" },
  { value: "root", label: "root", desc: "root is UID 0" },
];
const ACTS = ["read", "write", "execute"] as const;
const CLASSES = ["owner", "group", "others"] as const;
const PRESETS: { mode: number; why: string }[] = [
  { mode: 0o644, why: "a normal file" },
  { mode: 0o640, why: "group may read, others nothing" },
  { mode: 0o600, why: "a private key" },
  { mode: 0o755, why: "a program" },
  { mode: 0o070, why: "the weird one" },
];
const UMASKS = [0o022, 0o027, 0o077, 0o002];

const oct = (n: number, w = 3) => n.toString(8).padStart(w, "0");
const rwx = (m: number) => Array.from({ length: 9 }, (_, i) => (m & (0o400 >> i) ? "rwx"[i % 3] : "-")).join("");
const klass = (w: Who) => (w === "ann" ? 0 : w === "bob" ? 1 : 2);

function check(mode: number, who: Who, act: Act) {
  if (who === "root") return { cls: -1, ok: act !== 2 || (mode & 0o111) !== 0 };
  const cls = klass(who);
  const triple = (mode >> (6 - 3 * cls)) & 7;
  return { cls, ok: (triple & (4 >> act)) !== 0 };
}

export default function Perms() {
  const [mode, setMode] = useState(0o640);
  const [who, setWho] = useState<Who>("bob");
  const [act, setAct] = useState<Act>(0);
  const [umask, setUmask] = useState(0o022);
  const res = check(mode, who, act);
  const user = USERS.find((u) => u.value === who)!;

  let story: string;
  if (who === "root") {
    story =
      act === 2
        ? res.ok
          ? "root skips the read and write checks. To execute, at least one x bit must be set somewhere, and one is: allowed."
          : "root skips the read and write checks, but even root can't execute a file with no x bit at all: denied."
        : `root (UID 0) skips the permission check entirely: ${ACTS[act]} is allowed whatever the bits say.`;
  } else {
    const cls = CLASSES[res.cls];
    const triple = rwx(mode).slice(res.cls * 3, res.cls * 3 + 3);
    story = `${user.desc}, so the kernel uses ONLY the ${cls} bits "${triple}" and ignores the rest. ${ACTS[act]}: ${res.ok ? "allowed" : "denied (EACCES)"}.`;
    if (!res.ok && who === "ann" && (mode & 0o070 & ((4 >> act) << 3)))
      story += " The group bits would have allowed it, but the kernel never falls through: the owner gets the owner bits.";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm">
          <span style={{ color: C.text }}>-{rwx(mode)}</span>
          <span className="text-muted">ann staff report.txt</span>
          <span className="text-faint">chmod {oct(mode)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CLASSES.map((c, ci) => {
            const checked = res.cls === ci;
            return (
              <div
                key={c}
                className="rounded-lg border p-2 transition-colors"
                style={{ borderColor: checked ? (res.ok ? C.done : C.bad) : C.dim, opacity: who === "root" || checked ? 1 : 0.55 }}
              >
                <div className="mb-1.5 flex items-center justify-between text-[10px] tracking-wider uppercase">
                  <span className="text-faint">{c}</span>
                  <span className="font-mono text-faint">{(mode >> (6 - 3 * ci)) & 7}</span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((b) => {
                    const bit = 0o400 >> (ci * 3 + b);
                    const on = (mode & bit) !== 0;
                    const focus = checked && b === act;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setMode(mode ^ bit)}
                        className="h-9 flex-1 rounded-md border font-mono text-sm font-semibold"
                        style={{
                          borderColor: focus ? (res.ok ? C.done : C.bad) : on ? C.active : C.dim,
                          background: on ? `${C.active}22` : "transparent",
                          color: on ? C.text : C.faint,
                          outline: focus ? `2px solid ${res.ok ? C.done : C.bad}` : undefined,
                          outlineOffset: 1,
                        }}
                        aria-label={`${c} ${ACTS[b]} ${on ? "on" : "off"}`}
                      >
                        {on ? "rwx"[b] : "-"}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 text-center text-[10px] text-faint">{checked ? "← checked" : who === "root" ? "skipped by root" : "ignored"}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <SmallBtn key={p.mode} onClick={() => setMode(p.mode)} tone={p.mode === mode ? "primary" : "default"}>
              {oct(p.mode)} <span className="text-faint">· {p.why}</span>
            </SmallBtn>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Segmented value={who} onChange={setWho} options={USERS.map(({ value, label }) => ({ value, label }))} />
        <Segmented value={String(act) as "0" | "1" | "2"} onChange={(v) => setAct(Number(v) as Act)} options={ACTS.map((a, i) => ({ value: String(i) as "0" | "1" | "2", label: a }))} />
      </div>

      <Narration tone={res.ok ? "good" : "bad"}>{story}</Narration>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] tracking-wider text-faint uppercase">
              <th className="px-3 py-1.5 text-left font-medium">who can do what</th>
              {ACTS.map((a) => (
                <th key={a} className="px-3 py-1.5 font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.value} className="border-t border-line" style={{ background: u.value === who ? `${C.active}11` : undefined }}>
                <td className="px-3 py-1.5 font-mono text-xs" style={{ color: C.text }}>
                  {u.label}
                </td>
                {[0, 1, 2].map((a) => {
                  const ok = check(mode, u.value, a as Act).ok;
                  return (
                    <td key={a} className="px-3 py-1.5 text-center font-mono" style={{ color: ok ? C.done : C.bad }}>
                      {ok ? "✓" : "✗"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">umask</span>
          <Segmented value={oct(umask)} onChange={(v) => setUmask(parseInt(v, 8))} options={UMASKS.map((m) => ({ value: oct(m), label: oct(m) }))} />
        </div>
        <div className="grid gap-1 font-mono text-xs sm:grid-cols-2" style={{ color: C.text }}>
          <div>
            new file: 666 &amp; ~{oct(umask)} = <b>{oct(0o666 & ~umask)}</b> <span className="text-faint">-{rwx(0o666 & ~umask)}</span>
          </div>
          <div>
            new dir: 777 &amp; ~{oct(umask)} = <b>{oct(0o777 & ~umask)}</b> <span className="text-faint">d{rwx(0o777 & ~umask)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
