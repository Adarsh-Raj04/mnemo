import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listConnections,
  testConnector,
  connectSource,
  deleteConnection,
  syncConnection,
  listSQLTables,
  listDriveFiles,
  getGDriveAuthUrl,
} from "../api/connectors";
import {
  getSourcePrompt,
  setSourcePrompt,
  deleteSourcePrompt,
} from "../api/prompts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import {
  ProgressBar,
  InlineSpinner,
  FullScreenSpinner,
} from "../components/Spinner";
import { previewSQLTable } from "../api/connectors"; // ← add this

const SQL_FIELDS = [
  {
    key: "db_type",
    label: "Database Type",
    type: "select",
    options: ["postgres", "mssql", "mysql"],
  },
  { key: "host", label: "Host", placeholder: "localhost" },
  { key: "port", label: "Port", placeholder: "5432" },
  { key: "database", label: "Database", placeholder: "mydb" },
  { key: "user", label: "Username", placeholder: "admin" },
  {
    key: "password",
    label: "Password",
    placeholder: "••••••••",
    type: "password",
  },
];

function SourcePromptEditor({ sourceId }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });

  useEffect(() => {
    getSourcePrompt(sourceId).then((d) => {
      if (d.prompt_text) setText(d.prompt_text);
    });
  }, [sourceId]);

  async function save() {
    setLoading(true);
    try {
      await setSourcePrompt(sourceId, text);
      setMsg({ text: "Prompt saved!", ok: true });
    } catch {
      setMsg({ text: "Failed to save", ok: false });
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    try {
      await deleteSourcePrompt(sourceId);
      setText("");
      setMsg({ text: "Reset to default", ok: true });
    } catch {
      setMsg({ text: "Failed", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="label">Prompt for this source</label>
      <textarea
        className="input text-xs"
        rows={3}
        placeholder="Leave empty to use your default prompt..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ resize: "vertical" }}
      />
      {msg.text && (
        <p
          className="text-xs mt-1"
          style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}
        >
          {msg.text}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
          onClick={save}
          disabled={loading}
        >
          {loading && <InlineSpinner size={12} />} Save prompt
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={reset}
          disabled={loading}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function TableRow({ table, connectionId, selected, onToggle }) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoad, setPreviewLoad] = useState(false);
  const [limit, setLimit] = useState(50);

  async function loadPreview() {
    if (previewData && limit === previewData.limit) {
      setShowPreview((p) => !p);
      return;
    }
    setPreviewLoad(true);
    try {
      const data = await previewSQLTable(connectionId, table.id, limit);
      setPreviewData(data);
      setShowPreview(true);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoad(false);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Table header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 transition-colors"
        style={{
          background: selected ? "var(--brand-light)" : "var(--bg-secondary)",
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggle(table.id, e.target.checked)}
          className="flex-shrink-0"
        />
        <span
          className="flex-1 text-sm font-medium"
          style={{ color: selected ? "var(--brand)" : "var(--text-primary)" }}
        >
          {table.name}
        </span>
        <span
          className="text-xs flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {table.rows?.toLocaleString()} rows
        </span>

        {/* Preview toggle */}
        <button
          className="text-xs px-2 py-0.5 rounded-lg flex items-center gap-1
                     transition-colors flex-shrink-0"
          style={{
            background: showPreview
              ? "var(--brand-light)"
              : "var(--bg-tertiary)",
            color: showPreview ? "var(--brand)" : "var(--text-muted)",
          }}
          onClick={loadPreview}
          disabled={previewLoad}
        >
          {previewLoad ? (
            <InlineSpinner size={10} />
          ) : showPreview ? (
            "▲ Hide"
          ) : (
            "👁 Preview"
          )}
        </button>
      </div>

      {/* Sample data table */}
      {showPreview && previewData && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Limit selector */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-primary)",
            }}
          >
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Showing top
            </span>
            {[50, 100].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setLimit(n);
                  setPreviewData(null);
                }}
                className="text-xs px-2 py-0.5 rounded-md transition-colors"
                style={{
                  background:
                    limit === n ? "var(--brand-light)" : "var(--bg-secondary)",
                  color: limit === n ? "var(--brand)" : "var(--text-muted)",
                  border: `1px solid ${limit === n ? "var(--brand)" : "var(--border)"}`,
                }}
              >
                {n}
              </button>
            ))}
            <span
              className="text-xs ml-auto"
              style={{ color: "var(--text-muted)" }}
            >
              {previewData.total_shown} rows shown
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto" style={{ maxHeight: 280 }}>
            <table
              style={{
                width: "100%",
                fontSize: "11px",
                borderCollapse: "collapse",
              }}
            >
              <thead style={{ position: "sticky", top: 0 }}>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  {previewData.columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "6px 10px",
                        textAlign: "left",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--bg-primary)"
                          : "var(--bg-secondary)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {previewData.columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: "5px 10px",
                          color: "var(--text-primary)",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={row[col] ?? ""}
                      >
                        {row[col] === null ? (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                            }}
                          >
                            null
                          </span>
                        ) : (
                          row[col]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionCard({ conn, onDelete, onSync }) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tables, setTables] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [customQuery, setCustomQuery] = useState("");
  const [queryMode, setQueryMode] = useState("tables");
  const [syncMsg, setSyncMsg] = useState({ text: "", ok: true });
  const [loadingSources, setLoadingSources] = useState(false);

  async function loadSources() {
    setLoadingSources(true);
    try {
      if (conn.source_type === "sql") {
        const data = await listSQLTables(conn.id);
        setTables(data.tables || []);
      } else if (conn.source_type === "google_drive") {
        const data = await listDriveFiles(conn.id);
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSources(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg({ text: "", ok: true });
    try {
      const payload =
        conn.source_type === "sql" && queryMode === "custom"
          ? { custom_query: customQuery }
          : { source_ids: selectedIds };

      const res = await onSync(conn.id, payload);
      setSyncMsg({
        text: res.warning || res.message,
        ok: !res.warning,
      });
    } catch (err) {
      setSyncMsg({
        text: err.response?.data?.detail || "Sync failed",
        ok: false,
      });
    } finally {
      setSyncing(false);
    }
  }

  const statusColor =
    conn.status === "synced"
      ? "var(--success)"
      : conn.status === "connected"
        ? "var(--brand)"
        : "var(--text-muted)";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-xl flex-shrink-0">
          {conn.source_type === "sql" ? "🗄️" : "📁"}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {conn.name}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: statusColor }}>
              ● {conn.status}
            </span>
            {conn.last_synced && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Last synced {conn.last_synced.slice(0, 10)}
              </span>
            )}
            {conn.doc_count > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {conn.doc_count} items
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            onClick={() => {
              setExpanded((e) => !e);
              if (!expanded) loadSources();
            }}
          >
            {expanded ? "Collapse" : "Manage"}
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
            onClick={() => onDelete(conn.id)}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}
        >
          {/* SQL mode toggle */}
          {conn.source_type === "sql" && (
            <div className="flex gap-2 mb-4">
              {["tables", "custom"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setQueryMode(mode)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background:
                      queryMode === mode
                        ? "var(--brand-light)"
                        : "var(--bg-secondary)",
                    color:
                      queryMode === mode
                        ? "var(--brand)"
                        : "var(--text-secondary)",
                    border: `1px solid ${queryMode === mode ? "var(--brand)" : "var(--border)"}`,
                  }}
                >
                  {mode === "tables" ? "📋 Pick tables" : "✍️ Custom query"}
                </button>
              ))}
            </div>
          )}

          {/* Table picker */}
          {conn.source_type === "sql" && queryMode === "tables" && (
            <div>
              {loadingSources ? (
                <div className="flex justify-center py-4">
                  <InlineSpinner />
                </div>
              ) : tables.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No tables found. Check your connection.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {tables.map((t) => (
                    <TableRow
                      key={t.id}
                      table={t}
                      connectionId={conn.id}
                      selected={selectedIds.includes(t.id)}
                      onToggle={(id, checked) =>
                        setSelectedIds((prev) =>
                          checked
                            ? [...prev, id]
                            : prev.filter((x) => x !== id),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom SQL query */}
          {conn.source_type === "sql" && queryMode === "custom" && (
            <div className="mb-3">
              <label className="label">SQL Query</label>
              <textarea
                className="input text-xs font-mono"
                rows={4}
                placeholder="SELECT id, name, description FROM products WHERE active = 1"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          )}

          {/* Google Drive file picker */}
          {conn.source_type === "google_drive" && (
            <div className="mb-3">
              {loadingSources ? (
                <div className="flex justify-center py-4">
                  <InlineSpinner />
                </div>
              ) : files.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No files found in your Drive.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {files.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5
                                      rounded-lg transition-colors"
                      style={{
                        background: selectedIds.includes(f.id)
                          ? "var(--brand-light)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, f.id]
                              : prev.filter((x) => x !== f.id),
                          )
                        }
                      />
                      <span>{f.type === "pdf" ? "📄" : "📝"}</span>
                      <span
                        className="truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {f.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prompt editor */}
          <SourcePromptEditor sourceId={conn.id} />

          {/* Sync message */}
          {syncMsg.text && (
            <p
              className="text-xs px-3 py-2 rounded-lg mt-3"
              style={{
                background: syncMsg.ok
                  ? "var(--success-light)"
                  : "var(--danger-light)",
                color: syncMsg.ok ? "var(--success)" : "var(--danger)",
              }}
            >
              {syncMsg.text}
            </p>
          )}

          {/* Sync button */}
          <button
            className="btn-primary w-full flex items-center justify-center gap-2 mt-3"
            onClick={handleSync}
            disabled={
              syncing ||
              (conn.source_type === "sql" &&
                queryMode === "tables" &&
                selectedIds.length === 0) ||
              (conn.source_type === "sql" &&
                queryMode === "custom" &&
                !customQuery.trim()) ||
              (conn.source_type === "google_drive" && selectedIds.length === 0)
            }
          >
            {syncing && <InlineSpinner size={14} />}
            {syncing ? "Syncing..." : "🔄 Sync now"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Connectors() {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sourceType, setSourceType] = useState("sql");
  const [connName, setConnName] = useState("");
  const [config, setConfig] = useState({});
  const [testMsg, setTestMsg] = useState({ text: "", ok: true });
  const [testLoad, setTestLoad] = useState(false);
  const [saveLoad, setSaveLoad] = useState(false);
  const [params] = useSearchParams();

  // Handle Google Drive OAuth callback
  useEffect(() => {
    const gToken = params.get("gdrive_token");
    const gRefresh = params.get("gdrive_refresh");
    const gError = params.get("gdrive_error");

    if (gError) {
      setTestMsg({ text: `Google Drive error: ${gError}`, ok: false });
      setShowAdd(true);
      setSourceType("google_drive");
    }
    if (gToken) {
      setConfig({ access_token: gToken, refresh_token: gRefresh });
      setSourceType("google_drive");
      setConnName("Google Drive");
      setShowAdd(true);
    }
  }, [params]);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: listConnections,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => queryClient.invalidateQueries(["connections"]),
  });

  async function handleTest() {
    setTestMsg({ text: "", ok: true });
    setTestLoad(true);
    try {
      const res = await testConnector({ source_type: sourceType, config });
      setTestMsg({ text: res.message, ok: res.success });
    } catch (err) {
      setTestMsg({
        text: err.response?.data?.detail || "Test failed",
        ok: false,
      });
    } finally {
      setTestLoad(false);
    }
  }

  async function handleConnect(e) {
    e.preventDefault();
    setSaveLoad(true);
    try {
      await connectSource({
        source_type: sourceType,
        name: connName || sourceType,
        config,
      });
      queryClient.invalidateQueries(["connections"]);
      setShowAdd(false);
      setConfig({});
      setConnName("");
      setTestMsg({ text: "", ok: true });
    } catch (err) {
      setTestMsg({
        text: err.response?.data?.detail || "Connection failed",
        ok: false,
      });
    } finally {
      setSaveLoad(false);
    }
  }

  async function handleGDriveOAuth() {
    try {
      const { auth_url } = await getGDriveAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      setTestMsg({ text: "Failed to get auth URL", ok: false });
    }
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <ProgressBar />
      <Navbar onMenuClick={() => setMenuOpen((o) => !o)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSessionId={sessionId}
          onSessionSelect={setSessionId}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1
                className="text-xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Data Sources
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Connect external sources to pull and embed data
              </p>
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowAdd((o) => !o)}
            >
              <span className="text-lg leading-none">+</span>
              Add Source
            </button>
          </div>

          {/* Add source panel */}
          {showAdd && (
            <div className="card mb-6">
              <h2
                className="text-sm font-semibold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Connect a new source
              </h2>

              {/* Source type tabs */}
              <div className="flex gap-2 mb-4">
                {[
                  { id: "sql", label: "🗄️ SQL Database" },
                  { id: "google_drive", label: "📁 Google Drive" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSourceType(t.id);
                      setConfig({});
                      setTestMsg({ text: "", ok: true });
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background:
                        sourceType === t.id
                          ? "var(--brand-light)"
                          : "var(--bg-secondary)",
                      color:
                        sourceType === t.id
                          ? "var(--brand)"
                          : "var(--text-secondary)",
                      border: `1px solid ${sourceType === t.id ? "var(--brand)" : "var(--border)"}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Connection name */}
              <div className="mb-3">
                <label className="label">Connection Name</label>
                <input
                  className="input"
                  placeholder="e.g. Production DB, My Drive"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                />
              </div>

              {/* SQL fields */}
              {sourceType === "sql" && (
                <form onSubmit={handleConnect}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {SQL_FIELDS.map((f) => (
                      <div
                        key={f.key}
                        className={
                          f.key === "host" || f.key === "database"
                            ? "col-span-2"
                            : ""
                        }
                      >
                        <label className="label">{f.label}</label>
                        {f.type === "select" ? (
                          <select
                            className="input"
                            value={config[f.key] || ""}
                            onChange={(e) =>
                              setConfig((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                          >
                            {f.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input"
                            type={f.type || "text"}
                            placeholder={f.placeholder}
                            value={config[f.key] || ""}
                            onChange={(e) =>
                              setConfig((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {testMsg.text && (
                    <p
                      className="text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: testMsg.ok
                          ? "var(--success-light)"
                          : "var(--danger-light)",
                        color: testMsg.ok ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {testMsg.text}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex items-center gap-2"
                      onClick={handleTest}
                      disabled={testLoad}
                    >
                      {testLoad && <InlineSpinner size={14} />}
                      🔌 Test Connection
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2"
                      disabled={saveLoad}
                    >
                      {saveLoad && <InlineSpinner size={14} />}
                      Connect
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAdd(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Google Drive OAuth */}
              {sourceType === "google_drive" && (
                <div>
                  {config.access_token ? (
                    <div>
                      <p
                        className="text-xs px-3 py-2 rounded-lg mb-3"
                        style={{
                          background: "var(--success-light)",
                          color: "var(--success)",
                        }}
                      >
                        ✅ Google Drive authorized successfully
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="btn-primary flex items-center gap-2"
                          onClick={handleConnect}
                          disabled={saveLoad}
                        >
                          {saveLoad && <InlineSpinner size={14} />}
                          Save Connection
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => setShowAdd(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p
                        className="text-sm mb-4"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Click below to authorize Mnemo to access your Google
                        Drive files. We only request read-only access.
                      </p>
                      {testMsg.text && (
                        <p
                          className="text-xs px-3 py-2 rounded-lg mb-3"
                          style={{
                            background: testMsg.ok
                              ? "var(--success-light)"
                              : "var(--danger-light)",
                            color: testMsg.ok
                              ? "var(--success)"
                              : "var(--danger)",
                          }}
                        >
                          {testMsg.text}
                        </p>
                      )}
                      <button
                        className="btn-primary flex items-center gap-2"
                        onClick={handleGDriveOAuth}
                      >
                        <span>🔗</span> Authorize Google Drive
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Connection list */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <InlineSpinner size={28} />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔌</div>
              <p
                className="font-medium text-sm mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                No data sources connected
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Connect Google Drive or a SQL database to pull data directly
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {connections.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onSync={syncConnection}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
