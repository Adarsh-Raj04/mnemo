import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/");
  }

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
      style={{
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Left side — hamburger (mobile only) + logo */}
      <div className="flex items-center gap-2">
        {user && (
          <button
            className="md:hidden flex items-center justify-center
                       w-9 h-9 rounded-lg transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            onClick={onMenuClick}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 4h14M2 9h14M2 14h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        <Link
          to={user ? "/chat" : "/"}
          className="flex items-center gap-2 font-semibold text-sm"
          style={{ color: "var(--brand)" }}
        >
          <span style={{ fontSize: 20 }}>🧬</span>
          <span>Mnemo</span>
        </Link>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         text-sm font-medium transition-all"
              style={{
                background: open ? "var(--bg-tertiary)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              {user.name}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  color: "var(--text-muted)",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                <path
                  d="M2 4L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {open && (
              <div
                className="absolute right-0 mt-2 w-44 rounded-xl overflow-hidden z-50"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div
                  className="px-3 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p
                    className="text-xs mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Theme
                  </p>
                  <ThemeToggle />
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                  style={{ color: "var(--danger)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--danger-light)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary text-xs px-3 py-1.5">
              Login
            </Link>
            <Link
              to="/login?tab=signup"
              className="btn-primary text-xs px-3 py-1.5"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
