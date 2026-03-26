import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getMessages } from "../api/chat";
import { getSharedWithMe } from "../api/sharing";
import { UserBubble, AIBubble } from "../components/ChatBubble";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ProgressBar, InlineSpinner } from "../components/Spinner";
import { useStream } from "../hooks/useStream";

const STATUS_MIN_MS = 600; // minimum time each status step is visible

function StatusStep({ message }) {
  return (
    <div className="flex gap-3 mb-4 items-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center
                      text-xs font-semibold flex-shrink-0"
        style={{ background: "var(--success-light)", color: "var(--success)" }}
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
        <InlineSpinner size={13} />
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {message}
        </span>
      </div>
    </div>
  );
}

function StreamingBubble({ tokens }) {
  return (
    <div className="flex gap-3 mb-4 items-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center
                      text-xs font-semibold flex-shrink-0"
        style={{ background: "var(--success-light)", color: "var(--success)" }}
      >
        AI
      </div>
      <div>
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {tokens}
          <span
            className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
            style={{ background: "var(--brand)" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState(urlSessionId || null);
  const [question, setQuestion] = useState("");
  const [ownerId, setOwnerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Optimistic user message shown while streaming
  const [pendingUserMsg, setPendingUserMsg] = useState(null);
  // Lock DB reload until stream is fully done + small buffer
  const [dbLoadLocked, setDbLoadLocked] = useState(false);

  const bottomRef = useRef(null);
  const stream = useStream();

  // ── URL sync ────────────────────────────────────────────────
  useEffect(() => {
    if (urlSessionId && urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
      setMessages([]);
      setPendingUserMsg(null);
      stream.reset();
    }
    if (!urlSessionId && sessionId && !stream.streaming && !stream.status) {
      setSessionId(null);
      setMessages([]);
      setPendingUserMsg(null);
      stream.reset();
    }
  }, [urlSessionId]);

  // ── Load messages from DB ────────────────────────────────────
  // CRITICAL: disabled while streaming OR locked to prevent mid-stream reload
  const { data: fetchedMessages } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => getMessages(sessionId),
    enabled:
      !!sessionId && !stream.streaming && !stream.status && !dbLoadLocked,
    staleTime: 0,
  });

  // ── Unlock on error ──────────────────────────────────────────
  useEffect(() => {
    if (stream.error) {
      setDbLoadLocked(false);
      setPendingUserMsg(null);
    }
  }, [stream.error]);

  useEffect(() => {
    if (!fetchedMessages) return;
    if (!sessionId) {
      setMessages([]);
      return;
    }
    if (stream.streaming || stream.status || dbLoadLocked) return;

    setMessages(fetchedMessages);
    setPendingUserMsg(null); // ✅ Only clear AFTER DB messages are ready
    stream.clearAfterLoad();
  }, [fetchedMessages, sessionId]);

  // ── Shared KBs ───────────────────────────────────────────────
  const { data: sharedKBs = [] } = useQuery({
    queryKey: ["sharedWithMe"],
    queryFn: getSharedWithMe,
  });

  // ── Auto-scroll ──────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stream.tokens, stream.status, pendingUserMsg]);

  // ── Session callbacks from stream ────────────────────────────
  const handleSessionUpdate = useCallback(
    (newSessionId, newTitle, eventType) => {
      if (
        eventType === "session" &&
        newSessionId &&
        newSessionId !== sessionId
      ) {
        setSessionId(newSessionId);
        setDbLoadLocked(true);
        navigate(`/chat/${newSessionId}`, { replace: true });
        queryClient.invalidateQueries(["sessions"]);
      }

      if (eventType === "done") {
        // ✅ Inject assistant message but KEEP pendingUserMsg alive
        if (stream.tokens) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: stream.tokens,
              sources: stream.sources ?? [],
            },
          ]);
        }
        // ❌ Remove this — don't clear pendingUserMsg here
        // setPendingUserMsg(null);

        setDbLoadLocked(false);
        queryClient.invalidateQueries(["messages", newSessionId || sessionId]);
        queryClient.invalidateQueries(["sessions"]);
      }
    },
    [sessionId, navigate, queryClient, stream.tokens, stream.sources],
  );

  // ── Send message ─────────────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault();
    if (!question.trim() || stream.streaming || stream.status) return;

    const userMsg = question.trim();
    setQuestion("");
    setPendingUserMsg(userMsg);
    setDbLoadLocked(true);

    try {
      await stream.ask(
        { session_id: sessionId, question: userMsg, owner_id: ownerId },
        handleSessionUpdate,
      );
    } catch {
      // stream.ask threw synchronously — unlock so UI doesn't freeze
      setDbLoadLocked(false);
      setPendingUserMsg(null);
    }
  }

  // ── Session select (from sidebar) ────────────────────────────
  function handleSessionSelect(id) {
    stream.reset();
    setPendingUserMsg(null);
    setDbLoadLocked(false);
    setSessionId(id);
    setMessages([]);
    setQuestion("");
    navigate(id ? `/chat/${id}` : "/chat", { replace: true });
  }

  const isProcessing = !!stream.status;
  const isStreaming = stream.streaming;

  // What to show in the AI area:
  // - status step while processing
  // - streaming bubble while tokens arriving
  // - nothing once done (DB messages take over seamlessly)
  const showStatus = isProcessing && !isStreaming;
  const showStreaming = isStreaming && !!stream.tokens;
  const showDoneBubble = stream.done && !!stream.tokens && !isStreaming;

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
            {/* Empty state */}
            {!sessionId &&
              messages.length === 0 &&
              !pendingUserMsg &&
              !isProcessing && (
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

            {/* DB messages */}
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <UserBubble key={i} message={msg.content} />
              ) : (
                <AIBubble key={i} message={msg.content} sources={msg.sources} />
              ),
            )}

            {/* Optimistic user message — shown immediately on send */}
            {pendingUserMsg && <UserBubble message={pendingUserMsg} />}

            {/* Status steps */}
            {showStatus && <StatusStep message={stream.status} />}

            {/* Live streaming */}
            {showStreaming && <StreamingBubble tokens={stream.tokens} />}

            {/* Done but DB not loaded yet — keep showing tokens to avoid blank */}
            {showDoneBubble && (
              <AIBubble message={stream.tokens} sources={stream.sources} />
            )}

            {/* Error */}
            {stream.error && (
              <div
                className="text-xs px-3 py-2 rounded-lg mb-4"
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                }}
              >
                {stream.error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
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
              disabled={isProcessing || isStreaming}
              style={{ minHeight: 42, maxHeight: 120 }}
            />
            {isStreaming ? (
              <button
                type="button"
                className="btn-secondary px-4 py-2.5 flex-shrink-0"
                onClick={stream.cancel}
              >
                ■ Stop
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
                disabled={isProcessing || !question.trim()}
              >
                {isProcessing ? <InlineSpinner size={14} /> : "↑"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
