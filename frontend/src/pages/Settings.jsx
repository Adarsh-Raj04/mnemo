import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  updateSettings,
  clearKnowledgeBase,
} from "../api/settings";
import { changePassword } from "../api/auth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { ProgressBar, InlineSpinner } from "../components/Spinner";
import {
  getVectorConfig,
  testVectorStore,
  configureVector,
  resetVectorStore,
  startMigration,
  getMigrationStatus,
} from "../api/vectorStore";
import {
  getDefaultPrompt,
  setDefaultPrompt,
  resetDefaultPrompt,
} from "../api/prompts";
import {
  listAPIKeys,
  createAPIKey,
  deleteAPIKey,
  regenerateKey,
  updateAPIKey,
} from "../api/apiKeys";
import StorageBar from "../components/StorageBar";
import toast from "react-hot-toast";

function Section({ title, children }) {
  return (
    <div className="card mb-4">
      <h2
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function SaveButton({ loading, label = "Save", loadingLabel = "Saving..." }) {
  return (
    <button
      type="submit"
      className="btn-primary flex items-center gap-2 mt-3"
      disabled={loading}
    >
      {loading && <InlineSpinner size={14} />}
      {loading ? loadingLabel : label}
    </button>
  );
}

function DefaultPromptEditor() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDefaultPrompt().then((d) => setText(d.prompt_text));
  }, []);

  async function save(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await setDefaultPrompt(text);
      toast.success("Prompt saved!");
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    try {
      await resetDefaultPrompt();
      const d = await getDefaultPrompt();
      setText(d.prompt_text);
      toast.success("Reset to system default");
    } catch {
      toast.error("Failed to reset prompt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save}>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Applies to all your chats by default. Override per data source in
        Connectors.
      </p>
      <textarea
        className="input text-sm"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ resize: "vertical" }}
      />
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          className="btn-primary flex items-center gap-2"
          disabled={loading}
        >
          {loading && <InlineSpinner size={14} />} Save prompt
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={reset}
          disabled={loading}
        >
          Reset to default
        </button>
      </div>
    </form>
  );
}

function VectorStoreConfig() {
  const [configData, setConfigData] = useState(null);
  const [selected, setSelected] = useState("chroma");
  const [fields, setFields] = useState({});
  const [testMsg, setTestMsg] = useState({ text: "", ok: true });
  const [testLoad, setTestLoad] = useState(false);
  const [saveLoad, setSaveLoad] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migStatus, setMigStatus] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadConfig();
    return () => clearInterval(pollRef.current);
  }, []);

  async function loadConfig() {
    const d = await getVectorConfig();
    setConfigData(d);
    setSelected(d.store_type);
    if (["reading", "migrating", "verifying"].includes(d.migration_status))
      startPolling();
  }

  function startPolling() {
    setMigrating(true);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await getMigrationStatus();
      setMigStatus(s);
      if (["done", "failed", "rolling_back"].includes(s.status)) {
        clearInterval(pollRef.current);
        setMigrating(false);
        loadConfig();
        if (s.status === "done") toast.success("Migration complete!");
        else toast.error("Migration failed. Your original data is safe.");
      }
    }, 1500);
  }

  const STORES = [
    { id: "chroma", label: "ChromaDB", desc: "Default · local", fields: [] },
    {
      id: "pgvector",
      label: "pgvector",
      desc: "Your PostgreSQL",
      fields: [
        { key: "host", label: "Host", placeholder: "localhost" },
        { key: "port", label: "Port", placeholder: "5432" },
        { key: "database", label: "Database", placeholder: "mydb" },
        { key: "user", label: "Username", placeholder: "postgres" },
        {
          key: "password",
          label: "Password",
          placeholder: "••••••••",
          type: "password",
        },
      ],
    },
    {
      id: "pinecone",
      label: "Pinecone",
      desc: "Cloud · your key",
      fields: [
        {
          key: "api_key",
          label: "API Key",
          placeholder: "pc-...",
          type: "password",
        },
        { key: "index_name", label: "Index Name", placeholder: "mnemo-index" },
      ],
    },
    {
      id: "azure_search",
      label: "Azure AI Search",
      desc: "Microsoft Azure",
      fields: [
        { key: "endpoint", label: "Endpoint", placeholder: "https://..." },
        {
          key: "admin_key",
          label: "Admin Key",
          placeholder: "••••••••",
          type: "password",
        },
        { key: "index_name", label: "Index Name", placeholder: "mnemo-index" },
      ],
    },
  ];

  const current = STORES.find((s) => s.id === selected);
  const isSameStore = selected === (configData?.store_type || "chroma");

  const migLabel = {
    reading: "Reading vectors...",
    migrating: "Copying to destination...",
    verifying: "Verifying...",
    rolling_back: "Rolling back...",
    done: "Migration complete!",
    failed: "Migration failed.",
    none: "",
  };
  const migColor = {
    reading: "var(--brand)",
    migrating: "var(--brand)",
    verifying: "var(--brand)",
    rolling_back: "var(--danger)",
    done: "var(--success)",
    failed: "var(--danger)",
    none: "var(--text-muted)",
  };

  async function handleTest() {
    setTestMsg({ text: "", ok: true });
    setTestLoad(true);
    try {
      const res = await testVectorStore({
        store_type: selected,
        config: fields,
      });
      setTestMsg({ text: res.message, ok: res.success });
      res.success ? toast.success(res.message) : toast.error(res.message);
    } catch (err) {
      const msg = err.response?.data?.detail || "Test failed";
      setTestMsg({ text: msg, ok: false });
      toast.error(msg);
    } finally {
      setTestLoad(false);
    }
  }

  async function handleSaveOnly() {
    setSaveLoad(true);
    try {
      selected === "chroma"
        ? await resetVectorStore()
        : await configureVector({ store_type: selected, config: fields });
      const updated = await getVectorConfig();
      setConfigData(updated);
      setSelected(updated.store_type);
      setShowMigrate(false);
      toast.success(
        "Vector store saved. Re-upload documents to index into new store.",
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaveLoad(false);
    }
  }

  async function handleMigrate() {
    setMigrating(true);
    try {
      await startMigration({
        target_store_type: selected,
        target_config: fields,
      });
      setMigStatus({ status: "reading", migrated: 0, total: 0, percent: 0 });
      toast.success("Migration started...");
      startPolling();
    } catch (err) {
      setMigrating(false);
      toast.error(err.response?.data?.detail || "Migration failed to start");
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Currently active:
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: "var(--brand-light)", color: "var(--brand)" }}
        >
          {configData?.store_type || "chroma"}
        </span>
        {configData?.migration_status === "done" && (
          <span className="text-xs" style={{ color: "var(--success)" }}>
            ✓ Migration complete
          </span>
        )}
      </div>

      {migrating && migStatus && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            {!["done", "failed", "rolling_back"].includes(migStatus.status) && (
              <InlineSpinner size={14} />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: migColor[migStatus.status] || "var(--brand)" }}
            >
              {migLabel[migStatus.status]}
            </span>
          </div>
          {migStatus.total > 0 && (
            <div>
              <div
                className="flex justify-between text-xs mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                <span>
                  {migStatus.migrated} / {migStatus.total} vectors
                </span>
                <span>{migStatus.percent}%</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${migStatus.percent}%`,
                    background:
                      migStatus.status === "done"
                        ? "var(--success)"
                        : migStatus.status === "failed"
                          ? "var(--danger)"
                          : "var(--brand)",
                  }}
                />
              </div>
            </div>
          )}
          {migStatus.status === "done" && (
            <p className="text-xs mt-2" style={{ color: "var(--success)" }}>
              ✅ All {migStatus.total} vectors migrated. Original kept as backup
              for 7 days.
            </p>
          )}
          {migStatus.status === "failed" && (
            <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
              ❌ Rolled back. Your original data is untouched.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {STORES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSelected(s.id);
              setFields({});
              setTestMsg({ text: "", ok: true });
              setShowMigrate(false);
            }}
            className="text-left p-3 rounded-xl transition-all"
            style={{
              border: `2px solid ${selected === s.id ? "var(--brand)" : "var(--border)"}`,
              background:
                selected === s.id
                  ? "var(--brand-light)"
                  : "var(--bg-secondary)",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{
                color:
                  selected === s.id ? "var(--brand)" : "var(--text-primary)",
              }}
            >
              {s.label}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {s.desc}
            </p>
          </button>
        ))}
      </div>

      {current?.fields.length > 0 && (
        <div
          className="flex flex-col gap-3 mb-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {current.fields.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={fields[f.key] || ""}
                onChange={(e) =>
                  setFields((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
          <button
            className="btn-secondary flex items-center justify-center gap-2 mt-1"
            onClick={handleTest}
            disabled={testLoad}
          >
            {testLoad && <InlineSpinner size={14} />} 🔌 Test Connection
          </button>
          {testMsg.text && (
            <p
              className="text-xs px-3 py-2 rounded-lg"
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
        </div>
      )}

      {!isSameStore && !migrating && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{ background: "#faeeda", border: "1px solid #EF9F2730" }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "#633806" }}>
            ⚠️ Switching from {configData?.store_type || "chroma"} to {selected}
          </p>
          <p className="text-xs mb-3" style={{ color: "#854F0B" }}>
            Your existing vectors won't automatically move.
          </p>
          <div className="flex flex-col gap-2">
            <button
              className="text-left p-3 rounded-xl transition-all"
              style={{
                border: `2px solid ${showMigrate ? "var(--brand)" : "var(--border)"}`,
                background: showMigrate
                  ? "var(--brand-light)"
                  : "var(--bg-primary)",
              }}
              onClick={() => setShowMigrate(true)}
            >
              <p
                className="text-sm font-medium"
                style={{
                  color: showMigrate ? "var(--brand)" : "var(--text-primary)",
                }}
              >
                🔄 Migrate my data
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Copy all existing vectors. Recommended.
              </p>
            </button>
            <button
              className="text-left p-3 rounded-xl transition-all"
              style={{
                border: "2px solid var(--border)",
                background: "var(--bg-primary)",
              }}
              onClick={() => setShowMigrate(false)}
            >
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                🆕 Start fresh
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Re-upload documents manually.
              </p>
            </button>
          </div>
        </div>
      )}

      {!migrating && (
        <div className="flex gap-2">
          {!isSameStore && showMigrate ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleMigrate}
              disabled={saveLoad}
            >
              {saveLoad && <InlineSpinner size={14} />} 🔄 Migrate & Switch
            </button>
          ) : (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleSaveOnly}
              disabled={saveLoad}
            >
              {saveLoad && <InlineSpinner size={14} />} Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AIProviderConfig({ settings }) {
  const [chatProvider, setChatProvider] = useState(
    settings?.chat_provider || "openai",
  );
  const [chatModel, setChatModel] = useState(
    settings?.chat_model || "gpt-3.5-turbo",
  );
  const [embedProvider, setEmbedProvider] = useState(
    settings?.embed_provider || "openai",
  );
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState(
    settings?.ollama_base_url || "http://localhost:11434",
  );
  const [loading, setLoading] = useState(false);

  const CHAT_PROVIDERS = [
    {
      id: "openai",
      label: "OpenAI",
      models: [
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4.1-nano",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
      ],
    },
    {
      id: "anthropic",
      label: "Anthropic Claude",
      models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
    },
    {
      id: "gemini",
      label: "Google Gemini",
      models: [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
      ],
    },
    {
      id: "ollama",
      label: "Ollama (local)",
      models: ["llama3.2", "mistral", "phi3", "qwen2.5", "deepseek-r1"],
    },
  ];
  const EMBED_PROVIDERS = [
    { id: "openai", label: "OpenAI (text-embedding-3-small)" },
    { id: "gemini", label: "Google Gemini (text-embedding-004)" },
    { id: "ollama", label: "Ollama (nomic-embed-text)" },
  ];
  const currentChat = CHAT_PROVIDERS.find((p) => p.id === chatProvider);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        chat_provider: chatProvider,
        chat_model: chatModel,
        embed_provider: embedProvider,
      };
      if (openaiKey) payload.openai_api_key = openaiKey;
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;
      if (geminiKey) payload.gemini_api_key = geminiKey;
      if (ollamaUrl) payload.ollama_base_url = ollamaUrl;
      await updateSettings(payload);
      toast.success("Provider settings saved!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const sameProvider = chatProvider === embedProvider;
  const needsOpenAI = chatProvider === "openai" || embedProvider === "openai";
  const needsClaude = chatProvider === "anthropic";
  const needsGemini = chatProvider === "gemini" || embedProvider === "gemini";
  const needsOllama = chatProvider === "ollama" || embedProvider === "ollama";
  const hasTwoProviders =
    (needsOpenAI ? 1 : 0) +
      (needsClaude ? 1 : 0) +
      (needsGemini ? 1 : 0) +
      (needsOllama ? 1 : 0) >
    1;

  return (
    <form onSubmit={handleSave}>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Choose providers for chat and embedding separately. Same provider = one
        API key covers both.
      </p>

      {/* Chat provider + embed provider side by side */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="label">Chat provider</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {CHAT_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setChatProvider(p.id);
                  setChatModel(p.models[0]);
                }}
                className="text-left p-2.5 rounded-xl transition-all"
                style={{
                  border: `2px solid ${chatProvider === p.id ? "var(--brand)" : "var(--border)"}`,
                  background:
                    chatProvider === p.id
                      ? "var(--brand-light)"
                      : "var(--bg-secondary)",
                }}
              >
                <p
                  className="text-xs font-medium"
                  style={{
                    color:
                      chatProvider === p.id
                        ? "var(--brand)"
                        : "var(--text-primary)",
                  }}
                >
                  {p.label}
                </p>
              </button>
            ))}
          </div>
          <label className="label">Chat model</label>
          <select
            className="input"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
          >
            {currentChat?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Embedding provider</label>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            Changing requires re-uploading all documents.
          </p>
          <div className="flex flex-col gap-1.5">
            {EMBED_PROVIDERS.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 text-sm py-1 cursor-pointer"
              >
                <input
                  type="radio"
                  name="embed_provider"
                  checked={embedProvider === p.id}
                  onChange={() => setEmbedProvider(p.id)}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Credentials — two columns when two different providers needed */}
      <div
        className="p-4 rounded-xl"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-xs font-medium mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {sameProvider
            ? `${CHAT_PROVIDERS.find((p) => p.id === chatProvider)?.label} credentials`
            : "Credentials needed"}
        </p>
        <div
          className={`grid gap-4 ${hasTwoProviders ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {needsOpenAI && (
            <div>
              <label className="label">
                OpenAI API Key
                {settings?.has_api_key ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--success)" }}
                  >
                    ✅ saved
                  </span>
                ) : (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--danger)" }}
                  >
                    not set
                  </span>
                )}
                {sameProvider && chatProvider === "openai" && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat + embeddings)
                  </span>
                )}
                {!sameProvider && chatProvider !== "openai" && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (embeddings)
                  </span>
                )}
                {!sameProvider && chatProvider === "openai" && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="password"
                placeholder="sk-proj-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>
          )}
          {needsClaude && (
            <div>
              <label className="label">
                Anthropic API Key
                {settings?.has_anthropic_key ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--success)" }}
                  >
                    ✅ saved
                  </span>
                ) : (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--danger)" }}
                  >
                    not set
                  </span>
                )}
                {!sameProvider && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
            </div>
          )}
          {needsGemini && (
            <div>
              <label className="label">
                Google AI API Key
                {settings?.has_gemini_key ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--success)" }}
                  >
                    ✅ saved
                  </span>
                ) : (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--danger)" }}
                  >
                    not set
                  </span>
                )}
                {sameProvider && chatProvider === "gemini" ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat + embeddings)
                  </span>
                ) : chatProvider === "gemini" ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat)
                  </span>
                ) : (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (embeddings)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="password"
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
          )}
          {needsOllama && (
            <div>
              <label className="label">
                Ollama base URL
                {sameProvider && chatProvider === "ollama" ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat + embeddings)
                  </span>
                ) : chatProvider === "ollama" ? (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (chat)
                  </span>
                ) : (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (embeddings)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="text"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
              />
              <div
                className="mt-2 p-2.5 rounded-lg"
                style={{ background: "#faeeda" }}
              >
                <p className="text-xs" style={{ color: "#854F0B" }}>
                  ⚠️ Self-hosted only — Ollama must run on the same machine as
                  Mnemo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveButton loading={loading} label="Save Provider Settings" />
    </form>
  );
}

function APIKeyManager() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState(1000);
  const [revealedKey, setRevealedKey] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: listAPIKeys,
  });

  async function handleCreate(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await createAPIKey({
        name: newKeyName,
        request_limit: newKeyLimit,
      });
      setRevealedKey(res.key);
      setNewKeyName("");
      setShowCreate(false);
      queryClient.invalidateQueries(["apiKeys"]);
      toast.success("API key created! Copy it now.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRegenerate(id) {
    try {
      const res = await regenerateKey(id);
      setRevealedKey(res.key);
      queryClient.invalidateQueries(["apiKeys"]);
      toast.success("Key regenerated! Copy it now.");
    } catch {
      toast.error("Failed to regenerate");
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAPIKey(id);
      queryClient.invalidateQueries(["apiKeys"]);
      toast.success("API key deleted");
    } catch {
      toast.error("Failed to delete key");
    }
  }

  async function handleToggle(key) {
    try {
      await updateAPIKey(key.id, { is_active: !key.is_active });
      queryClient.invalidateQueries(["apiKeys"]);
    } catch {
      toast.error("Failed to update key");
    }
  }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Generate keys to access your knowledge base programmatically. Max 10
        keys.
      </p>

      {revealedKey && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: "var(--success-light)",
            border: "1px solid var(--success)30",
          }}
        >
          <p
            className="text-xs font-medium mb-2"
            style={{ color: "var(--success)" }}
          >
            ✅ Copy your key now — never shown again
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-xs p-2 rounded-lg break-all"
              style={{
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {revealedKey}
            </code>
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(revealedKey);
                toast.success("Copied!");
              }}
            >
              Copy
            </button>
          </div>
          <button
            className="text-xs mt-2"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setRevealedKey(null)}
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <InlineSpinner size={20} />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          No API keys yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: key.is_active
                    ? "var(--bg-primary)"
                    : "var(--bg-secondary)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: key.is_active
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {key.name}
                    </p>
                    {!key.is_active && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--danger-light)",
                          color: "var(--danger)",
                        }}
                      >
                        Disabled
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {key.key_prefix}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {key.requests_made.toLocaleString()} /{" "}
                      {key.request_limit.toLocaleString()} requests
                    </span>
                    {key.last_used_at && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Last used {key.last_used_at.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  <div
                    className="h-1 rounded-full mt-1.5 overflow-hidden w-24"
                    style={{ background: "var(--border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((key.requests_made / key.request_limit) * 100, 100)}%`,
                        background:
                          key.requests_made >= key.request_limit
                            ? "var(--danger)"
                            : "var(--brand)",
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                    onClick={() => handleToggle(key)}
                  >
                    {key.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                    onClick={() => handleRegenerate(key.id)}
                  >
                    ↻
                  </button>
                  <button
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{
                      background: "var(--danger-light)",
                      color: "var(--danger)",
                    }}
                    onClick={() => handleDelete(key.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={() => setShowCreate(true)}
          disabled={keys.length >= 10}
        >
          + Create API Key{" "}
          {keys.length >= 10 && (
            <span style={{ color: "var(--text-muted)" }}>(limit reached)</span>
          )}
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl flex flex-col gap-3"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            New API Key
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Key name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. My Slack Bot"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                Limit: {newKeyLimit.toLocaleString()}
              </label>
              <input
                type="range"
                min={100}
                max={100000}
                step={100}
                value={newKeyLimit}
                onChange={(e) => setNewKeyLimit(+e.target.value)}
                className="w-full mt-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={creating}
            >
              {creating && <InlineSpinner size={14} />} Generate Key
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowCreate(false);
                setNewKeyName("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* API quick reference — 2 col grid */}
      <div
        className="mt-4 p-4 rounded-xl"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-xs font-medium mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Quick reference
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { method: "POST", path: "/v1/chat", desc: "Ask a question" },
            {
              method: "POST",
              path: "/v1/chat/stream",
              desc: "Streaming (SSE)",
            },
            { method: "GET", path: "/v1/documents", desc: "List documents" },
            { method: "POST", path: "/v1/upload", desc: "Upload document" },
            { method: "GET", path: "/v1/sessions", desc: "List sessions" },
            {
              method: "GET",
              path: "/v1/sessions/:id/messages",
              desc: "Session history",
            },
          ].map((ep, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs font-mono font-medium w-9 flex-shrink-0 text-right"
                style={{
                  color:
                    ep.method === "GET" ? "var(--success)" : "var(--brand)",
                }}
              >
                {ep.method}
              </span>
              <code
                className="text-xs truncate flex-1"
                style={{ color: "var(--text-primary)" }}
              >
                {ep.path}
              </code>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Header:{" "}
          <code style={{ color: "var(--brand)" }}>X-API-Key: mnemo_sk_...</code>
        </p>
      </div>
    </div>
  );
}

export default function Settings() {
  const [sessionId, setSessionId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const updateMutation = useMutation({ mutationFn: updateSettings });
  const clearMutation = useMutation({ mutationFn: clearKnowledgeBase });
  const pwMutation = useMutation({ mutationFn: changePassword });

  const [chunks, setChunks] = useState({ size: 500, overlap: 50 });
  const [pw, setPw] = useState({ old: "", new: "", confirm: "" });

  useEffect(() => {
    if (settings)
      setChunks({
        size: settings.chunk_size || 500,
        overlap: settings.chunk_overlap || 50,
      });
  }, [settings]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <InlineSpinner size={28} />
      </div>
    );

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

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <h1
            className="text-xl font-semibold mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Settings
          </h1>

          {/* Two-column on xl+, single column below */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* LEFT column */}
            <div>
              <Section title="🔌 AI Providers">
                <AIProviderConfig settings={settings} />
              </Section>

              <Section title="✂️ Chunking Settings">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateMutation
                      .mutateAsync({
                        chunk_size: chunks.size,
                        chunk_overlap: chunks.overlap,
                      })
                      .then(() => toast.success("Chunking settings saved!"))
                      .catch(() =>
                        toast.error("Failed to save chunking settings"),
                      );
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Chunk size: {chunks.size}</label>
                      <input
                        type="range"
                        min={100}
                        max={1000}
                        step={50}
                        value={chunks.size}
                        onChange={(e) =>
                          setChunks((p) => ({ ...p, size: +e.target.value }))
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="label">Overlap: {chunks.overlap}</label>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        step={10}
                        value={chunks.overlap}
                        onChange={(e) =>
                          setChunks((p) => ({ ...p, overlap: +e.target.value }))
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                  <SaveButton loading={updateMutation.isPending} />
                </form>
              </Section>

              <Section title="🔒 Change Password">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (pw.new !== pw.confirm) {
                      toast.error("Passwords do not match");
                      return;
                    }
                    if (pw.new.length < 8) {
                      toast.error("Min 8 characters");
                      return;
                    }
                    try {
                      await pwMutation.mutateAsync({
                        old_password: pw.old,
                        new_password: pw.new,
                      });
                      toast.success("Password changed successfully");
                      setPw({ old: "", new: "", confirm: "" });
                    } catch (err) {
                      toast.error(err.response?.data?.detail || "Failed");
                    }
                  }}
                >
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Current</label>
                      <input
                        className="input"
                        type="password"
                        value={pw.old}
                        onChange={(e) =>
                          setPw((p) => ({ ...p, old: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">New</label>
                      <input
                        className="input"
                        type="password"
                        value={pw.new}
                        onChange={(e) =>
                          setPw((p) => ({ ...p, new: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Confirm</label>
                      <input
                        className="input"
                        type="password"
                        value={pw.confirm}
                        onChange={(e) =>
                          setPw((p) => ({ ...p, confirm: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <SaveButton
                    loading={pwMutation.isPending}
                    label="Change Password"
                  />
                </form>
              </Section>

              <Section title="⚠️ Danger Zone">
                <p
                  className="text-xs mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Permanently deletes all documents and vector data. Cannot be
                  undone.
                </p>
                {!confirmClear ? (
                  <button
                    className="btn-danger"
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear Knowledge Base
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Are you sure?
                    </span>
                    <button
                      className="btn-danger flex items-center gap-2"
                      onClick={() =>
                        clearMutation
                          .mutateAsync()
                          .then(() => {
                            toast.success("Knowledge base cleared!");
                            setConfirmClear(false);
                          })
                          .catch(() =>
                            toast.error("Failed to clear knowledge base"),
                          )
                      }
                      disabled={clearMutation.isPending}
                    >
                      {clearMutation.isPending && <InlineSpinner size={14} />}{" "}
                      Yes, delete everything
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setConfirmClear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Section>
            </div>

            {/* RIGHT column */}
            <div>
              <Section title="💾 Storage Usage">
                <StorageBar />
              </Section>

              <Section title="🗄️ Vector Store">
                <VectorStoreConfig />
              </Section>

              <Section title="🧠 Your Default Prompt">
                <DefaultPromptEditor />
              </Section>

              <Section title="🔑 API Keys">
                <APIKeyManager />
              </Section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
