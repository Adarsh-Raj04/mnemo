import client from "./client";

export const listConnections = () =>
  client.get("/connectors/").then((r) => r.data);
export const testConnector = (payload) =>
  client.post("/connectors/test", payload).then((r) => r.data);
export const connectSource = (payload) =>
  client.post("/connectors/connect", payload).then((r) => r.data);
export const deleteConnection = (id) =>
  client.delete(`/connectors/${id}`).then((r) => r.data);
export const syncConnection = (id, payload) =>
  client.post(`/connectors/${id}/sync`, payload).then((r) => r.data);
export const listSQLTables = (id) =>
  client.get(`/connectors/sql/tables/${id}`).then((r) => r.data);
export const listDriveFiles = (id) =>
  client.get(`/connectors/gdrive/files/${id}`).then((r) => r.data);
export const getGDriveAuthUrl = () =>
  client.get("/connectors/gdrive/auth").then((r) => r.data);
export const previewSQLTable = (connectionId, tableName, limit = 50) =>
  client
    .get(
      `/connectors/sql/preview/${connectionId}/${encodeURIComponent(tableName)}?limit=${limit}`,
    )
    .then((r) => r.data);
