import { Instagram } from "lucide-react";
import { Card } from "@/components/ui/card";

// Static placeholder — the Instagram API integration is a separate,
// later project. No live data here by design.
export function InstagramCard() {
  return (
    <Card className="flex items-start gap-3">
      <span className="rounded-md bg-surface-2 p-2">
        <Instagram className="h-4 w-4 text-muted" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-medium">Instagram</p>
        <p className="mt-0.5 text-xs text-muted">Coming soon — follower and engagement stats.</p>
      </div>
    </Card>
  );
}
