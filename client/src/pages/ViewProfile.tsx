import type { AchievementBadge, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserBadges, getUserById } from "../services/userService";

interface ViewProfileProps {
  username: string;
}
export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    | { type: "waiting" }
    | { type: "error"; msg: string }
    | { type: "profile"; user: SafeUserInfo; badges: AchievementBadge[] }
  >({ type: "waiting" });
  const timeSince = useTimeSince();

  useEffect(() => {
    let cancel = false;

    Promise.all([getUserById(username), getUserBadges(username)])
      .then(([profileResponse, badgeResponse]) => {
        if (cancel) return;
        if ("error" in profileResponse) {
          setComponentState({ type: "error", msg: profileResponse.error });
        } else {
          setComponentState({
            type: "profile",
            user: profileResponse,
            badges: "error" in badgeResponse ? [] : badgeResponse.badges,
          });
        }
      })
      .catch((err) => {
        if (cancel) return;
        setComponentState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancel = true;
    };
  }, [username]);

  switch (componentState.type) {
    case "error":
      return <div style={{ color: "#f00" }}>{componentState.msg}</div>;
    case "waiting":
      return <div>Loading...</div>;
    case "profile":
      return (
        <>
          <h2>Profile for {componentState.user.display}</h2>
          <div>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>Account created {timeSince(componentState.user.createdAt)}</li>
              <li>
                Badges: {componentState.badges.length > 0 ? componentState.badges.join(", ") : "None yet"}
              </li>
            </ul>
          </div>
        </>
      );
  }
}
