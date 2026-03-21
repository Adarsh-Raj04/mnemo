import client from "./client";

export const getVectorConfig = () =>
  client.get("/vector-store/config").then((r) => r.data);
export const testVectorStore = (payload) =>
  client.post("/vector-store/test", payload).then((r) => r.data);
export const configureVector = (payload) =>
  client.post("/vector-store/configure", payload).then((r) => r.data);
export const resetVectorStore = () =>
  client.delete("/vector-store/config").then((r) => r.data);
export const startMigration = (payload) =>
  client.post("/vector-store/migrate", payload).then((r) => r.data);
export const getMigrationStatus = () =>
  client.get("/vector-store/migration-status").then((r) => r.data);
