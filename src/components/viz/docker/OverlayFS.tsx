"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat } from "../kit";

// overlayfs, the way Docker stacks an image's read-only layers under each container's writable layer.
// Read a file (lookup top-down), edit it (copy-up), delete it (whiteout), create one, then rm the
// container or commit its layer, and compare two containers sharing the same image.
interface Entry {
  size: number; // KB
  whiteout?: boolean;
  edited?: boolean;
}
type Files = Record<string, Entry>;
interface Layer {
  name: string;
  files: Files;
}
type Who = "A" | "B";
type Where = number | "upper";

const IMAGE: Layer[] = [
  {
    name: "FROM node:20-slim",
    files: { "/bin/sh": { size: 125 }, "/etc/os-release": { size: 1 }, "/etc/passwd": { size: 1 }, "/usr/local/bin/node": { size: 98304 } },
  },
  { name: "COPY server.js /app/", files: { "/app/server.js": { size: 2 } } },
  { name: "RUN npm ci", files: { "/app/node_modules/express/index.js": { size: 1 }, "/app/package-lock.json": { size: 40 } } },
];

const fmt = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${kb} KB`);
const short = (p: string) => p.replace("/app/node_modules/express/", "…/express/");

function resolve(path: string, layers: Layer[], upper: Files): { where: Where; entry: Entry } | null {
  if (upper[path]) return upper[path].whiteout ? null : { where: "upper", entry: upper[path] };
  for (let i = layers.length - 1; i >= 0; i--) {
    const e = layers[i].files[path];
    if (e) return e.whiteout ? null : { where: i, entry: e };
  }
  return null;
}

export default function OverlayFS() {
  const [layers, setLayers] = useState<Layer[]>(IMAGE);
  const [uppers, setUppers] = useState<Record<Who, Files>>({ A: {}, B: {} });
  const [who, setWho] = useState<Who>("A");
  const [sel, setSel] = useState("/app/server.js");
  const [hit, setHit] = useState<{ where: Where; path: string; walked: Where[] } | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "Two containers (A and B) run from the same image. Pick a file, then read, edit or delete it, and watch which layer changes.",
    tone: "info",
  });
  const [made, setMade] = useState(0);

  const upper = uppers[who];
  const merged = useMemo(() => {
    const all = new Set<string>([...layers.flatMap((l) => Object.keys(l.files)), ...Object.keys(upper)]);
    return [...all].filter((p) => resolve(p, layers, upper)).sort();
  }, [layers, upper]);
  const path = merged.includes(sel) ? sel : merged[0];
  const layerName = (w: Where) => (w === "upper" ? `container ${who}'s layer` : `layer ${w + 1} (${layers[w].name})`);
  const setUpper = (f: Files) => setUppers((u) => ({ ...u, [who]: f }));
  const walk = (to: Where): Where[] => {
    const out: Where[] = ["upper"];
    for (let i = layers.length - 1; i >= 0 && to !== "upper"; i--) {
      out.push(i);
      if (i === to) break;
    }
    return out;
  };

  function read() {
    if (!path) return;
    const r = resolve(path, layers, upper)!;
    setHit({ where: r.where, path, walked: walk(r.where) });
    setMsg({
      text:
        r.where === "upper"
          ? `${path} is in container ${who}'s own layer, the first place overlayfs looks.`
          : `Lookup goes top-down: container ${who}'s layer${layers.length - 1 > r.where ? ", then the image layers," : ""} until a layer has the file. Found in ${layerName(r.where)}: read straight from the image. Nothing is copied.`,
      tone: "info",
    });
  }

  function edit() {
    if (!path) return;
    const r = resolve(path, layers, upper)!;
    setHit({ where: "upper", path, walked: walk(r.where) });
    if (r.where === "upper") {
      setUpper({ ...upper, [path]: { ...r.entry, edited: true } });
      setMsg({ text: `${path} is already in container ${who}'s layer, so it's changed in place.`, tone: "info" });
      return;
    }
    setUpper({ ...upper, [path]: { size: r.entry.size, edited: true } });
    setMsg({
      text: `Copy-up: the image layer is read-only, so overlayfs first copies the WHOLE file (${fmt(r.entry.size)}) from ${layerName(r.where)} into container ${who}'s layer, then changes the copy. ${
        r.entry.size > 1024 ? "Changing one byte of a big file costs its full size! " : ""
      }The image is untouched: container ${who === "A" ? "B" : "A"} still sees the original.`,
      tone: r.entry.size > 1024 ? "warn" : "good",
    });
  }

  function remove() {
    if (!path) return;
    const r = resolve(path, layers, upper)!;
    const inImage = layers.some((l) => l.files[path] && !l.files[path].whiteout);
    setHit({ where: "upper", path, walked: walk(r.where) });
    if (inImage) {
      setUpper({ ...upper, [path]: { size: 0, whiteout: true } });
      setMsg({
        text: `A read-only layer can't be changed, so overlayfs writes a WHITEOUT in container ${who}'s layer: a tiny marker (a 0/0 character device) named ${path.split("/").pop()} that hides the file. The ${fmt(
          r.entry.size,
        )} are still in the image.`,
        tone: "warn",
      });
    } else {
      const next = { ...upper };
      delete next[path];
      setUpper(next);
      setMsg({ text: `${path} only existed in container ${who}'s layer, so it's simply deleted.`, tone: "info" });
    }
  }

  function create() {
    const p = `/tmp/upload-${made + 1}.png`;
    setMade(made + 1);
    setUpper({ ...upper, [p]: { size: 300 } });
    setSel(p);
    setHit({ where: "upper", path: p, walked: ["upper"] });
    setMsg({ text: `New files go straight into container ${who}'s writable layer. No other container, and no image, can see ${p}.`, tone: "good" });
  }

  function rm() {
    const n = Object.keys(upper).length;
    setUpper({});
    setHit(null);
    setMsg({
      text: `docker rm: container ${who}'s writable layer is thrown away${n ? `, with all ${n} change${n > 1 ? "s" : ""}` : ""}. The image layers are untouched, so a new container starts exactly like the first one did. (That's why data belongs in volumes.)`,
      tone: "warn",
    });
  }

  function commit() {
    const n = Object.keys(upper).length;
    if (!n) {
      setMsg({ text: `Container ${who}'s layer is empty: nothing to commit.`, tone: "info" });
      return;
    }
    const wasted = Object.entries(upper)
      .filter(([, e]) => e.whiteout)
      .reduce((s, [p]) => s + (layers.find((l) => l.files[p])?.files[p].size ?? 0), 0);
    setLayers([...layers, { name: `docker commit (container ${who})`, files: upper }]);
    setUppers({ A: {}, B: {} });
    setHit(null);
    setMsg({
      text: `docker commit freezes container ${who}'s layer into layer ${layers.length + 1} of a new image, whiteouts and copied-up files included.${
        wasted ? ` Deleting files didn't make it smaller: the whiteouts hide ${fmt(wasted)} that are still stored in the lower layers.` : ""
      } Real images should come from a Dockerfile, so they can be rebuilt.`,
      tone: wasted ? "warn" : "good",
    });
  }

  const imageSize = layers.reduce((s, l) => s + Object.values(l.files).reduce((a, e) => a + e.size, 0), 0);
  const upperSize = (w: Who) => Object.values(uppers[w]).reduce((a, e) => a + e.size, 0);

  // plain render helpers (not components), so React doesn't remount them on every render
  const chip = (p: string, e: Entry | undefined, where: Where | "merged") => {
    const isHit = hit && hit.path === p && (where === "merged" || where === hit.where);
    const looked = hit && hit.path === p && where !== "merged" && hit.walked.includes(where) && !isHit;
    const col = e?.whiteout ? C.bad : isHit ? C.active : e?.edited ? C.compare : C.muted;
    return (
      <button
        key={p}
        type="button"
        onClick={() => !e?.whiteout && merged.includes(p) && setSel(p)}
        className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition"
        style={{
          borderColor: isHit ? C.active : e?.whiteout ? `${C.bad}88` : looked ? C.compare : p === path && where === "merged" ? C.active : C.dim,
          borderStyle: looked ? "dashed" : "solid",
          background: isHit ? `${C.active}18` : p === path && where === "merged" ? `${C.active}0d` : "#ffffff",
          color: col,
          textDecoration: e?.whiteout ? "line-through" : undefined,
        }}
        title={e ? fmt(e.size) : undefined}
      >
        {e?.whiteout ? "⊘ " : ""}
        {short(p)}
        {e?.edited ? " ✎" : ""}
      </button>
    );
  };

  const band = (key: string, title: string, sub: string, files: Files, where: Where, tone: string) => (
    <div key={key} className="rounded-xl border px-3 py-2" style={{ borderColor: `${tone}55`, background: `${tone}08` }}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
        <span className="font-semibold" style={{ color: tone }}>
          {title}
        </span>
        <span className="text-faint">{sub}</span>
      </div>
      <div className="flex min-h-6 flex-wrap gap-1">
        {Object.keys(files).length === 0 && <span className="text-[11px] text-faint">empty</span>}
        {Object.entries(files)
          .sort()
          .map(([p, e]) => chip(p, e, where))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
        Acting in
        <Segmented
          value={who}
          onChange={(w) => {
            setWho(w);
            setHit(null);
          }}
          options={[
            { value: "A", label: "container A" },
            { value: "B", label: "container B" },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: C.active }}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
            <span className="font-semibold" style={{ color: C.active }}>
              What container {who} sees: the merged view (/)
            </span>
            <span className="text-faint">click a file to select it</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {merged.map((p) => chip(p, resolve(p, layers, upper)!.entry, "merged"))}
          </div>
        </div>
        <div className="text-center text-[10px] text-faint">▲ overlayfs merges the layers below, top layer wins ▲</div>
        {band("upper", `Container ${who}'s layer (upperdir, writable)`, `${fmt(upperSize(who))} · deleted by docker rm`, upper, "upper", C.compare)}
        {[...layers.keys()].reverse().map((i) => band(`l${i}`, `Layer ${i + 1}: ${layers[i].name}`, "read-only · shared by A and B", layers[i].files, i, i >= IMAGE.length ? C.pivot : C.sky))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-xs text-dim">{path ?? "no file"}</span>
        <SmallBtn onClick={read} tone="primary">
          read
        </SmallBtn>
        <SmallBtn onClick={edit} tone="primary">
          edit
        </SmallBtn>
        <SmallBtn onClick={remove} tone="danger">
          delete
        </SmallBtn>
        <SmallBtn onClick={create}>create a file</SmallBtn>
        <SmallBtn onClick={rm} tone="danger">
          docker rm
        </SmallBtn>
        <SmallBtn onClick={commit}>docker commit</SmallBtn>
        <SmallBtn
          onClick={() => {
            setLayers(IMAGE);
            setUppers({ A: {}, B: {} });
            setHit(null);
            setMade(0);
            setMsg({ text: "Back to a fresh image with two empty containers.", tone: "info" });
          }}
        >
          reset
        </SmallBtn>
      </div>

      <Narration tone={msg.tone}>{msg.text}</Narration>

      <div className="flex flex-wrap gap-3">
        <Stat label="image (shared)" value={fmt(imageSize)} color={C.sky} />
        <Stat label="container A layer" value={fmt(upperSize("A"))} color={C.compare} />
        <Stat label="container B layer" value={fmt(upperSize("B"))} color={C.compare} />
        <Stat label="disk for 2 containers" value={fmt(imageSize + upperSize("A") + upperSize("B"))} color={C.text} />
      </div>
    </div>
  );
}
