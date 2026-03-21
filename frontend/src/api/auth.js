import client from "./client";

export const signup = (data) =>
  client.post("/auth/signup", data).then((r) => r.data);

export const login = (data) =>
  client.post("/auth/login", data).then((r) => r.data);

export const getMe = (token) =>
  client
    .get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);

export const changePassword = (data) =>
  client.post("/auth/change-password", data).then((r) => r.data);

export const forgotPassword = (email) =>
  client.post("/auth/forgot-password", { email }).then((r) => r.data);

export const resetPassword = (token, password) =>
  client.post("/auth/reset-password", { token, password }).then((r) => r.data);
