import { formatRelativeTime } from "@/lib/format";

export function Header({ refreshedAt }: { refreshedAt: string }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold tracking-tight">
        Nexus <span className="text-gold">HQ</span>
      </h1>
      <p className="text-xs text-faint">
        Data refreshed <span className="tnum">{formatRelativeTime(refreshedAt)}</span>
      </p>
    </header>
  );
}
