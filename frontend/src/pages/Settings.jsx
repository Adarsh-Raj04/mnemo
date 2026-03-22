import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import StorageBar from "../components/StorageBar";
import toast from "react-hot-toast";

const MODELS = [
  "gpt-3.5-turbo",
  "gpt-4",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
];

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
        This applies to all your chats by default. You can override it per data
        source in the Connectors page.
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
  const [testMsg, setTestMsg] = useState({ text: "", ok: true }); // ← fixed
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
    if (["reading", "migrating", "verifying"].includes(d.migration_status)) {
      startPolling();
    }
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

  const migrationStatusLabel = {
    reading: "Reading vectors from source...",
    migrating: "Copying vectors to destination...",
    verifying: "Verifying migration...",
    rolling_back: "Something went wrong — rolling back...",
    done: "Migration complete!",
    failed: "Migration failed. Your original data is safe.",
    none: "",
  };

  const migrationStatusColor = {
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
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
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
      if (selected === "chroma") {
        await resetVectorStore();
      } else {
        await configureVector({ store_type: selected, config: fields });
      }
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
      toast.success("Migration started. This may take a while...");
      startPolling();
    } catch (err) {
      setMigrating(false);
      toast.error(err.response?.data?.detail || "Migration failed to start");
    }
  }

  return (
    <div>
      {/* Currently active */}
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

      {/* Migration in progress */}
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
              style={{
                color: migrationStatusColor[migStatus.status] || "var(--brand)",
              }}
            >
              {migrationStatusLabel[migStatus.status]}
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
              ✅ All {migStatus.total} vectors migrated. Original data kept as
              backup for 7 days.
            </p>
          )}
          {migStatus.status === "failed" && (
            <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
              ❌ Migration failed and was rolled back. Your original data is
              untouched.
            </p>
          )}
        </div>
      )}

      {/* Store selector */}
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

      {/* Config fields */}
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
            {testLoad && <InlineSpinner size={14} />}
            🔌 Test Connection
          </button>
          {/* Inline test result */}
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

      {/* Migration choice */}
      {!isSameStore && !migrating && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{ background: "#faeeda", border: "1px solid #EF9F2730" }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "#633806" }}>
            ⚠️ Switching from {configData?.store_type || "chroma"} to {selected}
          </p>
          <p className="text-xs mb-3" style={{ color: "#854F0B" }}>
            Your existing vectors won't automatically move. Choose how to handle
            your data:
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
                Copy all existing vectors to the new store. Recommended.
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
                Switch store without migrating. Re-upload documents manually.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!migrating && (
        <div className="flex gap-2">
          {!isSameStore && showMigrate ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleMigrate}
              disabled={saveLoad}
            >
              {saveLoad && <InlineSpinner size={14} />}
              🔄 Migrate & Switch
            </button>
          ) : (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleSaveOnly}
              disabled={saveLoad}
            >
              {saveLoad && <InlineSpinner size={14} />}
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AIProviderConfig({ settings, onSave }) {
  const [chatProvider, setChatProvider] = useState(
    settings?.chat_provider || "openai",
  );
  const [chatModel, setChatModel] = useState(
    settings?.chat_model || "gpt-3.5-turbo",
  );
  const [embedProvider, setEmbedProvider] = useState(
    settings?.embed_provider || "openai",
  );
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

  return (
    <form onSubmit={handleSave}>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Configure separate providers for chat generation and document embedding.
        Embeddings and chat can use different providers.
      </p>

      {/* Chat provider */}
      <div className="mb-4">
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
              className="text-left p-3 rounded-xl transition-all"
              style={{
                border: `2px solid ${chatProvider === p.id ? "var(--brand)" : "var(--border)"}`,
                background:
                  chatProvider === p.id
                    ? "var(--brand-light)"
                    : "var(--bg-secondary)",
              }}
            >
              <p
                className="text-sm font-medium"
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

        {/* Model selector for chosen provider */}
        <label className="label">Model</label>
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

      {/* Provider-specific credentials */}
      {chatProvider === "anthropic" && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <label className="label">
            Anthropic API Key{" "}
            {settings?.has_anthropic_key && (
              <span style={{ color: "var(--success)" }}>✅ saved</span>
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

      {chatProvider === "gemini" && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <label className="label">
            Google AI API Key{" "}
            {settings?.has_gemini_key && (
              <span style={{ color: "var(--success)" }}>✅ saved</span>
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

      {chatProvider === "ollama" && (
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <label className="label">Ollama base URL</label>
          <input
            className="input"
            type="text"
            placeholder="http://localhost:11434"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Make sure Ollama is running locally and the model is pulled.
          </p>
        </div>
      )}

      {/* Embedding provider */}
      <div className="mb-4">
        <label className="label">Embedding provider</label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Used when indexing documents. Changing this requires re-uploading all
          documents.
        </p>
        {EMBED_PROVIDERS.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-2 text-sm py-2 cursor-pointer"
          >
            <input
              type="radio"
              name="embed_provider"
              checked={embedProvider === p.id}
              onChange={() => setEmbedProvider(p.id)}
            />
            <span style={{ color: "var(--text-primary)" }}>{p.label}</span>
          </label>
        ))}
        {embedProvider !== "openai" && embedProvider !== chatProvider && (
          <p
            className="text-xs mt-2 px-3 py-2 rounded-lg"
            style={{ background: "#faeeda", color: "#633806" }}
          >
            ⚠️ Using {embedProvider} for embeddings requires its API key to be
            saved above.
          </p>
        )}
      </div>

      <SaveButton loading={loading} label="Save Provider Settings" />
    </form>
  );
}

export default function Settings() {
  const [sessionId, setSessionId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false); // ← fixed: was missing
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const updateMutation = useMutation({ mutationFn: updateSettings });
  const clearMutation = useMutation({ mutationFn: clearKnowledgeBase });
  const pwMutation = useMutation({ mutationFn: changePassword });

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [chunks, setChunks] = useState({ size: 500, overlap: 50 });
  const [pw, setPw] = useState({ old: "", new: "", confirm: "" });

  useEffect(() => {
    if (settings) {
      setModel(settings.preferred_model || "gpt-3.5-turbo");
      setChunks({
        size: settings.chunk_size || 500,
        overlap: settings.chunk_overlap || 50,
      });
    }
  }, [settings]); // ← fixed: was useState() instead of useEffect()

  async function save(key, value) {
    try {
      await updateMutation.mutateAsync({ [key]: value });
      toast.success("Saved!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  }

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
      <Navbar onMenuClick={() => setMenuOpen((o) => !o)} /> {/* ← fixed */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSessionId={sessionId}
          onSessionSelect={setSessionId}
          isOpen={menuOpen} // ← fixed
          onClose={() => setMenuOpen(false)} // ← fixed
        />

        <main className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl">
          <h1
            className="text-xl font-semibold mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Settings
          </h1>

          {/* API Key */}
          <Section title="🔑 OpenAI API Key">
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              {settings?.has_api_key
                ? "✅ API key is saved"
                : "❌ No API key set"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save("openai_api_key", apiKey);
              }}
            >
              <label className="label">Enter new API key</label>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <SaveButton loading={updateMutation.isPending} />
            </form>
          </Section>

          {/* Model */}
          <Section title="🤖 AI Model">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save("preferred_model", model);
              }}
            >
              <label className="label">Choose model</label>
              <select
                className="input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p
                className="text-xs mt-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                gpt-3.5-turbo is fastest and cheapest. gpt-4o is most capable.
              </p>
              <SaveButton loading={updateMutation.isPending} />
            </form>
          </Section>

          {/* AI Providers */}
          <Section title="🔌 AI Providers">
            <AIProviderConfig settings={settings} onSave={save} />
          </Section>

          {/* Chunking */}
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
                  .catch(() => toast.error("Failed to save chunking settings"));
              }}
            >
              <div className="flex flex-col gap-4">
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
                  <label className="label">
                    Chunk overlap: {chunks.overlap}
                  </label>
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

          {/* Password */}
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
              <div className="flex flex-col gap-3">
                <div>
                  <label className="label">Current password</label>
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
                  <label className="label">New password</label>
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
                  <label className="label">Confirm new password</label>
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

          {/* Storage */}
          <Section title="💾 Storage Usage">
            <StorageBar />
          </Section>

          {/* Default prompt */}
          <Section title="🧠 Your Default Prompt">
            <DefaultPromptEditor />
          </Section>

          {/* Vector store */}
          <Section title="🗄️ Vector Store">
            <VectorStoreConfig />
          </Section>

          {/* Danger zone */}
          <Section title="⚠️ Danger Zone">
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Permanently deletes all your documents and vector data. Cannot be
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
              <div className="flex items-center gap-3">
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
                  {clearMutation.isPending && <InlineSpinner size={14} />}
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
        </main>
      </div>
    </div>
  );
}
