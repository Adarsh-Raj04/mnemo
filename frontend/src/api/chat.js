import client from "./client";

export const listSessions = () =>
  client.get("/chat/sessions").then((r) => r.data);

export const getMessages = (sessionId) =>
  client.get(`/chat/sessions/${sessionId}/messages`).then((r) => r.data);

export const deleteSession = (sessionId) =>
  client.delete(`/chat/sessions/${sessionId}`).then((r) => r.data);

export const askQuestion = (data) =>
  client.post("/chat/ask", data, { timeout: 60000 }).then((r) => r.data);
