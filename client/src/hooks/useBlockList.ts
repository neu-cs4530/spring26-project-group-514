import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useMemo, useState } from "react";
import {
  blockUser as blockUserAPI,
  unblockUser as unblockUserAPI,
  getBlockList,
} from "../services/blockService.ts";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";

export default function useBlockList() {
  const { user, pass } = useLoginContext();
  const auth = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<SafeUserInfo[]>([]);
  const [blockError, setError] = useState<string | null>(null);
  const [blockLoading, setLoading] = useState(true);

  const blockedSet = useMemo(
    () => new Set(Array.isArray(blockedUsers) ? blockedUsers.map((u) => u.username) : []),
    [blockedUsers],
  );

  useEffect(() => {
    getBlockList(user.username, pass).then((result) => {
      if (Array.isArray(result)) {
        setBlockedUsers(result);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, [user.username, pass]);

  // blockUser: return error or null on success
  const blockUser = async (blockedUsername: string): Promise<string | null> => {
    const result = await blockUserAPI(auth, blockedUsername);
    if (!result || "error" in result) return result?.error ?? "Unknown Error";
    setBlockedUsers((prev) => (Array.isArray(prev) ? [...prev, result] : [result]));
    return null;
  };

  // unblockUser: return error or null on success
  const unblockUser = async (blockedUsername: string): Promise<string | null> => {
    const result = await unblockUserAPI(auth, blockedUsername);
    if (!result || "error" in result) return result?.error ?? "Unknown Error";
    setBlockedUsers((prev) =>
      Array.isArray(prev) ? prev.filter((u) => u.username !== blockedUsername) : prev,
    );
    return null;
  };

  return {
    blockedUsers,
    blockedSet,
    blockError,
    blockLoading,
    blockUser,
    unblockUser,
  };
}
