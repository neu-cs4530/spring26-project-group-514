export function CheckIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <polyline points="3,8 7,12 13,4" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

export function BlockedIcon() {
  return (
    <svg
      width="1em"
      height="1.5em"
      viewBox="0 2 16 16"
      fill="currentColor"
      style={{ marginRight: 4 }}
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
