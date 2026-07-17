"use client";

import { usePathname } from "next/navigation";

// Wraps the header + page body in a container keyed on the route. The key
// forces a DOM remount on every navigation, replaying the CSS entrance
// animations below (see .canvas-enter / .stage-header / .stagger's
// --stagger-base in globals.css) — that's what makes the load-in
// choreography repeat on every page visit, not just the first.
export function Canvas({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="canvas-enter">
      <div className="stage-header">{header}</div>
      <div className="stage-body" style={{ "--stagger-base": "220ms" } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}
