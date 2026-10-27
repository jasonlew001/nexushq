"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { ATTENTION_COOKIE, readDismissed } from "@/lib/attention";

// Dismissals live in a per-browser cookie, keyed by item with a fingerprint
// of what the item was showing. The strip hides an item only while its
// fingerprint still matches, so a new past-due customer or more errors
// bring it straight back. No table: each founder clears their own view.
export async function dismissAttention(key: string, fingerprint: string): Promise<void> {
  await requireFounder();
  const dismissed = { ...readDismissed(), [key]: fingerprint };
  cookies().set(ATTENTION_COOKIE, JSON.stringify(dismissed), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  revalidatePath("/");
}

export async function restoreAttention(): Promise<void> {
  await requireFounder();
  cookies().delete(ATTENTION_COOKIE);
  revalidatePath("/");
}
