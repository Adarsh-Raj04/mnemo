import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const features = [
  {
    icon: "📄",
    title: "Upload Any Document",
    desc: "PDF and TXT files supported. Drag and drop to upload. Documents are chunked and indexed automatically.",
  },
  {
    icon: "💬",
    title: "Chat With Your Docs",
    desc: "Ask questions in natural language. Get answers with exact source citations — filename and page number.",
  },
  {
    icon: "🔒",
    title: "Fully Private",
    desc: "Your documents stay on your server. Bring your own OpenAI API key — we never store your data in the cloud.",
  },
  {
    icon: "🤝",
    title: "Share With Others",
    desc: "Invite teammates by email. Set them as viewer or contributor. Revoke access anytime.",
  },
  {
    icon: "💾",
    title: "Lifetime Storage",
    desc: "Your knowledge base persists forever. Chat history saved per session. Never lose your indexed documents.",
  },
  {
    icon: "⚙️",
    title: "Fully Customizable",
    desc: "Switch between GPT models. Tune chunking settings. Everything configurable from the settings page.",
  },
];

const steps = [
  {
    n: "1",
    title: "Sign Up",
    desc: "Create your account with email verification",
  },
  { n: "2", title: "Add API Key", desc: "Enter your OpenAI key in Settings" },
  { n: "3", title: "Upload Docs", desc: "Drag & drop your PDFs or text files" },
  { n: "4", title: "Start Chatting", desc: "Ask anything from your documents" },
];

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-6 pt-20 pb-16">
        <span
          className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-6"
          style={{ background: "var(--brand-light)", color: "var(--brand)" }}
        >
          Free &amp; Open Source
        </span>
        <h1
          className="text-4xl sm:text-5xl font-bold mb-5 leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Your Personal
          <br />
          <span style={{ color: "var(--brand)" }}>Knowledge Base</span>
        </h1>
        <p
          className="text-lg mb-8 max-w-xl mx-auto leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Upload your documents, notes, and PDFs — then chat with them using AI.
          Private, fast, and powered by your own OpenAI key.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/login?tab=signup"
            className="btn-primary px-6 py-2.5 text-sm"
          >
            Get Started →
          </Link>
          <Link to="/login" className="btn-secondary px-6 py-2.5 text-sm">
            Login
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div
          className="my-8"
          style={{ borderTop: "1px solid var(--border)" }}
        />
        <h2
          className="text-2xl font-semibold text-center mb-10"
          style={{ color: "var(--text-primary)" }}
        >
          Everything you need
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="card p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3
                className="font-semibold text-sm mb-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                {f.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        className="py-16 px-6"
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl font-semibold text-center mb-10"
            style={{ color: "var(--text-primary)" }}
          >
            How it works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center
                             text-white font-bold text-lg mx-auto mb-3"
                  style={{ background: "var(--brand)" }}
                >
                  {s.n}
                </div>
                <p
                  className="font-semibold text-sm mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.title}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center py-20 px-6">
        <h2
          className="text-2xl font-semibold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Ready to get started?
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          It takes less than 2 minutes to set up.
        </p>
        <Link to="/login?tab=signup" className="btn-primary px-8 py-3 text-sm">
          Sign Up Free
        </Link>
      </section>

      {/* Footer */}
      <footer
        className="text-center py-6 text-xs"
        style={{
          borderTop: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        Built with FastAPI · ChromaDB · OpenAI · React
        <span> · </span>
        <Link to="/privacy" style={{ color: "var(--text-muted)" }}>
          Privacy
        </Link>
        <span> · </span>
        <Link to="/terms" style={{ color: "var(--text-muted)" }}>
          Terms
        </Link>
      </footer>
    </div>
  );
}
