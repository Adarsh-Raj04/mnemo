import { useState, useRef, useCallback } from "react";

const BACKEND =
  import.meta.env.VITE_BACKEND_URL || "https://api.adarshraj.in/mnemo";

export function useStream() {
  const [status, setStatus] = useState(null); // current step text
  const [streaming, setStreaming] = useState(false); // tokens arriving
  const [tokens, setTokens] = useState(""); // accumulated answer
  const [sources, setSources] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(null);
    setStreaming(false);
    setTokens("");
    setSources([]);
    setDone(false);
    setError(null);
  }, []);

  const ask = useCallback(
    async (payload, onSessionUpdate) => {
      reset();
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
        setError("Connection failed");
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
        buffer = lines.pop(); // keep incomplete last chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "session") {
              onSessionUpdate?.(event.session_id);
            } else if (event.type === "status") {
              setStatus(event.message);
            } else if (event.type === "token") {
              setStreaming(true);
              setStatus(null); // hide status steps once tokens arrive
              setTokens((prev) => prev + event.content);
            } else if (event.type === "sources") {
              setSources(event.content || []);
            } else if (event.type === "done") {
              setDone(true);
              setStreaming(false);
              if (event.session_title) {
                onSessionUpdate?.(event.session_id, event.session_title);
              }
            } else if (event.type === "error") {
              setError(event.message);
              setStreaming(false);
              return;
            }
          } catch {
            // malformed JSON line — skip
          }
        }
      }
    },
    [reset],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return {
    ask,
    cancel,
    reset,
    status,
    streaming,
    tokens,
    sources,
    done,
    error,
  };
}
