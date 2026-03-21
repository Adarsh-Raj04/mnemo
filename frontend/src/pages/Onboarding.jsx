import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { updateSettings } from "../api/settings";
import { testVectorStore, configureVector } from "../api/vectorStore";
import { InlineSpinner } from "../components/Spinner";
import ThemeToggle from "../components/ThemeToggle";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "api_key", label: "API Key" },
  { id: "vector_store", label: "Vector Store" },
  { id: "done", label: "Done" },
];

const VECTOR_STORES = [
  {
    id: "chroma",
    label: "ChromaDB",
    desc: "Default · Local file-based · Zero setup",
    fields: [],
  },
  {
    id: "pgvector",
    label: "pgvector",
    desc: "Your own PostgreSQL with pgvector extension",
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
    desc: "Cloud vector DB · Your own API key and index",
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
    desc: "Microsoft Azure cognitive search service",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint",
        placeholder: "https://xxx.search.windows.net",
      },
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

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [apiMsg, setApiMsg] = useState({ text: "", ok: true });
  const [apiLoad, setApiLoad] = useState(false);
  const [selectedStore, setSelectedStore] = useState("chroma");
  const [storeConfig, setStoreConfig] = useState({});
  const [testMsg, setTestMsg] = useState({ text: "", ok: true });
  const [testLoad, setTestLoad] = useState(false);
  const [saveLoad, setSaveLoad] = useState(false);

  const currentStore = VECTOR_STORES.find((s) => s.id === selectedStore);

  async function saveApiKey() {
    if (!apiKey.trim()) {
      setApiMsg({ text: "Please enter your API key", ok: false });
      return;
    }
    setApiLoad(true);
    try {
      await updateSettings({ openai_api_key: apiKey });
      setApiMsg({ text: "API key saved!", ok: true });
      setTimeout(() => setStep(2), 800);
    } catch (err) {
      setApiMsg({
        text: err.response?.data?.detail || "Failed to save",
        ok: false,
      });
    } finally {
      setApiLoad(false);
    }
  }

  async function handleTestConnection() {
    setTestMsg({ text: "", ok: true });
    setTestLoad(true);
    try {
      const res = await testVectorStore({
        store_type: selectedStore,
        config: storeConfig,
      });
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

  async function saveVectorStore() {
    setSaveLoad(true);
    try {
      if (selectedStore !== "chroma") {
        await configureVector({
          store_type: selectedStore,
          config: storeConfig,
        });
      }
      setStep(3);
    } catch (err) {
      setTestMsg({
        text: err.response?.data?.detail || "Failed to save",
        ok: false,
      });
    } finally {
      setSaveLoad(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-secondary)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <span
          className="font-semibold text-sm flex items-center gap-2"
          style={{ color: "var(--brand)" }}
        >
          🧬 Mnemo
        </span>
        <ThemeToggle />
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 py-6">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center
                           text-xs font-semibold transition-all"
                style={{
                  background: i <= step ? "var(--brand)" : "var(--border)",
                  color: i <= step ? "#fff" : "var(--text-muted)",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className="text-xs hidden sm:block"
                style={{
                  color:
                    i === step ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-8 h-px"
                style={{
                  background: i < step ? "var(--brand)" : "var(--border)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="card w-full max-w-lg">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">🧬</div>
              <h1
                className="text-2xl font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Welcome to Mnemo{user?.name ? `, ${user.name}` : ""}!
              </h1>
              <p
                className="text-sm mb-8 leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Let's get you set up in just a couple of steps. You can skip any
                step and configure it later in Settings.
              </p>
              <button
                className="btn-primary px-8 py-2.5"
                onClick={() => setStep(1)}
              >
                Let's go →
              </button>
            </div>
          )}

          {/* Step 1 — API Key */}
          {step === 1 && (
            <div>
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Add your OpenAI API key
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--text-secondary)" }}
              >
                Mnemo uses your own key — we never charge you for AI usage. Get
                one at{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--brand)" }}
                >
                  platform.openai.com
                </a>
              </p>

              <label className="label">OpenAI API Key</label>
              <input
                className="input mb-2"
                type="password"
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />

              {apiMsg.text && (
                <p
                  className="text-xs px-3 py-2 rounded-lg mb-4"
                  style={{
                    background: apiMsg.ok
                      ? "var(--success-light)"
                      : "var(--danger-light)",
                    color: apiMsg.ok ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {apiMsg.text}
                </p>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  onClick={saveApiKey}
                  disabled={apiLoad}
                >
                  {apiLoad && <InlineSpinner size={14} />}
                  Save & Continue
                </button>
                <button
                  className="btn-secondary px-4"
                  onClick={() => setStep(2)}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Vector Store */}
          {step === 2 && (
            <div>
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Choose your vector store
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--text-secondary)" }}
              >
                This is where your document embeddings are stored. ChromaDB
                works out of the box — you can always change this later.
              </p>

              {/* Store selector */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {VECTOR_STORES.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setSelectedStore(store.id);
                      setStoreConfig({});
                      setTestMsg({ text: "", ok: true });
                    }}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{
                      border: `2px solid ${selectedStore === store.id ? "var(--brand)" : "var(--border)"}`,
                      background:
                        selectedStore === store.id
                          ? "var(--brand-light)"
                          : "var(--bg-secondary)",
                    }}
                  >
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          selectedStore === store.id
                            ? "var(--brand)"
                            : "var(--text-primary)",
                      }}
                    >
                      {store.label}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {store.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Config fields */}
              {currentStore?.fields.length > 0 && (
                <div
                  className="flex flex-col gap-3 mb-4 p-4 rounded-xl"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {currentStore.fields.map((f) => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input
                        className="input"
                        type={f.type || "text"}
                        placeholder={f.placeholder}
                        value={storeConfig[f.key] || ""}
                        onChange={(e) =>
                          setStoreConfig((p) => ({
                            ...p,
                            [f.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}

                  {/* Test connection */}
                  <button
                    className="btn-secondary flex items-center justify-center gap-2 mt-1"
                    onClick={handleTestConnection}
                    disabled={testLoad}
                  >
                    {testLoad && <InlineSpinner size={14} />}
                    {testLoad ? "Testing..." : "🔌 Test Connection"}
                  </button>
                </div>
              )}

              {testMsg.text && (
                <p
                  className="text-xs px-3 py-2 rounded-lg mb-4"
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

              <div className="flex gap-3">
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  onClick={saveVectorStore}
                  disabled={saveLoad}
                >
                  {saveLoad && <InlineSpinner size={14} />}
                  {selectedStore === "chroma"
                    ? "Use ChromaDB & Continue"
                    : "Save & Continue"}
                </button>
                <button
                  className="btn-secondary px-4"
                  onClick={() => setStep(3)}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">🎉</div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                You're all set!
              </h2>
              <p
                className="text-sm mb-8 leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Start by uploading your first document or connecting a data
                source. You can always adjust settings later.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  className="btn-primary py-2.5"
                  onClick={() => navigate("/documents")}
                >
                  Upload documents →
                </button>
                <button
                  className="btn-secondary py-2.5"
                  onClick={() => navigate("/connectors")}
                >
                  Connect a data source
                </button>
                <button
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => navigate("/chat")}
                >
                  Skip for now → go to chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
