import client from "./client";

export const getSettings = () => client.get("/settings/").then((r) => r.data);

export const updateSettings = (data) =>
  client.patch("/settings/", data).then((r) => r.data);

export const clearKnowledgeBase = () =>
  client.delete("/settings/clear-knowledge-base").then((r) => r.data);
