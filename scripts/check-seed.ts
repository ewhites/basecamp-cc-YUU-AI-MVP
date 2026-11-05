/** Sanity report on the seeded patterns (run after `npm run seed`). Uses the service role, read-only. */
import { skillLevels, stuckStudents, type CheckRow } from "../src/lib/insights";
import { adminClient } from "../src/lib/supabase/admin";

async function main() {
  const db = adminClient();
  const rows: CheckRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("check_results")
      .select("attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at)")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data as unknown as { attempt_id: string; check_key: string; skill: CheckRow["skill"]; pass: boolean; attempts: { student_id: string; created_at: string } }[])
      rows.push({ attempt_id: r.attempt_id, check_key: r.check_key, skill: r.skill, pass: r.pass, student_id: r.attempts.student_id, created_at: r.attempts.created_at });
    if (data.length < 1000) break;
  }
  const levels = skillLevels(rows);
  const flags = stuckStudents(levels);
  const bySection = (s: string) => flags.filter((f) => f.student_id.startsWith(`S-${s}-`));
  for (const s of ["A", "B", "C"]) {
    const f = bySection(s);
    console.log(`Section ${s}: ${f.length} flags`, f.map((x) => `${x.student_id}:${x.skill}:${Math.round(x.current * 100)}%`).join(" "));
  }
  let improved = 0, total = 0;
  for (const lv of levels.values()) {
    const first = Object.values(lv).map((l) => l.first ?? 0).reduce((a, b) => a + b, 0);
    const cur = Object.values(lv).map((l) => l.current ?? 0).reduce((a, b) => a + b, 0);
    total++;
    if (cur > first) improved++;
  }
  console.log(`Students improving first -> current: ${improved}/${total}`);
  for (const s of ["A", "B", "C"]) {
    const vals = [...levels.entries()].filter(([id]) => id.startsWith(`S-${s}-`)).map(([, lv]) => lv.discernment.current ?? 0);
    console.log(`Section ${s} discernment avg: ${Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)}%`);
  }
}
main();
