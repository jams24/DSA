import { arr, chars, fmt, need, out, range, sim, stack, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "valid-parentheses": sim<[string]>(
    ["s"],
    [
      ["()[]{}", true],
      ["([)]", false],
      ["{[()]}", true],
      ["((", false],
    ],
    (t, s) => {
      const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
      const st: string[] = [];
      t.step("Push every opener. Each closer must match the opener on top of the stack. The most recent unclosed bracket has to close first.", [chars(s), stack("stack", st)]);
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch in pairs) {
          const top = st.pop();
          if (top !== pairs[ch]) {
            t.step(
              top === undefined ? `'${ch}' has nothing to close: false.` : `'${ch}' needs '${pairs[ch]}' on top, but the top is '${top}': false.`,
              [
                chars(s, {
                  ptrs: { i },
                  tones: tones([range(0, i), "dim"], [[i], "bad"]),
                }),
                stack("stack", top ? [...st, top] : st),
              ],
              "bad",
            );
            return false;
          }
          t.step(`'${ch}' matches '${top}' on top: pop.`, [
            chars(s, {
              ptrs: { i },
              tones: tones([range(0, i), "dim"], [[i], "ok"]),
            }),
            stack("stack", st),
          ]);
        } else {
          st.push(ch);
          t.step(`'${ch}' opens: push.`, [
            chars(s, {
              ptrs: { i },
              tones: tones([range(0, i), "dim"], [[i], "cur"]),
            }),
            stack("stack", st),
          ]);
        }
      }
      const ok = st.length === 0;
      t.step(ok ? "Stack is empty at the end: valid." : `${st.length} opener${st.length === 1 ? "" : "s"} never closed: false.`, [chars(s), stack("stack", st)], ok ? "good" : "bad");
      return ok;
    },
  ),

  "simplify-path": sim<[string]>(
    ["path"],
    [
      ["/home/user/Documents/../Pictures", "/home/user/Pictures"],
      ["/home//foo/", "/home/foo"],
      ["/../", "/"],
      ["/a/./b/../../c/", "/c"],
    ],
    (t, path) => {
      const parts = path.split("/");
      const st: string[] = [];
      t.step("Split on '/'. A stack of directory names: '..' pops, '.' and empty parts do nothing, anything else is pushed.", [
        arr(
          parts.map((p) => p || "∅"),
          { label: "parts" },
        ),
        stack("stack", st),
      ]);
      parts.forEach((p, i) => {
        let note: string;
        if (p === "..") {
          note = st.length ? `'..': go up, pop '${st[st.length - 1]}'.` : "'..' at the root: nothing to pop.";
          st.pop();
        } else if (!p || p === ".") note = p ? "'.' means the current directory: skip." : "Empty part (from '//' or an edge '/'): skip.";
        else {
          st.push(p);
          note = `'${p}' is a directory name: push.`;
        }
        t.step(note, [
          arr(
            parts.map((x) => x || "∅"),
            {
              label: "parts",
              ptrs: { i },
              tones: tones([[i], p === ".." ? "bad" : !p || p === "." ? "dim" : "cur"]),
            },
          ),
          stack("stack", st),
        ]);
      });
      const res = "/" + st.join("/");
      t.step(`Join the stack: "${res}".`, [stack("stack", st), out("canonical path", [res])], "good");
      return res;
    },
  ),

  "min-stack": sim<[string[], number[][]]>(
    ["ops", "args"],
    [
      [
        ["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"],
        [[], [-2], [0], [-3], [], [], [], []],
        [null, null, null, null, -3, null, 0, -2],
      ],
      [
        ["MinStack", "push", "push", "push", "getMin", "pop", "getMin"],
        [[], [5], [3], [7], [], [], []],
        [null, null, null, null, 3, null, 3],
      ],
    ],
    (t, ops, args) => {
      const st: [number, number][] = [];
      const res: unknown[] = [];
      const show = (note: string) =>
        t.step(note, [
          stack(
            "stack (value | min so far)",
            st.map(([v, m]) => `${v} | ${m}`),
          ),
          out("returned", res.map(fmt)),
        ]);
      ops.forEach((op, k) => {
        if (op === "MinStack") {
          res.push(null);
          show("Store each value together with the minimum of the stack at that height. getMin then just reads the top pair.");
        } else if (op === "push") {
          const v = args[k][0];
          const m = st.length ? Math.min(v, st[st.length - 1][1]) : v;
          st.push([v, m]);
          res.push(null);
          show(`push(${v}): min so far = min(${v}, previous min) = ${m}.`);
        } else if (op === "pop") {
          need(st.length, "pop on an empty stack");
          const [v] = st.pop()!;
          res.push(null);
          show(`pop(): remove ${v}. The pair below already knows its own min, so nothing to recompute.`);
        } else if (op === "top") {
          need(st.length, "top on an empty stack");
          res.push(st[st.length - 1][0]);
          show(`top() = ${st[st.length - 1][0]}.`);
        } else if (op === "getMin") {
          need(st.length, "getMin on an empty stack");
          res.push(st[st.length - 1][1]);
          show(`getMin() = ${st[st.length - 1][1]}, read from the top pair in O(1).`);
        } else throw new Error(`unknown op ${op}`);
      });
      return res;
    },
  ),

  "evaluate-reverse-polish-notation": sim<[string[]]>(
    ["tokens"],
    [
      [["2", "1", "+", "3", "*"], 9],
      [["4", "13", "5", "/", "+"], 6],
      [["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"], 22],
    ],
    (t, tokens) => {
      const st: number[] = [];
      const ops: Record<string, (a: number, b: number) => number> = {
        "+": (a, b) => a + b,
        "-": (a, b) => a - b,
        "*": (a, b) => a * b,
        "/": (a, b) => Math.trunc(a / b),
      };
      t.step("Numbers go on a stack. An operator pops the top two (b first, then a), applies a op b, and pushes the result.", [arr(tokens), stack("stack", st)]);
      tokens.forEach((tok, i) => {
        if (tok in ops) {
          need(st.length >= 2, "not enough operands");
          const b = st.pop()!;
          const a = st.pop()!;
          const r = ops[tok](a, b);
          st.push(r);
          t.step(`'${tok}': pop ${b} and ${a}, push ${a} ${tok} ${b} = ${r}${tok === "/" ? " (truncated toward zero)" : ""}.`, [
            arr(tokens, {
              ptrs: { i },
              tones: tones([range(0, i), "dim"], [[i], "pick"]),
            }),
            stack("stack", st),
          ]);
        } else {
          need(!Number.isNaN(Number(tok)), `bad token ${tok}`);
          st.push(Number(tok));
          t.step(`${tok} is a number: push.`, [
            arr(tokens, {
              ptrs: { i },
              tones: tones([range(0, i), "dim"], [[i], "cur"]),
            }),
            stack("stack", st),
          ]);
        }
      });
      t.step(`The single value left is the answer: ${st[0]}.`, [stack("stack", st)], "good");
      return st[0];
    },
  ),

  "basic-calculator": sim<[string]>(
    ["s"],
    [
      ["1 + 1", 2],
      [" 2-1 + 2 ", 3],
      ["(1+(4+5+2)-3)+(6+8)", 23],
    ],
    (t, s) => {
      need(/^[\d+\-() ]*$/.test(s), "only digits, + − ( ) and spaces");
      let result = 0;
      let num = 0;
      let sign = 1;
      const st: [number, number][] = [];
      const show = (i: number, note: string, tone?: "good") =>
        t.step(
          note,
          [
            chars(s, {
              ptrs: i < s.length ? { i } : {},
              tones: tones([range(0, i), "dim"], [i < s.length ? [i] : [], "cur"]),
            }),
            vars({ result, sign: sign > 0 ? "+" : "−", num }),
            stack(
              "saved (result, sign) before '('",
              st.map(([r, sg]) => `${r}, ${sg > 0 ? "+" : "−"}`),
            ),
          ],
          tone,
        );
      show(0, "Only + and − with parentheses: keep a running result, the current number and its sign. '(' saves the outer state on a stack; ')' folds the inner result back in.");
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === " ") continue;
        if (/\d/.test(ch)) {
          num = num * 10 + Number(ch);
          show(i, `Digit ${ch}: num = ${num}.`);
        } else if (ch === "+" || ch === "-") {
          result += sign * num;
          num = 0;
          sign = ch === "+" ? 1 : -1;
          show(i, `'${ch}': add the pending number to result (${result}), and the next number is ${ch === "+" ? "added" : "subtracted"}.`);
        } else if (ch === "(") {
          st.push([result, sign]);
          result = 0;
          sign = 1;
          show(i, "'(': save (result, sign) and start a fresh sub-expression.");
        } else {
          result += sign * num;
          num = 0;
          const [prev, ps] = st.pop()!;
          const inner = result;
          result = prev + ps * result;
          show(i, `')': the inner value is ${inner}. Combine it with the saved state: ${prev} ${ps > 0 ? "+" : "−"} ${inner} = ${result}.`);
        }
      }
      const ans = result + sign * num;
      result = ans;
      num = 0;
      show(s.length, `Add the last number: ${ans}.`, "good");
      return ans;
    },
  ),
};
