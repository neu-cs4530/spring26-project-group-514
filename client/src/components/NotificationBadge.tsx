import "./NotificationBadge.css";

export default function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="notification-badge">{count > 99 ? "99+" : count}</span>;
}
