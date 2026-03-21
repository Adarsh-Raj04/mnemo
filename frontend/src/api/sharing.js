import client from "./client";

export const inviteUser = (data) =>
  client.post("/sharing/invite", data).then((r) => r.data);

export const getMyShares = () =>
  client.get("/sharing/my-shares-detailed").then((r) => r.data);

export const getSharedWithMe = () =>
  client.get("/sharing/shared-with-me").then((r) => r.data);

export const revokeShare = (shareId) =>
  client.delete(`/sharing/${shareId}`).then((r) => r.data);

export const updatePermission = (shareId, permission) =>
  client
    .patch(`/sharing/${shareId}/permission`, { permission })
    .then((r) => r.data);
