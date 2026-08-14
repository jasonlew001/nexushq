import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { getValidAccessToken, fetchAccountStats, fetchRecentMedia } from "@/lib/instagram";

// Runs once/day via Vercel Cron (see vercel.json). No browser session to
// gate with requireFounder() — Vercel's infra calls this directly — so it's
// protected by a shared secret instead: Vercel auto-sends
// `Authorization: Bearer $CRON_SECRET` on every cron invocation IF (and only
// if) the project has an env var named exactly `CRON_SECRET` — not a
// project-specific name, that's a Vercel-reserved convention. Does two
// things: (1) refreshes the stored token if it's within 5 days of expiring
// (getValidAccessToken's own job, called here as the primary refresh
// mechanism — see the 5-day safety net in src/lib/instagram.ts for what
// covers a missed run), (2) snapshots today's follower/media/engagement
// stats for durability beyond Instagram's ~2-year insights retention window.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    // Not connected yet — expected pre-launch state, not a failure.
    return NextResponse.json({ status: "not_connected" });
  }

  const [stats, media] = await Promise.all([
    fetchAccountStats(token.igUserId, token.accessToken),
    fetchRecentMedia(token.igUserId, token.accessToken),
  ]);

  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const admin = getAdminClient();
  const { error } = await admin.from("hq_instagram_snapshots").upsert(
    {
      snapshot_date: new Date().toISOString().slice(0, 10),
      follower_count: stats.followerCount,
      media_count: stats.mediaCount,
      avg_likes: avg(media.map((m) => m.likeCount)),
      avg_comments: avg(media.map((m) => m.commentsCount)),
    },
    { onConflict: "snapshot_date" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", followerCount: stats.followerCount });
}
