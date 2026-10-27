import { createHash } from "crypto";
import { cookies } from "next/headers";

export const ATTENTION_COOKIE = "hq_attention_dismissed";

// key -> fingerprint of the item as it was when dismissed.
export function readDismissed(): Record<string, string> {
  const raw = cookies().get(ATTENTION_COOKIE)?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Short, stable hash of whatever identifies an item's current state (ids,
// counts, a date), so the cookie stays small however long the lists get.
export function fingerprint(...parts: (string | number)[]): string {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12);
}
