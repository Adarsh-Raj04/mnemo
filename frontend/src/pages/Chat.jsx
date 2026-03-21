import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom"; // ← add useParams
import { getMessages, askQuestion } from "../api/chat";
import { getSharedWithMe } from "../api/sharing";
import { UserBubble, AIBubble } from "../components/ChatBubble";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ProgressBar, InlineSpinner } from "../components/Spinner";

export default function Chat() {
  const { sessionId: urlSessionId } = useParams(); // ← read from URL
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(urlSessionId || null);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ownerId, setOwnerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);

  // Sync URL → state when user navigates directly to /chat/:id
  useEffect(() => {
    if (urlSessionId && urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
      setMessages([]);
    }
    if (!urlSessionId) {
      setSessionId(null);
      setMessages([]);
    }
  }, [urlSessionId]);

  // Load messages when session changes
  const { data: fetchedMessages, isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => getMessages(sessionId),
    enabled: !!sessionId,
  });

  const { data: sharedKBs = [] } = useQuery({
    queryKey: ["sharedWithMe"],
    queryFn: getSharedWithMe,
  });

  useEffect(() => {
    if (sessionId && fetchedMessages) {
      setMessages(fetchedMessages);
    } else if (!sessionId) {
      setMessages([]); // ← clear immediately when no session
    }
  }, [fetchedMessages, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When session is selected from sidebar — update URL
  function handleSessionSelect(id) {
    setSessionId(id);
    setMessages([]); // ← always clear messages immediately
    setError(""); // ← clear any error too
    setQuestion(""); // ← clear input too
    if (id) {
      navigate(`/chat/${id}`, { replace: true });
    } else {
      navigate("/chat", { replace: true });
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!question.trim() || sending) return;
    setError("");

    const userMsg = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const data = await askQuestion({
        session_id: sessionId,
        question: userMsg,
        owner_id: ownerId,
      });

      // Update URL with new session ID if session was just created
      if (data.session_id !== sessionId) {
        setSessionId(data.session_id);
        navigate(`/chat/${data.session_id}`, { replace: true });
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const kbOptions = [
    { label: "My Knowledge Base", value: null },
    ...sharedKBs.map((s) => ({ label: s.owner_email, value: s.owner_id })),
  ];

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <ProgressBar />
      <Navbar onMenuClick={() => setMenuOpen((o) => !o)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSessionId={sessionId}
          onSessionSelect={handleSessionSelect}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {sharedKBs.length > 0 && (
            <div
              className="px-6 py-2 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Search in:
              </span>
              <select
                className="text-xs px-2 py-1 rounded-lg outline-none"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                value={ownerId ?? ""}
                onChange={(e) => setOwnerId(e.target.value || null)}
              >
                {kbOptions.map((o, i) => (
                  <option key={i} value={o.value ?? ""}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {!sessionId && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="text-5xl">💬</div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--brand)" }}
                >
                  Start a new conversation
                </h2>
                <p
                  className="text-sm max-w-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Type your first message below — a session will be created
                  automatically.
                </p>
              </div>
            )}

            {msgsLoading && (
              <div className="flex justify-center py-8">
                <InlineSpinner size={24} />
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <UserBubble key={i} message={msg.content} />
              ) : (
                <AIBubble key={i} message={msg.content} sources={msg.sources} />
              ),
            )}

            {sending && (
              <div className="flex gap-3 mb-4 items-start">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center
                             text-xs font-semibold flex-shrink-0"
                  style={{
                    background: "var(--success-light)",
                    color: "var(--success)",
                  }}
                >
                  AI
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <InlineSpinner size={14} />
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Searching your documents...
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div
                className="text-xs px-3 py-2 rounded-lg mb-4"
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="px-6 py-4 flex gap-3 items-end"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <textarea
              className="input flex-1 resize-none"
              rows={1}
              placeholder="Ask anything from your documents..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              style={{ minHeight: 42, maxHeight: 120 }}
            />
            <button
              type="submit"
              className="btn-primary px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
              disabled={sending || !question.trim()}
            >
              {sending ? <InlineSpinner size={14} /> : "↑"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
