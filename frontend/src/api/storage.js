import client from "./client";

export const getStorageUsage = () =>
  client.get("/storage/usage").then((r) => r.data);
