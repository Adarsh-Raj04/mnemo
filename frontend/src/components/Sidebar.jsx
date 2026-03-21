import { useLocation, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSessions, deleteSession } from "../api/chat";
import { InlineSpinner } from "./Spinner";
import { useState } from "react";

const NAV = [
  { path: "/documents", label: "Documents", icon: "📁" },
  { path: "/connectors", label: "Data Sources", icon: "🔌" },
  { path: "/sharing", label: "Sharing", icon: "🤝" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({
  activeSessionId,
  onSessionSelect,
  isOpen,
  onClose,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: listSessions,
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries(["sessions"]);
      if (activeSessionId === deletedId) {
        onSessionSelect(null); // ← tell parent session is gone
        navigate("/chat", { replace: true }); // ← clean URL
      }
    },
  });

  const visible = showAll ? sessions : sessions.slice(0, 5);

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* New chat */}
      <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          className="btn-primary w-full flex items-center justify-center gap-2"
          onClick={() => {
            onSessionSelect(null);
            navigate("/chat", { replace: true }); // ← clean URL, replace not push
            onClose?.();
          }}
        >
          <span>✏️</span> New Chat
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto p-3">
        <p
          className="text-xs font-medium mb-2 px-1"
          style={{ color: "var(--text-muted)" }}
        >
          Recent Chats
        </p>

        {isLoading && (
          <div className="flex justify-center py-4">
            <InlineSpinner />
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <p
            className="text-xs text-center py-4"
            style={{ color: "var(--text-muted)" }}
          >
            No chats yet
          </p>
        )}

        <div className="flex flex-col gap-0.5">
          {visible.map((session) => (
            <div
              key={session.id}
              className="group flex items-center gap-1 rounded-lg
                         px-2 py-2 cursor-pointer transition-all duration-100"
              style={{
                background:
                  activeSessionId === session.id
                    ? "var(--brand-light)"
                    : hoveredId === session.id
                      ? "var(--bg-secondary)"
                      : "transparent",
              }}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                onSessionSelect(session.id);
                navigate(`/chat/${session.id}`);
                onClose?.();
              }}
            >
              <span
                className="flex-1 text-sm truncate"
                style={{
                  color:
                    activeSessionId === session.id
                      ? "var(--brand)"
                      : "var(--text-primary)",
                }}
              >
                {session.title}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded
                           transition-all text-base leading-none"
                style={{ color: "var(--text-muted)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(session.id);
                }}
                title="Delete"
              >
                {deleteMutation.isPending ? <InlineSpinner size={12} /> : "×"}
              </button>
            </div>
          ))}
        </div>

        {sessions.length > 5 && (
          <button
            className="mt-2 w-full text-xs py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--brand)", background: "var(--brand-light)" }}
            onClick={() => setShowAll((s) => !s)}
          >
            {showAll ? "Show less ↑" : `See all ${sessions.length} →`}
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <p
          className="text-xs font-medium mb-2 px-1"
          style={{ color: "var(--text-muted)" }}
        >
          More
        </p>
        {NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => onClose?.()}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg
                       text-sm transition-colors duration-100"
            style={{
              background:
                location.pathname === item.path
                  ? "var(--brand-light)"
                  : "transparent",
              color:
                location.pathname === item.path
                  ? "var(--brand)"
                  : "var(--text-secondary)",
            }}
          >
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="md:hidden fixed top-0 left-0 h-full w-64 z-50
                   transition-transform duration-300"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 flex-shrink-0 h-full"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
