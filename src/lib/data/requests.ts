import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { RequestStatus } from "@/lib/constants";

export interface ContactRequest {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  status: RequestStatus;
  note: string | null;
  triagedAt: string | null;
}

interface SubmissionRow {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

interface TriageRow {
  submission_id: string;
  status: RequestStatus;
  note: string | null;
  updated_at: string;
}

// Contact-form submissions (product table, read-only here) joined with HQ's
// own triage rows. Both reads are founder-session, gated by RLS on
// public.is_founder() (sql/004). A submission with no triage row is "new".
// All fields are untrusted user input — render as plain text only.
export const getContactRequests = cache(
  async (): Promise<{ requests: ContactRequest[]; triageAvailable: boolean }> => {
    const supabase = createSupabaseServerClient();
    const [submissions, triage] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id, name, email, subject, message, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("hq_request_triage").select("submission_id, status, note, updated_at"),
    ]);

    if (submissions.error) {
      throw new Error(`Failed to load contact_submissions: ${submissions.error.message}`);
    }

    // Degrade gracefully if migration 004 hasn't been run yet — the inbox
    // still renders, just without status tracking.
    const triageAvailable = !triage.error;
    const triageById = new Map(
      ((triage.data ?? []) as unknown as TriageRow[]).map((t) => [t.submission_id, t])
    );

    const requests = ((submissions.data ?? []) as unknown as SubmissionRow[]).map((row) => {
      const t = triageById.get(row.id);
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        subject: row.subject,
        message: row.message,
        createdAt: row.created_at,
        status: t?.status ?? "new",
        note: t?.note ?? null,
        triagedAt: t?.updated_at ?? null,
      };
    });

    return { requests, triageAvailable };
  }
);

// Count of submissions still sitting at status "new" (no triage row counts
// as new). Powers the nav badge and the Overview alert card, so it renders
// inside the shared shell on EVERY page — it selects ids/status only, never
// message bodies, and swallows errors to 0 rather than breaking the layout
// (e.g. before sql/004 has been run).
export const getNewRequestCount = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient();
  const [submissions, triage] = await Promise.all([
    supabase.from("contact_submissions").select("id"),
    supabase.from("hq_request_triage").select("submission_id, status"),
  ]);

  if (submissions.error) return 0;

  const handled = new Set(
    ((triage.data ?? []) as unknown as { submission_id: string; status: RequestStatus }[])
      .filter((t) => t.status !== "new")
      .map((t) => t.submission_id)
  );

  return ((submissions.data ?? []) as unknown as { id: string }[]).filter(
    (row) => !handled.has(row.id)
  ).length;
});
