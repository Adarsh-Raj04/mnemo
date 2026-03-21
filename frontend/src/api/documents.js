import client from "./client";

export const uploadDocument = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
      timeout: 120000,
    })
    .then((r) => r.data);
};

export const listDocuments = () =>
  client.get("/documents/").then((r) => r.data);

export const deleteDocument = (filename) =>
  client
    .delete(`/documents/${encodeURIComponent(filename)}`)
    .then((r) => r.data);

export const getDocumentChunks = (filename) =>
  client
    .get(`/documents/chunks/${encodeURIComponent(filename)}`)
    .then((r) => r.data);
