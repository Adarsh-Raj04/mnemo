import client from "./client";

export const getDefaultPrompt = () =>
  client.get("/prompts/global").then((r) => r.data);
export const setDefaultPrompt = (text) =>
  client.put("/prompts/global", { prompt_text: text }).then((r) => r.data);
export const resetDefaultPrompt = () =>
  client.delete("/prompts/global").then((r) => r.data);
export const getSourcePrompt = (id) =>
  client.get(`/prompts/source/${id}`).then((r) => r.data);
export const setSourcePrompt = (id, text) =>
  client
    .put(`/prompts/source/${id}`, { prompt_text: text })
    .then((r) => r.data);
export const deleteSourcePrompt = (id) =>
  client.delete(`/prompts/source/${id}`).then((r) => r.data);
