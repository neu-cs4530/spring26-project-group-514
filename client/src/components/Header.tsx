import { useState, useRef, useEffect } from "react";
import useLoginContext from "../hooks/useLoginContext.ts";
import "./Header.css";
import { useNavigate } from "react-router-dom";

/**
 * Header component that renders the main title and user dropdown.
 */
export default function Header() {
  const { user, reset } = useLoginContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div id="header" className="header">
      <div className="title">GameNite!</div>
      <div className="user-dropdown" ref={dropdownRef}>
        <button className="user-dropdown-toggle" onClick={() => setOpen((prev) => !prev)}>
          Welcome, {user.display} ▾
        </button>
        {open && (
          <div className="user-dropdown-menu">
            <button
              className="user-dropdown-item"
              onClick={() => {
                setOpen(false);
                navigate(`/profile/${user.username}`);
              }}
            >
              View Profile
            </button>
            <button
              className="user-dropdown-item"
              onClick={() => {
                setOpen(false);
                reset();
                navigate("/login");
              }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
