import { Triangle, CloudOff } from "lucide-react";
import { Card } from "@/components/ui/card";

// Shown when VERCEL_TOKEN isn't configured. Says exactly what to do, since
// the fix is a one-time manual step only Jason can take.
export function VercelNotConnected({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="shrink-0 rounded-md bg-surface-2 p-2">
        <Triangle className="h-4 w-4 text-muted" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">Vercel isn&apos;t connected</p>
        {compact ? (
          <p className="mt-0.5 text-xs text-faint">Add VERCEL_TOKEN to see deploys and errors.</p>
        ) : (
          <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-faint">
            Create a token at vercel.com/account/settings/tokens scoped to &ldquo;Jason Lew&apos;s
            projects&rdquo;, add it as <code className="font-mono text-muted">VERCEL_TOKEN</code> in{" "}
            <code className="font-mono text-muted">.env.local</code> (and the nexushq project&apos;s
            env on Vercel), then restart. HQ only reads from Vercel.
          </p>
        )}
      </div>
    </Card>
  );
}

// connected but this fetch cycle failed: say so instead of showing zeros.
export function VercelUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="shrink-0 rounded-md bg-surface-2 p-2">
        <CloudOff className="h-4 w-4 text-faint" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{message} Retries automatically, or press Sync data.</p>
      </div>
    </Card>
  );
}
