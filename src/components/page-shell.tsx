// Page wrapper: one serif headline per route + a muted description line.
// Navigation lives in the sidebar, so no back-link here.
export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageTitle title={title} description={description} />
      {children}
    </div>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[34px] leading-none tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-[13px] text-muted">{description}</p>}
    </div>
  );
}
