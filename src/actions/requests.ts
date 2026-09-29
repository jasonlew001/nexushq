"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/constants";

// Upserts HQ's triage row for one contact submission. Never touches
// contact_submissions itself (product table, read-only from HQ). RLS on
// hq_request_triage is founder-only underneath; requireFounder() fails fast.
export async function updateRequestTriage(
  submissionId: string,
  input: { status: RequestStatus; note: string | null }
): Promise<void> {
  const founder = await requireFounder();

  if (!REQUEST_STATUSES.includes(input.status)) {
    throw new Error("Invalid status");
  }
  const note = input.note?.trim() || null;
  if (note && note.length > 1000) {
    throw new Error("Note must be 1000 characters or fewer");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_request_triage").upsert(
    {
      submission_id: submissionId,
      status: input.status,
      note,
      updated_at: new Date().toISOString(),
      updated_by: founder.userId,
    },
    { onConflict: "submission_id" }
  );

  if (error) throw new Error(`Failed to update request: ${error.message}`);
  revalidatePath("/requests");
}
