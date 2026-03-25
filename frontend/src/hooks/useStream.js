import { useState, useRef, useCallback } from "react";

const BACKEND =
  import.meta.env.VITE_BACKEND_URL || "https://api.adarshraj.in/mnemo";

export function useStream() {
  const [status, setStatus] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [tokens, setTokens] = useState("");
  const [sources, setSources] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Keep final answer alive until DB reloads — never wipe mid-transition
  const finalAnswerRef = useRef("");
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(null);
    setStreaming(false);
    setTokens("");
    setSources([]);
    setDone(false);
    setError(null);
    setSessionId(null);
    finalAnswerRef.current = "";
  }, []);

  // Called by Chat.jsx AFTER DB messages have loaded
  // Prevents the blank flash between stream end and DB load
  const clearAfterLoad = useCallback(() => {
    setTokens("");
    setSources([]);
    setDone(false);
    finalAnswerRef.current = "";
  }, []);

  const ask = useCallback(async (payload, onSessionUpdate) => {
    // Only reset status/error — keep any previous messages visible
    setStatus(null);
    setError(null);
    setDone(false);
    setTokens("");
    setSources([]);
    finalAnswerRef.current = "";
    setStreaming(false);

    abortRef.current = new AbortController();
    const token = localStorage.getItem("kb_token");

    let response;
    try {
      response = await fetch(`${BACKEND}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });
    } catch (err) {
      if (err.name !== "AbortError") setError("Connection failed");
      return;
    }

    if (!response.ok) {
      setError(`Server error ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === "session") {
            setSessionId(event.session_id);
            // Update URL immediately without triggering message reload
            onSessionUpdate?.(event.session_id, null, "session");
          } else if (event.type === "status") {
            setStatus(event.message);
          } else if (event.type === "token") {
            setStreaming(true);
            setStatus(null);
            setTokens((prev) => {
              const next = prev + event.content;
              finalAnswerRef.current = next;
              return next;
            });
          } else if (event.type === "sources") {
            setSources(event.content || []);
          } else if (event.type === "done") {
            setDone(true);
            setStreaming(false);
            // Notify parent with title if available
            onSessionUpdate?.(event.session_id, event.session_title, "done");
          } else if (event.type === "error") {
            setError(event.message);
            setStreaming(false);
            return;
          }
        } catch {
          // malformed line — skip
        }
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus(null);
  }, []);

  return {
    ask,
    cancel,
    reset,
    clearAfterLoad,
    status,
    streaming,
    tokens,
    sources,
    done,
    error,
    sessionId,
    finalAnswer: finalAnswerRef.current,
  };
}
