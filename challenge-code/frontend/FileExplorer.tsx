import { useState } from "react";

export type FsNode = { name: string; children?: FsNode[] }; // children present = folder

const sortNodes = (nodes: FsNode[]) =>
  [...nodes].sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name)); // folders first, then A-Z

function TreeItem({ node, path, depth, expanded, toggle, selected, select }: {
  node: FsNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selected: string | null;
  select: (path: string) => void;
}) {
  const isFolder = !!node.children;
  const isOpen = expanded.has(path);
  return (
    <li role="treeitem" aria-expanded={isFolder ? isOpen : undefined} aria-selected={selected === path} aria-level={depth + 1}>
      <button
        onClick={() => (isFolder ? toggle(path) : select(path))}
        style={{ paddingLeft: depth * 16, background: selected === path ? "#eef" : "none", border: 0, cursor: "pointer" }}
      >
        <span aria-hidden>{isFolder ? (isOpen ? "📂" : "📁") : "📄"}</span> {node.name}
        {isFolder && node.children!.length === 0 && <em> (empty)</em>}
      </button>
      {isFolder && isOpen && node.children!.length > 0 && (
        <ul role="group" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sortNodes(node.children!).map((child) => (
            <TreeItem key={child.name} node={child} path={`${path}/${child.name}`} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} select={select} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Recursion mirrors the data: a folder renders its children with the same component. */
export default function FileExplorer({ root, onOpen }: { root: FsNode[]; onOpen?: (path: string) => void }) {
  // Keyed by full path, so two folders with the same name in different places don't collide.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const select = (path: string) => {
    setSelected(path);
    onOpen?.(path);
  };
  return (
    <ul role="tree" aria-label="Files" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {sortNodes(root).map((n) => (
        <TreeItem key={n.name} node={n} path={n.name} depth={0} expanded={expanded} toggle={toggle} selected={selected} select={select} />
      ))}
    </ul>
  );
}

export const EXAMPLE: FsNode[] = [
  { name: "README.md" },
  { name: "src", children: [{ name: "index.ts" }, { name: "components", children: [{ name: "Button.tsx" }] }, { name: "utils", children: [] }] },
  { name: "package.json" },
];
