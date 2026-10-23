// Runs every LeetCode 150 simulation on every example and checks the traced answer. Run with: npm run validate
import { LC150 } from "../src/content/leetcode150";
import { SIM_LOADERS } from "../src/content/sims";
import { TraceLimit, Tracer } from "../src/lib/sim/types";

export async function validateSims(errors: string[]) {
  let sims = 0;
  let cases = 0;
  let frames = 0;
  for (const cat of LC150) {
    const load = SIM_LOADERS[cat.category];
    if (!load) {
      errors.push(`sims: no simulation module for category ${cat.category}`);
      continue;
    }
    const { SIMS } = await load();
    for (const extra of Object.keys(SIMS)) if (!cat.problems.some((p) => p.slug === extra)) errors.push(`sims: ${extra} is not a ${cat.category} problem`);
    for (const p of cat.problems) {
      const s = SIMS[p.slug];
      if (!s) {
        errors.push(`sims: missing simulation for ${p.slug}`);
        continue;
      }
      sims++;
      if (s.cases.length < 2) errors.push(`sims: ${p.slug} needs at least 2 examples`);
      s.cases.forEach((c, i) => {
        if (c.length !== s.params.length + 1) return errors.push(`sims: ${p.slug} example ${i + 1} should have ${s.params.length} args + expected`);
        const t = new Tracer();
        try {
          const got = (s.run as (t: Tracer, ...a: unknown[]) => unknown)(t, ...structuredClone(c.slice(0, -1)));
          const want = c[c.length - 1];
          if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`sims: ${p.slug} example ${i + 1}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
        } catch (e) {
          errors.push(`sims: ${p.slug} example ${i + 1} ${e instanceof TraceLimit ? "hit the frame limit" : `threw ${e instanceof Error ? e.message : e}`}`);
        }
        if (t.frames.length < 2) errors.push(`sims: ${p.slug} example ${i + 1} has only ${t.frames.length} frame(s)`);
        for (const f of t.frames) if (!f.note.trim()) errors.push(`sims: ${p.slug} example ${i + 1} has a frame without narration`);
        frames += t.frames.length;
        cases++;
      });
    }
  }
  return { sims, cases, frames };
}

if (process.argv[1]?.endsWith("validate-sims.ts")) {
  const errors: string[] = [];
  validateSims(errors).then((r) => {
    for (const e of errors) console.log("✗", e);
    console.log(`${r.sims} simulations, ${r.cases} examples, ${r.frames} frames`);
    process.exit(errors.length ? 1 : 0);
  });
}
