import { arr, fmt, line, need, out, range, sim, tones, vars } from "@/lib/sim/build";
import type { LinePanel, Sim, Tone } from "@/lib/sim/types";

type Iv = [number, number];
const isIvs = (xs: unknown) => Array.isArray(xs) && xs.every((x) => Array.isArray(x) && x.length === 2 && x[0] <= x[1]);
const row = (label: string, ivs: Iv[], tone: (i: number) => Tone | undefined = () => undefined): LinePanel["rows"][number] => ({
  label,
  items: ivs.map(([s, e], i) => ({ s, e, tone: tone(i), text: `${s},${e}` })),
});

export const SIMS: Record<string, Sim> = {
  "summary-ranges": sim<[number[]]>(
    ["nums"],
    [
      [
        [0, 1, 2, 4, 5, 7],
        ["0->2", "4->5", "7"],
      ],
      [
        [0, 2, 3, 4, 6, 8, 9],
        ["0", "2->4", "6", "8->9"],
      ],
    ],
    (t, nums) => {
      const res: string[] = [];
      let i = 0;
      t.step("Sorted and unique: extend j while the next number is exactly one more, then emit the range nums[i]..nums[j].", [arr(nums), out("ranges", res)]);
      while (i < nums.length) {
        let j = i;
        while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) {
          j++;
          t.step(`${nums[j]} = ${nums[j - 1]} + 1: extend the run.`, [
            arr(nums, {
              ptrs: { i, j },
              win: [i, j],
              tones: tones([[j], "cur"]),
            }),
            out("ranges", res),
          ]);
        }
        res.push(i === j ? String(nums[i]) : `${nums[i]}->${nums[j]}`);
        t.step(`${j + 1 < nums.length ? `${nums[j + 1]} breaks the run. ` : ""}Emit "${res[res.length - 1]}".`, [
          arr(nums, {
            ptrs: { i, j },
            win: [i, j],
            tones: tones([range(i, j + 1), "ok"]),
          }),
          out("ranges", res, [res.length - 1]),
        ]);
        i = j + 1;
      }
      t.step(`Ranges: ${fmt(res)}.`, [arr(nums), out("ranges", res)], "good");
      return res;
    },
  ),

  "merge-intervals": sim<[Iv[]]>(
    ["intervals"],
    [
      [
        [
          [1, 3],
          [2, 6],
          [8, 10],
          [15, 18],
        ],
        [
          [1, 6],
          [8, 10],
          [15, 18],
        ],
      ],
      [
        [
          [1, 4],
          [4, 5],
        ],
        [[1, 5]],
      ],
      [
        [
          [4, 7],
          [1, 4],
          [9, 12],
          [10, 11],
        ],
        [
          [1, 7],
          [9, 12],
        ],
      ],
    ],
    (t, ivs) => {
      need(isIvs(ivs), "intervals look like [[1,3],[2,6]] with start ≤ end");
      t.step("Sort by start. Then each interval either overlaps the last merged one (extend its end) or starts a new one.", [line(ivs.map((iv, k) => row(k ? "" : "input", [iv])))]);
      ivs.sort((a, b) => a[0] - b[0]);
      const res: Iv[] = [];
      ivs.forEach(([s, e], i) => {
        const last = res[res.length - 1];
        let note: string;
        if (last && s <= last[1]) {
          note = `[${s},${e}] starts at ${s} ≤ ${last[1]}, the end of the last merged interval: overlap. Extend it to end at max(${last[1]}, ${e}) = ${Math.max(last[1], e)}.`;
          last[1] = Math.max(last[1], e);
        } else {
          note = last ? `[${s},${e}] starts after ${last[1]}: no overlap. Start a new interval.` : `First interval [${s},${e}] starts the result.`;
          res.push([s, e]);
        }
        t.step(note, [
          line([...ivs.map((iv, k) => row(k ? "" : "sorted", [iv], () => (k === i ? "cur" : k < i ? "dim" : undefined))), row("merged", res, (k) => (k === res.length - 1 ? "ok" : undefined))]),
        ]);
      });
      t.step(`Merged: ${fmt(res)}.`, [line([row("merged", res, () => "ok")])], "good");
      return res;
    },
  ),

  "insert-interval": sim<[Iv[], Iv]>(
    ["intervals", "newInterval"],
    [
      [
        [
          [1, 3],
          [6, 9],
        ],
        [2, 5],
        [
          [1, 5],
          [6, 9],
        ],
      ],
      [
        [
          [1, 2],
          [3, 5],
          [6, 7],
          [8, 10],
          [12, 16],
        ],
        [4, 8],
        [
          [1, 2],
          [3, 10],
          [12, 16],
        ],
      ],
    ],
    (t, ivs, nw) => {
      need(isIvs(ivs) && isIvs([nw]), "intervals look like [[1,3],[6,9]] and newInterval like [2,5]");
      const res: Iv[] = [];
      let [s, e] = nw;
      let i = 0;
      const show = (note: string, tone?: "good") =>
        t.step(note, [line([row("intervals", ivs, (k) => (k === i ? "cur" : k < i ? "dim" : undefined)), row("new", [[s, e]], () => "pick"), row("result", res, () => "ok")])], tone);
      show("Three phases over the sorted list: copy intervals that end before the new one, merge every interval that overlaps it, then copy the rest.");
      while (i < ivs.length && ivs[i][1] < s) {
        res.push(ivs[i]);
        i++;
        show(`[${ivs[i - 1]}] ends before ${s}: copy it as is.`);
      }
      while (i < ivs.length && ivs[i][0] <= e) {
        s = Math.min(s, ivs[i][0]);
        e = Math.max(e, ivs[i][1]);
        i++;
        show(`[${ivs[i - 1]}] overlaps: absorb it, so the new interval becomes [${s},${e}].`);
      }
      res.push([s, e]);
      show(`No more overlaps: add [${s},${e}].`);
      while (i < ivs.length) {
        res.push(ivs[i]);
        i++;
        show(`[${ivs[i - 1]}] starts after ${e}: copy it.`);
      }
      show(`Result: ${fmt(res)}.`, "good");
      return res;
    },
  ),

  "minimum-number-of-arrows-to-burst-balloons": sim<[Iv[]]>(
    ["points"],
    [
      [
        [
          [10, 16],
          [2, 8],
          [1, 6],
          [7, 12],
        ],
        2,
      ],
      [
        [
          [1, 2],
          [3, 4],
          [5, 6],
          [7, 8],
        ],
        4,
      ],
      [
        [
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
        ],
        2,
      ],
    ],
    (t, pts) => {
      need(isIvs(pts), "points look like [[10,16],[2,8]] with start ≤ end");
      t.step(
        "Sort balloons by END. Shoot an arrow at the end of the first balloon still standing: that's as far right as it can go while still hitting it, so it pops as many later balloons as possible.",
        [
          line(
            pts.map(([s, e], i) => ({
              label: `#${i}`,
              items: [{ s, e, text: `${s},${e}` }],
            })),
          ),
        ],
      );
      pts.sort((a, b) => a[1] - b[1]);
      let arrows = 0;
      let arrow = -Infinity;
      const marks: { x: number; tone: Tone; text: string }[] = [];
      const popped = new Set<number>();
      pts.forEach(([s, e], i) => {
        let note: string;
        if (s > arrow) {
          arrows++;
          arrow = e;
          marks.push({ x: e, tone: "bad", text: `🏹${arrows}` });
          note = `Balloon [${s},${e}] isn't hit by any arrow so far. Shoot arrow #${arrows} at x = ${e}.`;
        } else note = `Balloon [${s},${e}] starts at ${s} ≤ ${arrow}: the last arrow already pops it.`;
        popped.add(i);
        t.step(note, [
          line(
            pts.map(([a, b], k) => ({
              label: `#${k}`,
              items: [
                {
                  s: a,
                  e: b,
                  text: `${a},${b}`,
                  tone: k === i ? "cur" : popped.has(k) ? "ok" : undefined,
                },
              ],
            })),
            { marks },
          ),
          vars({ arrows }),
        ]);
      });
      t.step(
        `${arrows} arrow${arrows === 1 ? "" : "s"} pop every balloon.`,
        [
          line(
            pts.map(([a, b], k) => ({
              label: `#${k}`,
              items: [{ s: a, e: b, text: `${a},${b}`, tone: "ok" }],
            })),
            { marks },
          ),
          vars({ arrows }),
        ],
        "good",
      );
      return arrows;
    },
  ),
};
