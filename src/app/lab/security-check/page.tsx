import { SampleTag } from "@/components/Tags";
import { getViewer } from "@/lib/session";
import { userClient } from "@/lib/db";
import { redirect } from "next/navigation";

/**
 * Live row-level security demo (PRD: "show that in the demo"). Every query below runs AS the
 * signed-in user, with no extra filtering in app code, and deliberately asks for data the
 * user should not have. Postgres RLS decides what comes back.
 */
export default async function SecurityCheck() {
  const v = await getViewer();
  if (!v) redirect("/");
  const db = await userClient();

  const probes: { label: string; expect: string; run: () => Promise<{ rows: number; detail?: string }> }[] = [];
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    return { rows: n ?? 0, detail: error?.message };
  };
  const rpcBlocked = async (q: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await q;
    return { rows: error ? 0 : 1, detail: error ? `Refused: ${error.message}` : "Allowed" };
  };

  if (v.role === "student") {
    probes.push(
      { label: "My own attempts", expect: "some", run: () => count(db.from("attempts").select("id", { count: "exact", head: true })) },
      { label: "Another student's attempts (S-B-001, same section)", expect: "0", run: () => count(db.from("attempts").select("id", { count: "exact", head: true }).eq("student_id", "S-B-001")) },
      { label: "Students in Section A", expect: "0", run: () => count(db.from("students").select("id", { count: "exact", head: true }).eq("section_id", "A")) },
      { label: "Every student record", expect: "1 (me)", run: () => count(db.from("students").select("id", { count: "exact", head: true })) },
      { label: "Audit log", expect: "0", run: () => count(db.from("audit_log").select("id", { count: "exact", head: true })) },
      { label: "Override my own score (RPC)", expect: "refused", run: () => rpcBlocked(db.rpc("override_check", { p_attempt: "00000000-0000-4000-8000-000000000001", p_key: "role", p_pass: true, p_note: "self-grade" })) },
    );
  } else if (v.role === "instructor") {
    probes.push(
      { label: "Students in my sections (B and C)", expect: "80", run: () => count(db.from("students").select("id", { count: "exact", head: true }).in("section_id", ["B", "C"])) },
      { label: "Students in Section A (not mine)", expect: "0", run: () => count(db.from("students").select("id", { count: "exact", head: true }).eq("section_id", "A")) },
      { label: "Attempts by Section A students", expect: "0", run: () => count(db.from("attempts").select("id", { count: "exact", head: true }).like("student_id", "S-A-%")) },
      { label: "Usage and spend ledger", expect: "0", run: () => count(db.from("usage_ledger").select("id", { count: "exact", head: true })) },
      { label: "Release Section A scores to the gradebook (RPC)", expect: "refused", run: () => rpcBlocked(db.rpc("release_scores", { p_section: "A" })) },
    );
  } else if (v.role === "curriculum") {
    probes.push(
      { label: "Student records (names)", expect: "0", run: () => count(db.from("students").select("id", { count: "exact", head: true })) },
      { label: "Raw attempts", expect: "0", run: () => count(db.from("attempts").select("id", { count: "exact", head: true })) },
      { label: "Aggregate check stats (no names)", expect: "some", run: async () => {
        const { data, error } = await db.rpc("curriculum_check_stats");
        return { rows: data?.length ?? 0, detail: error?.message };
      } },
    );
  } else {
    probes.push(
      { label: "All accounts and roles", expect: "some", run: () => count(db.from("profiles").select("id", { count: "exact", head: true })) },
      { label: "Student work, read directly", expect: "0", run: () => count(db.from("attempts").select("id", { count: "exact", head: true })) },
      { label: "Student work without a reason (break-glass RPC)", expect: "refused", run: () => rpcBlocked(db.rpc("admin_view_student_work", { p_student: "S-B-001", p_reason: "" })) },
      { label: "Override a score (RPC)", expect: "refused", run: () => rpcBlocked(db.rpc("override_check", { p_attempt: "00000000-0000-4000-8000-000000000001", p_key: "role", p_pass: true, p_note: "admin" })) },
    );
  }

  const results = await Promise.all(probes.map(async (p) => ({ ...p, ...(await p.run()) })));
  const ok = (r: (typeof results)[number]) =>
    r.expect === "some" ? r.rows > 0 : r.expect === "refused" ? r.rows === 0 : r.expect.startsWith("1") ? r.rows === 1 : r.rows === Number(r.expect);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Security check</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Live queries run as <b>{v.name}</b> ({v.role}). The app adds no filters: Postgres row-level security decides what comes back.
          </p>
        </div>
      </div>
      <section className="card">
        <table className="table" data-testid="security-probes">
          <thead>
            <tr>
              <th>Query</th>
              <th>Expected</th>
              <th>Rows returned</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label}>
                <td>
                  {r.label}
                  {r.detail && <div className="small muted">{r.detail}</div>}
                </td>
                <td>{r.expect}</td>
                <td>{r.expect === "refused" ? (r.rows === 0 ? "refused" : "allowed") : r.rows}</td>
                <td>{ok(r) ? <span className="tag tag-pass">Blocked as expected</span> : <span className="tag tag-fail">Unexpected</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="small muted">Switch roles from the menu at the top right to run the same checks as another account.</p>
    </div>
  );
}
