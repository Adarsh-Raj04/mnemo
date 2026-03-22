import client from "./client";

export const listAPIKeys = () => client.get("/api-keys/").then((r) => r.data);
export const createAPIKey = (payload) =>
  client.post("/api-keys/", payload).then((r) => r.data);
export const updateAPIKey = (id, data) =>
  client.patch(`/api-keys/${id}`, data).then((r) => r.data);
export const deleteAPIKey = (id) =>
  client.delete(`/api-keys/${id}`).then((r) => r.data);
export const regenerateKey = (id) =>
  client.post(`/api-keys/${id}/regenerate`).then((r) => r.data);
