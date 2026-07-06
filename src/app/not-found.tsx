// What non-founders (and bad URLs) see. Deliberately bare — no branding,
// no login link, nothing hinting an admin app lives here.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted">404 — This page could not be found.</p>
    </div>
  );
}
