import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  label,
  hint,
}: {
  icon?: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-5 w-5 text-faint" strokeWidth={1.5} />
      <p className="text-sm text-muted">{label}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}
