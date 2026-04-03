import "./SideBarNav.css";
import { useState } from "react";
import { NavLink, type NavLinkRenderProps } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import useNotifications from "../hooks/useNotifications.ts";
import NotificationBadge from "./NotificationBadge.tsx";

export default function SideBarNav() {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const { username } = useAuth();
  const { friendRequestCount, totalUnreadMessages } = useNotifications();

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };
  const navClass = ({ isActive }: NavLinkRenderProps) =>
    `menu_button ${isActive ? "menu_selected" : ""}`;

  return (
    <div className="sideBarNav">
      <NavLink to="/" className={navClass}>
        Home
      </NavLink>
      <NavLink to="/games" className={navClass}>
        Games
      </NavLink>
      <NavLink to="/lobbies" className={navClass}>
        Lobbies
      </NavLink>
      <NavLink to="/forum" className={navClass}>
        Forum
      </NavLink>
      <NavLink
        to={`/profile/${username}`}
        id="menu_user"
        className={navClass}
        onClick={toggleOptions}
      >
        Profile
      </NavLink>
      <NavLink to="/leaderboard" className={navClass}>
        Leaderboard
      </NavLink>
      <NavLink to="/match-history" className={navClass}>
        Match History
      </NavLink>
      <NavLink to="/friends" className={navClass}>
        Friends
        <NotificationBadge count={friendRequestCount} />
      </NavLink>
      <NavLink to="/dm" className={navClass}>
        Messages
        <NotificationBadge count={totalUnreadMessages} />
      </NavLink>
    </div>
  );
}
