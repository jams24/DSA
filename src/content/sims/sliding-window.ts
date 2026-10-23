import { arr, chars, map, need, out, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "minimum-size-subarray-sum": sim<[number, number[]]>(
    ["target", "nums"],
    [
      [7, [2, 3, 1, 2, 4, 3], 2],
      [4, [1, 4, 4], 1],
      [11, [1, 1, 1, 1, 1, 1, 1, 1], 0],
    ],
    (t, target, nums) => {
      let best = Infinity;
      let s = 0;
      let l = 0;
      let bestWin: [number, number] | null = null;
      const show = (r: number, note: string, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            arr(nums, {
              ptrs: r >= l ? { l, r } : { l },
              win: r >= l ? [l, r] : null,
              tones: tones([bestWin ? range(bestWin[0], bestWin[1] + 1) : [], "ok"]),
            }),
            vars({ sum: s, target, best: best === Infinity ? "∞" : best }),
          ],
          tone,
        );
      show(-1, "Grow the window to the right until its sum reaches the target, then shrink it from the left while it still does. Record the length each time it's valid.");
      for (let r = 0; r < nums.length; r++) {
        s += nums[r];
        show(r, `Add nums[${r}] = ${nums[r]}: sum = ${s}${s >= target ? ` ≥ ${target}` : ` < ${target}, keep growing`}.`);
        while (s >= target) {
          if (r - l + 1 < best) {
            best = r - l + 1;
            bestWin = [l, r];
          }
          show(r, `Window [${l}..${r}] has length ${r - l + 1} and sum ${s} ≥ ${target}. Best = ${best}. Drop nums[${l}] = ${nums[l]} to try a shorter one.`);
          s -= nums[l];
          l++;
        }
      }
      const ans = best === Infinity ? 0 : best;
      show(-1, ans ? `Shortest valid window has length ${ans}.` : "No window ever reached the target: return 0.", ans ? "good" : "bad");
      return ans;
    },
  ),

  "longest-substring-without-repeating-characters": sim<[string]>(
    ["s"],
    [
      ["abcabcbb", 3],
      ["bbbbb", 1],
      ["pwwkew", 3],
    ],
    (t, s) => {
      const last = new Map<string, number>();
      let l = 0;
      let best = 0;
      let bestWin: [number, number] = [0, -1];
      t.step("Keep a window with no repeats and remember the last index of every character. On a repeat inside the window, jump l past its previous position.", [
        chars(s),
        map("last seen", last),
        vars({ l, best }),
      ]);
      for (let r = 0; r < s.length; r++) {
        const ch = s[r];
        const prev = last.get(ch) ?? -1;
        let note: string;
        if (prev >= l) {
          l = prev + 1;
          note = `'${ch}' was last seen at ${prev}, inside the window. Jump l to ${l}.`;
        } else note = prev >= 0 ? `'${ch}' was last seen at ${prev}, before the window, so it's fine.` : `'${ch}' is new.`;
        last.set(ch, r);
        if (r - l + 1 > best) {
          best = r - l + 1;
          bestWin = [l, r];
          note += ` Window length ${best} is a new best.`;
        }
        t.step(note, [
          chars(s, {
            ptrs: { l, r },
            win: [l, r],
            tones: tones([prev >= 0 ? [prev] : [], prev >= l || prev === l - 1 ? "bad" : "dim"], [[r], "cur"]),
          }),
          map("last seen", last, [ch]),
          vars({ l, r, best }),
        ]);
      }
      t.step(
        `Longest substring without repeats: "${s.slice(bestWin[0], bestWin[1] + 1)}", length ${best}.`,
        [
          chars(s, {
            win: best ? bestWin : null,
            tones: tones([range(bestWin[0], bestWin[1] + 1), "ok"]),
          }),
          map("last seen", last),
          vars({ best }),
        ],
        "good",
      );
      return best;
    },
  ),

  "substring-with-concatenation-of-all-words": sim<[string, string[]]>(
    ["s", "words"],
    [
      ["barfoothefoobarman", ["foo", "bar"], [0, 9]],
      ["wordgoodgoodgoodbestword", ["word", "good", "best", "word"], []],
      ["barfoofoobarthefoobarman", ["bar", "foo", "the"], [6, 9, 12]],
    ],
    (t, s, words) => {
      need(words.length > 0 && words.every((w) => w.length === words[0].length && w.length > 0), "words must be non-empty and all the same length");
      const wl = words[0].length;
      const k = words.length;
      const needC = new Map<string, number>();
      for (const w of words) needC.set(w, (needC.get(w) ?? 0) + 1);
      const res: number[] = [];
      t.step(`All words have length ${wl}, so cut s into ${wl}-letter chunks. Run a sliding window over chunks for each of the ${wl} possible offsets, counting words like a multiset.`, [
        chars(s),
        map("need", needC),
        out("answer", res),
      ]);
      for (let off = 0; off < wl; off++) {
        let l = off;
        const seen = new Map<string, number>();
        let count = 0;
        const show = (r: number, note: string) =>
          t.step(note, [
            chars(s, {
              ptrs: { l },
              win: r + wl > l ? [l, r + wl - 1] : null,
              tones: tones([range(r, r + wl), "cur"]),
            }),
            map("need", needC),
            map("in window", seen),
            vars({ offset: off, count, k }),
            out("answer", res),
          ]);
        for (let r = off; r + wl <= s.length; r += wl) {
          const w = s.slice(r, r + wl);
          if (!needC.has(w)) {
            seen.clear();
            count = 0;
            l = r + wl;
            show(r, `"${w}" isn't one of the words. No valid window can contain it: reset after it.`);
            continue;
          }
          seen.set(w, (seen.get(w) ?? 0) + 1);
          count++;
          show(r, `Take "${w}" (${seen.get(w)} of ${needC.get(w)} allowed).`);
          while ((seen.get(w) ?? 0) > needC.get(w)!) {
            const drop = s.slice(l, l + wl);
            seen.set(drop, seen.get(drop)! - 1);
            count--;
            l += wl;
            show(r, `Too many "${w}". Drop "${drop}" from the left.`);
          }
          if (count === k) {
            res.push(l);
            const drop = s.slice(l, l + wl);
            show(r, `The window holds all ${k} words exactly once each: record index ${l}. Then slide past "${drop}".`);
            seen.set(drop, seen.get(drop)! - 1);
            count--;
            l += wl;
          }
        }
      }
      t.step(
        `Starting indexes: ${res.length ? res.join(", ") : "none"}.`,
        [
          chars(s, {
            tones: tones([res.flatMap((i) => range(i, i + wl * k)), "ok"]),
          }),
          out("answer", res),
        ],
        "good",
      );
      return res;
    },
  ),

  "minimum-window-substring": sim<[string, string]>(
    ["s", "t"],
    [
      ["ADOBECODEBANC", "ABC", "BANC"],
      ["a", "a", "a"],
      ["a", "aa", ""],
    ],
    (tr, s, t) => {
      need(t.length > 0, "t must not be empty");
      const needC = new Map<string, number>();
      for (const c of t) needC.set(c, (needC.get(c) ?? 0) + 1);
      let missing = t.length;
      let l = 0;
      let start = 0;
      let end = Infinity;
      const best = () => (end === Infinity ? "—" : s.slice(start, end + 1));
      const show = (r: number, note: string, tone?: "good" | "bad") =>
        tr.step(
          note,
          [
            chars(s, {
              ptrs: r >= 0 ? { l, r } : {},
              win: r >= l ? [l, r] : null,
              tones: tones([end === Infinity ? [] : range(start, end + 1), "ok"]),
            }),
            map("need (negative = spare)", needC),
            vars({ missing, best: best() }),
          ],
          tone,
        );
      show(-1, `need counts what the window still owes; missing = ${missing} characters of t are not yet covered. Grow right until missing = 0, then shrink from the left.`);
      for (let r = 0; r < s.length; r++) {
        const ch = s[r];
        const useful = (needC.get(ch) ?? 0) > 0;
        if (useful) missing--;
        needC.set(ch, (needC.get(ch) ?? 0) - 1);
        show(r, useful ? `'${ch}' is needed: missing = ${missing}.` : `'${ch}' isn't needed (or is spare): need['${ch}'] = ${needC.get(ch)}.`);
        if (missing === 0) {
          while (needC.get(s[l])! < 0) {
            needC.set(s[l], needC.get(s[l])! + 1);
            l++;
            show(r, `'${s[l - 1]}' at the left is spare: shrink l to ${l}.`);
          }
          if (r - l < end - start) {
            start = l;
            end = r;
          }
          show(r, `Window "${s.slice(l, r + 1)}" covers t. Best so far: "${best()}". Give up '${s[l]}' to look for a shorter one.`);
          needC.set(s[l], needC.get(s[l])! + 1);
          missing++;
          l++;
        }
      }
      const res = end === Infinity ? "" : s.slice(start, end + 1);
      show(-1, res ? `Minimum window = "${res}".` : "No window covers t: return the empty string.", res ? "good" : "bad");
      return res;
    },
  ),
};
