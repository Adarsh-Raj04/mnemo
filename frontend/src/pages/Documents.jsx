import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentChunks,
} from "../api/documents";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import {
  ProgressBar,
  FullScreenSpinner,
  InlineSpinner,
} from "../components/Spinner";
import toast from "react-hot-toast";

function ChunkDrawer({ doc, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["chunks", doc.filename],
    queryFn: () => getDocumentChunks(doc.filename),
    enabled: !!doc,
  });

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "min(480px, 90vw)",
          background: "var(--bg-primary)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {doc.filename}
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {doc.chunk_count} chunks · {doc.total_pages} pages
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       flex-shrink-0 ml-3 transition-colors text-lg"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            ×
          </button>
        </div>

        {/* Chunks list */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex justify-center py-12">
              <InlineSpinner size={28} />
            </div>
          )}

          {!isLoading && data?.chunks?.length === 0 && (
            <p
              className="text-sm text-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              No chunks found for this document.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {data?.chunks?.map((chunk, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Chunk meta */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--brand-light)",
                      color: "var(--brand)",
                    }}
                  >
                    Chunk {chunk.index + 1}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Page {chunk.page}
                  </span>
                </div>

                {/* Chunk text */}
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {chunk.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function DocRow({ doc, onClick, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const size = doc.file_size
    ? doc.file_size < 1024 * 1024
      ? `${(doc.file_size / 1024).toFixed(1)} KB`
      : `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`
    : "—";

  async function handleDelete(e) {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(doc.filename);
    setDeleting(false);
    setConfirm(false);
  }

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer
                 transition-all duration-150"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--border)")
      }
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center
                   flex-shrink-0 text-xl"
        style={{ background: "var(--brand-light)" }}
      >
        {doc.filename.endsWith(".pdf") ? "📄" : "📝"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {doc.filename}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {doc.chunk_count} chunks · {doc.total_pages} pages · {size}
        </p>
      </div>

      {/* Uploaded date */}
      <p
        className="text-xs flex-shrink-0 hidden sm:block"
        style={{ color: "var(--text-muted)" }}
      >
        {doc.uploaded_at?.slice(0, 10)}
      </p>

      {/* Delete */}
      {!confirm ? (
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
          style={{ color: "var(--danger)" }}
          onClick={(e) => {
            e.stopPropagation();
            setConfirm(true);
          }}
          title="Delete"
        >
          🗑️
        </button>
      ) : (
        <div
          className="flex items-center gap-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sure?
          </span>
          <button
            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <InlineSpinner size={12} /> : "Yes"}
          </button>
          <button
            className="text-xs px-2 py-1 rounded-lg"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(false);
            }}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

export default function Documents() {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  // const [uploadMsg, setUploadMsg] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  async function handleFiles(files) {
    if (!files.length) return;
    setUploading(true);
    // setUploadMsg([]);
    const results = [];

    for (const file of files) {
      await toast.promise(uploadDocument(file), {
        loading: `Indexing ${file.name}...`,
        success: `✅ ${file.name} indexed!`,
        error: (err) =>
          `❌ ${file.name}: ${err.response?.data?.detail || "Failed"}`,
      });
    }
    queryClient.invalidateQueries(["documents"]);
    setUploading(false);
  }

  async function handleDelete(filename) {
    try {
      await deleteDocument(filename);
      queryClient.invalidateQueries(["documents"]);
    } catch (err) {
      console.error(err);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".pdf") || f.name.endsWith(".txt"),
    );
    handleFiles(files);
  }, []);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <ProgressBar />
      <Navbar onMenuClick={() => setMenuOpen((o) => !o)} />
      {uploading && <FullScreenSpinner message="Indexing your document..." />}

      {/* Chunk drawer */}
      {activeDoc && (
        <ChunkDrawer doc={activeDoc} onClose={() => setActiveDoc(null)} />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSessionId={sessionId}
          onSessionSelect={setSessionId}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1
                className="text-xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Knowledge Base
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {docs.length} document{docs.length !== 1 ? "s" : ""} indexed
              </p>
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowUpload((o) => !o)}
            >
              <span className="text-lg leading-none">+</span>
              Upload
            </button>
          </div>

          {/* Upload panel — toggles on + click */}
          {showUpload && (
            <div className="mb-6">
              <div
                className="rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{
                  border: `2px dashed ${dragging ? "var(--brand)" : "var(--border)"}`,
                  background: dragging
                    ? "var(--brand-light)"
                    : "var(--bg-secondary)",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById("file-input").click()}
              >
                <div className="text-3xl mb-2">📂</div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Drag & drop files here
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  PDF and TXT supported · Click to browse
                </p>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(Array.from(e.target.files));
                    setShowUpload(false);
                  }}
                />
              </div>

              {/* Upload results */}
            </div>
          )}

          {/* Documents list */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <InlineSpinner size={28} />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="text-5xl">📭</div>
              <p
                className="font-medium text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                No documents yet
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Click the + Upload button to add your first document
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onClick={() => setActiveDoc(doc)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
