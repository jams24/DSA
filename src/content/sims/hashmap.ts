import { arr, chars, fmt, map, need, out, range, set, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

/** setdefault-style two-way mapping check shared by isomorphic strings and word pattern */
function bijection(t: Parameters<Sim["run"]>[0], a: string[], b: string[], la: string, lb: string): boolean {
  const ab = new Map<string, string>();
  const ba = new Map<string, string>();
  const panels = (i: number, bad = false) => [
    arr(a, {
      label: la,
      ptrs: i < a.length ? { i } : {},
      tones: tones([range(0, i), "ok"], [i < a.length ? [i] : [], bad ? "bad" : "cur"]),
    }),
    arr(b, {
      label: lb,
      ptrs: i < b.length ? { i } : {},
      tones: tones([range(0, i), "ok"], [i < b.length ? [i] : [], bad ? "bad" : "cur"]),
    }),
    map(`${la} → ${lb}`, ab, i < a.length ? [a[i]] : []),
    map(`${lb} → ${la}`, ba, i < b.length ? [b[i]] : []),
  ];
  t.step(`Pair them up position by position. Keep a map in BOTH directions: each ${la} item must always map to the same ${lb} item, and no two may share one.`, panels(0));
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if ((ab.has(x) && ab.get(x) !== y) || (ba.has(y) && ba.get(y) !== x)) {
      const why = ab.has(x) && ab.get(x) !== y ? `"${x}" already maps to "${ab.get(x)}", not "${y}"` : `"${y}" is already taken by "${ba.get(y)}"`;
      t.step(`${why}. Not a one-to-one match: false.`, panels(i, true), "bad");
      return false;
    }
    const isNew = !ab.has(x);
    ab.set(x, y);
    ba.set(y, x);
    t.step(isNew ? `New pair "${x}" ↔ "${y}". Record it both ways.` : `"${x}" ↔ "${y}" is consistent with what we saw before.`, panels(i));
  }
  t.step("Every pair was consistent in both directions: true.", panels(a.length), "good");
  return true;
}

const keyOf = (s: string) => {
  const c: Record<string, number> = {};
  for (const ch of s) c[ch] = (c[ch] ?? 0) + 1;
  return (
    Object.keys(c)
      .sort()
      .map((k) => `${k}${c[k]}`)
      .join("") || "(empty)"
  );
};

export const SIMS: Record<string, Sim> = {
  "ransom-note": sim<[string, string]>(
    ["ransomNote", "magazine"],
    [
      ["a", "b", false],
      ["aa", "ab", false],
      ["aa", "aab", true],
    ],
    (t, note, mag) => {
      const have = new Map<string, number>();
      for (const c of mag) have.set(c, (have.get(c) ?? 0) + 1);
      t.step("Count every letter the magazine offers. Then spend one letter for each character of the note.", [
        chars(mag, { label: "magazine" }),
        chars(note, { label: "ransomNote" }),
        map("letters available", have),
      ]);
      for (let i = 0; i < note.length; i++) {
        const c = note[i];
        have.set(c, (have.get(c) ?? 0) - 1);
        const short = have.get(c)! < 0;
        t.step(
          short ? `Need '${c}' but the magazine has run out: false.` : `Use one '${c}': ${have.get(c)} left.`,
          [
            chars(mag, { label: "magazine" }),
            chars(note, {
              label: "ransomNote",
              ptrs: { i },
              tones: tones([range(0, i), "ok"], [[i], short ? "bad" : "cur"]),
            }),
            map("letters available", have, [c]),
          ],
          short ? "bad" : undefined,
        );
        if (short) return false;
      }
      t.step(
        "Every letter of the note was covered: true.",
        [
          chars(note, {
            label: "ransomNote",
            tones: tones([range(0, note.length), "ok"]),
          }),
          map("letters available", have),
        ],
        "good",
      );
      return true;
    },
  ),

  "isomorphic-strings": sim<[string, string]>(
    ["s", "t"],
    [
      ["egg", "add", true],
      ["foo", "bar", false],
      ["paper", "title", true],
      ["badc", "baba", false],
    ],
    (t, s, u) => {
      need(s.length === u.length, "s and t must have the same length");
      return bijection(t, [...s], [...u], "s", "t");
    },
  ),

  "word-pattern": sim<[string, string]>(
    ["pattern", "s"],
    [
      ["abba", "dog cat cat dog", true],
      ["abba", "dog cat cat fish", false],
      ["aaaa", "dog cat cat dog", false],
    ],
    (t, pattern, s) => {
      const words = s.split(" ").filter(Boolean);
      if (words.length !== pattern.length) {
        t.step(`${pattern.length} pattern letters but ${words.length} words: they can't match.`, [chars(pattern, { label: "pattern" }), arr(words, { label: "words" })]);
        t.step("Lengths differ: false.", [chars(pattern, { label: "pattern" }), arr(words, { label: "words" })], "bad");
        return false;
      }
      return bijection(t, [...pattern], words, "pattern", "words");
    },
  ),

  "valid-anagram": sim<[string, string]>(
    ["s", "t"],
    [
      ["anagram", "nagaram", true],
      ["rat", "car", false],
    ],
    (t, s, u) => {
      const c = new Map<string, number>();
      if (s.length !== u.length) {
        t.step(`Lengths differ (${s.length} vs ${u.length}), so they can't be anagrams.`, [chars(s, { label: "s" }), chars(u, { label: "t" })]);
        t.step("false.", [chars(s, { label: "s" }), chars(u, { label: "t" })], "bad");
        return false;
      }
      t.step("Anagrams have identical letter counts. Count s up, count t down. Every count must end at 0.", [chars(s, { label: "s" }), chars(u, { label: "t" }), map("count", c)]);
      for (let i = 0; i < s.length; i++) {
        c.set(s[i], (c.get(s[i]) ?? 0) + 1);
        t.step(`s[${i}] = '${s[i]}': +1.`, [
          chars(s, {
            label: "s",
            ptrs: { i },
            tones: tones([range(0, i + 1), "ok"]),
          }),
          chars(u, { label: "t" }),
          map("count", c, [s[i]]),
        ]);
      }
      for (let i = 0; i < u.length; i++) {
        c.set(u[i], (c.get(u[i]) ?? 0) - 1);
        t.step(`t[${i}] = '${u[i]}': −1${c.get(u[i])! < 0 ? `, now negative: t has more '${u[i]}' than s` : ""}.`, [
          chars(s, { label: "s" }),
          chars(u, {
            label: "t",
            ptrs: { i },
            tones: tones([range(0, i + 1), "ok"], [c.get(u[i])! < 0 ? [i] : [], "bad"]),
          }),
          map("count", c, [u[i]]),
        ]);
      }
      const ok = [...c.values()].every((v) => v === 0);
      t.step(
        ok ? "Every count is 0: anagrams." : "Some counts aren't 0: not anagrams.",
        [
          chars(s, { label: "s" }),
          chars(u, { label: "t" }),
          map(
            "count",
            c,
            [...c].filter(([, v]) => v !== 0).map(([k]) => k),
          ),
        ],
        ok ? "good" : "bad",
      );
      return ok;
    },
  ),

  "group-anagrams": sim<[string[]]>(
    ["strs"],
    [
      [
        ["eat", "tea", "tan", "ate", "nat", "bat"],
        [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
      ],
      [[""], [[""]]],
      [["a"], [["a"]]],
    ],
    (t, strs) => {
      const groups = new Map<string, string[]>();
      t.step("Anagrams share the same letter counts, so use the counts as a hash-map key. Every word drops into its key's bucket.", [
        arr(strs.map((s) => s || '""')),
        map("letter counts → group", groups),
      ]);
      strs.forEach((s, i) => {
        const k = keyOf(s);
        const isNew = !groups.has(k);
        if (isNew) groups.set(k, []);
        groups.get(k)!.push(s);
        t.step(`"${s}" has counts ${k}. ${isNew ? "New key: start a new group." : `Join the group ${fmt(groups.get(k))}.`}`, [
          arr(
            strs.map((x) => x || '""'),
            { ptrs: { i }, tones: tones([range(0, i), "dim"], [[i], "cur"]) },
          ),
          map("letter counts → group", new Map([...groups].map(([kk, v]) => [kk, fmt(v)])), [k]),
        ]);
      });
      const res = [...groups.values()];
      t.step(
        `${res.length} group${res.length === 1 ? "" : "s"}. O(n·k) time with a counting key, no sorting.`,
        [
          out(
            "groups",
            res.map((g) => fmt(g)),
          ),
        ],
        "good",
      );
      return res;
    },
  ),

  "two-sum": sim<[number[], number]>(
    ["nums", "target"],
    [
      [[2, 7, 11, 15], 9, [0, 1]],
      [[3, 2, 4], 6, [1, 2]],
      [[3, 3], 6, [0, 1]],
    ],
    (t, nums, target) => {
      const seen = new Map<number, number>();
      t.step("One pass with a hash map from value to index. For each x, ask: have I already seen its complement, target − x?", [arr(nums), map("seen (value → index)", seen), vars({ target })]);
      for (let i = 0; i < nums.length; i++) {
        const x = nums[i];
        const need = target - x;
        if (seen.has(need)) {
          t.step(
            `x = ${x}, complement ${need} was seen at index ${seen.get(need)}. Answer [${seen.get(need)}, ${i}].`,
            [
              arr(nums, {
                ptrs: { i },
                tones: tones([[seen.get(need)!, i], "ok"]),
              }),
              map("seen (value → index)", seen, [need]),
              vars({ target, x, need }),
            ],
            "good",
          );
          return [seen.get(need)!, i];
        }
        seen.set(x, i);
        t.step(`x = ${x}: complement ${need} not seen yet. Remember ${x} → ${i}.`, [
          arr(nums, {
            ptrs: { i },
            tones: tones([range(0, i), "dim"], [[i], "cur"]),
          }),
          map("seen (value → index)", seen, [x]),
          vars({ target, x, need }),
        ]);
      }
      t.step("No pair found.", [arr(nums), map("seen (value → index)", seen)], "bad");
      return [];
    },
  ),

  "happy-number": sim<[number]>(
    ["n"],
    [
      [19, true],
      [2, false],
      [7, true],
    ],
    (t, n) => {
      need(Number.isInteger(n) && n > 0 && n < 1e9, "n must be a positive integer");
      const step = (x: number) => [...String(x)].reduce((a, d) => a + Number(d) ** 2, 0);
      const seq = [n];
      const at = (i: number) => {
        while (seq.length <= i) seq.push(step(seq[seq.length - 1]));
        return seq[i];
      };
      let s = 0;
      let f = 1;
      const show = (note: string, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            arr(seq, {
              label: "n → sum of squared digits → …",
              ptrs: { slow: s, fast: f },
              tones: tones([[s], "cmp"], [[f], at(f) === 1 ? "ok" : "alt"]),
            }),
            vars({ slow: at(s), fast: at(f) }),
          ],
          tone,
        );
      show(`Repeatedly replace n by the sum of the squares of its digits (${n} → ${at(1)}). The sequence either reaches 1 or loops forever, so use Floyd's slow/fast pointers instead of a set.`);
      while (at(f) !== 1 && at(s) !== at(f)) {
        s += 1;
        f += 2;
        at(f);
        show(`slow moves 1 step to ${at(s)}, fast moves 2 steps to ${at(f)}.`);
      }
      const happy = at(f) === 1;
      show(happy ? "fast reached 1: happy number." : `slow and fast met at ${at(s)} without passing 1: it's a cycle, not happy.`, happy ? "good" : "bad");
      return happy;
    },
  ),

  "contains-duplicate-ii": sim<[number[], number]>(
    ["nums", "k"],
    [
      [[1, 2, 3, 1], 3, true],
      [[1, 0, 1, 1], 1, true],
      [[1, 2, 3, 1, 2, 3], 2, false],
    ],
    (t, nums, k) => {
      const last = new Map<number, number>();
      t.step(`Remember the last index of every value. A repeat within distance k = ${k} answers true.`, [arr(nums), map("last index", last), vars({ k })]);
      for (let i = 0; i < nums.length; i++) {
        const x = nums[i];
        if (last.has(x) && i - last.get(x)! <= k) {
          t.step(
            `${x} was last at ${last.get(x)}: distance ${i - last.get(x)!} ≤ ${k}. true.`,
            [
              arr(nums, {
                ptrs: { i },
                win: [last.get(x)!, i],
                tones: tones([[last.get(x)!, i], "ok"]),
              }),
              map("last index", last, [x]),
              vars({ k }),
            ],
            "good",
          );
          return true;
        }
        const note = last.has(x) ? `${x} was last at ${last.get(x)}: distance ${i - last.get(x)!} > ${k}, too far. Update its index to ${i}.` : `${x} is new: remember index ${i}.`;
        last.set(x, i);
        t.step(note, [
          arr(nums, {
            ptrs: { i },
            win: [Math.max(0, i - k), i],
            tones: tones([[i], "cur"]),
          }),
          map("last index", last, [x]),
          vars({ k }),
        ]);
      }
      t.step("No close duplicates: false.", [arr(nums), map("last index", last)], "bad");
      return false;
    },
  ),

  "longest-consecutive-sequence": sim<[number[]]>(
    ["nums"],
    [
      [[100, 4, 200, 1, 3, 2], 4],
      [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1], 9],
    ],
    (t, nums) => {
      const s = new Set(nums);
      let best = 0;
      const vals = [...s];
      t.step("Put everything in a set. Only start counting from x when x − 1 is NOT in the set: that makes x the start of a run, so each run is walked exactly once. O(n) total.", [
        set("set", s),
        vars({ best }),
      ]);
      for (const x of vals) {
        if (s.has(x - 1)) {
          t.step(`${x}: ${x - 1} is in the set, so ${x} isn't the start of a run. Skip.`, [set("set", s, [x, x - 1]), vars({ best })]);
          continue;
        }
        let y = x;
        const run = [x];
        while (s.has(y + 1)) run.push(++y);
        best = Math.max(best, y - x + 1);
        t.step(`${x} starts a run: ${run.join(" → ")}, length ${run.length}. best = ${best}.`, [set("set", s, run), out("run", run), vars({ best })]);
      }
      t.step(`Longest consecutive run = ${best}.`, [set("set", s), vars({ best })], "good");
      return best;
    },
  ),
};
