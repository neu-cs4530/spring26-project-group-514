import { useEffect, useState } from "react";

/**
 * Custom hook to display error responses from server to users
 * @returns the current error state.
 */
export default function useActionError(timeout = 4000) {
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), timeout);
    return () => clearTimeout(timer);
  }, [actionError, timeout]);

  return { actionError, setActionError };
}
