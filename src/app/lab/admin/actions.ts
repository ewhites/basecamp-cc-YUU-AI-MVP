"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { userClient } from "@/lib/db";

export interface BreakGlassRow {
  attempt_id: string;
  exercise_id: string;
  attempt_no: number;
  status: string;
  passed: number | null;
  total: number | null;
  input: Record<string, unknown>;
  created_at: string;
}

export type BreakGlassResult = { ok: true; studentId: string; rows: BreakGlassRow[] } | { ok: false; error: string };

/**
 * Break-glass read of one student's work. Re-checks the admin role here, and the database
 * function re-checks it again, requires the reason, and writes the audit row.
 */
export async function viewStudentWorkAction(studentId: string, reason: string): Promise<BreakGlassResult> {
  await requireRole("admin");
  const sid = studentId.trim();
  const why = reason.trim();
  if (!sid) return { ok: false, error: "Enter a student ID, for example S-B-007." };
  if (sid.length > 40) return { ok: false, error: "That student ID is too long." };
  if (why.length < 10) return { ok: false, error: "Give a reason of at least 10 characters." };
  if (why.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };

  const db = await userClient();
  const { data, error } = await db.rpc("admin_view_student_work", { p_student: sid, p_reason: why });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/lab/admin");
  return { ok: true, studentId: sid, rows: (data ?? []) as BreakGlassRow[] };
}
