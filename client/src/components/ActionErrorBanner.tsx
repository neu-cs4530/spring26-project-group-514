import "./ActionErrorBanner.css";

export default function ActionErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="action-error-banner">{error}</div>;
}
