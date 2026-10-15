"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// All writes are founder-session; RLS (sql/005) is the real gate — own-row
// only for favorites and notes, `hidden` is the only post column writable.
// requireFounder() just fails fast with a clean 404 instead of an RLS error.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string) {
  if (!UUID_RE.test(id)) throw new Error("Invalid id");
}

function done(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Failed to ${what}: ${error.message}`);
  revalidatePath("/inspiration");
}

export async function setFavorite(postId: string, on: boolean): Promise<void> {
  const founder = await requireFounder();
  assertId(postId);
  const supabase = createSupabaseServerClient();
  const { error } = on
    ? await supabase
        .from("hq_inspo_favorites")
        .upsert({ post_id: postId, user_id: founder.userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await supabase.from("hq_inspo_favorites").delete().eq("post_id", postId).eq("user_id", founder.userId);
  done(error, "update favorite");
}

export async function setHidden(postId: string, hidden: boolean): Promise<void> {
  await requireFounder();
  assertId(postId);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_inspo_posts").update({ hidden }).eq("id", postId);
  done(error, hidden ? "hide post" : "unhide post");
}

export async function createBoard(name: string): Promise<string> {
  await requireFounder();
  const clean = name.trim();
  if (!clean || clean.length > 60) throw new Error("Board name must be 1–60 characters");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("hq_inspo_boards").insert({ name: clean }).select("id").single();
  if (error?.code === "23505") throw new Error("A board with that name already exists");
  done(error, "create board");
  return (data as { id: string }).id;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await requireFounder();
  assertId(boardId);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_inspo_boards").delete().eq("id", boardId);
  done(error, "delete board");
}

export async function setOnBoard(postId: string, boardId: string, on: boolean): Promise<void> {
  await requireFounder();
  assertId(postId);
  assertId(boardId);
  const supabase = createSupabaseServerClient();
  const { error } = on
    ? await supabase
        .from("hq_inspo_board_posts")
        .upsert({ post_id: postId, board_id: boardId }, { onConflict: "board_id,post_id", ignoreDuplicates: true })
    : await supabase.from("hq_inspo_board_posts").delete().eq("post_id", postId).eq("board_id", boardId);
  done(error, "update board");
}

export async function addNote(postId: string, body: string): Promise<void> {
  await requireFounder();
  assertId(postId);
  const clean = body.trim();
  if (!clean || clean.length > 2000) throw new Error("Note must be 1–2000 characters");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_inspo_notes").insert({ post_id: postId, body: clean });
  done(error, "add note");
}

export async function deleteNote(noteId: string): Promise<void> {
  await requireFounder();
  assertId(noteId);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hq_inspo_notes").delete().eq("id", noteId);
  done(error, "delete note");
}
