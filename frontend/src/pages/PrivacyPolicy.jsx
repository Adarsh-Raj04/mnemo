import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const LAST_UPDATED = "March 21, 2026";

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: `Mnemo is built on a simple principle: your data belongs to you. We do not sell your data, we do not train AI models on your documents, and we do not share your information with third parties for advertising. This policy explains exactly what we collect, why, and how you can control it.`,
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    items: [
      {
        label: "Account information",
        detail:
          "Your name, email address, and hashed password when you sign up. We never store your password in plain text.",
      },
      {
        label: "Your documents",
        detail:
          "Files you upload are processed to extract text, chunked, and stored as vector embeddings in your chosen vector store. Original files are not retained on our servers after processing.",
      },
      {
        label: "Chat history",
        detail:
          "Your conversations are stored in your database so you can revisit them. You can delete any session at any time.",
      },
      {
        label: "API keys",
        detail:
          "Your OpenAI API key and any vector store credentials are encrypted using AES-256 (Fernet) before being stored. We cannot read them in plain text.",
      },
      {
        label: "Usage data",
        detail:
          "We track storage usage (how many bytes your documents consume) to enforce the 50MB per-user limit. We do not track which queries you make.",
      },
    ],
  },
  {
    id: "what-we-dont",
    title: "What we never do",
    items: [
      {
        label: "No training on your data",
        detail:
          "Your documents and conversations are never used to train AI models — ours or anyone else's.",
      },
      {
        label: "No selling your data",
        detail:
          "We do not sell, rent, or broker your personal information to any third party.",
      },
      {
        label: "No reading your documents",
        detail:
          "We do not access or read the content of your uploaded documents. Processing is automated.",
      },
      {
        label: "No advertising",
        detail:
          "Mnemo has no advertising business. We have no incentive to profile you.",
      },
    ],
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: `Mnemo integrates with services you explicitly configure:`,
    items: [
      {
        label: "OpenAI",
        detail:
          "Your queries and document chunks are sent to OpenAI's API using your own API key. OpenAI's privacy policy governs their handling of this data.",
      },
      {
        label: "Pinecone / Azure AI Search / pgvector",
        detail:
          "If you configure a third-party vector store, your embeddings are stored there under your own account credentials.",
      },
      {
        label: "Google Drive",
        detail:
          "If you connect Google Drive, we request read-only access. We only access files you explicitly select for indexing.",
      },
      {
        label: "SendGrid",
        detail:
          "We use SendGrid to send transactional emails (verification, password reset). Your email address is shared with SendGrid for this purpose only.",
      },
    ],
  },
  {
    id: "data-security",
    title: "Data security",
    content: `We take security seriously. All API keys and credentials are encrypted at rest. Passwords are hashed using bcrypt. Data is transmitted over HTTPS. We use JWT tokens with expiry for session management. However, no system is perfectly secure — please use a strong, unique password.`,
  },
  {
    id: "your-rights",
    title: "Your rights",
    items: [
      {
        label: "Access",
        detail: "You can view all your data through the app at any time.",
      },
      {
        label: "Deletion",
        detail:
          "You can delete individual documents, chat sessions, or your entire knowledge base from Settings. To delete your account entirely, contact us.",
      },
      {
        label: "Export",
        detail:
          "Chat history export is on our roadmap. Currently you can view all data through the app.",
      },
      {
        label: "Portability",
        detail:
          "Because you bring your own API keys and vector store, your data is never locked into Mnemo infrastructure.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies & local storage",
    content: `Mnemo stores your authentication token in browser localStorage to keep you logged in. We do not use tracking cookies or analytics cookies. We do not use any third-party analytics scripts.`,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: `If we make material changes to this policy, we will notify you by email and update the "Last updated" date at the top of this page. Continued use of Mnemo after changes constitutes acceptance of the updated policy.`,
  },
  {
    id: "contact",
    title: "Contact",
    content: `Questions about this policy? Reach out at privacy@mnemo.app. We aim to respond within 48 hours.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Link
              to="/"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Home
            </Link>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              ·
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Privacy Policy
            </span>
          </div>
          <h1
            className="text-3xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Privacy Policy
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Last updated: {LAST_UPDATED}
          </p>
          <div
            className="mt-6 p-4 rounded-xl"
            style={{
              background: "var(--brand-light)",
              border: "1px solid var(--brand)20",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: "var(--brand)" }}
            >
              🧬 The short version
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--brand-dark)" }}>
              Your documents stay yours. We encrypt your credentials. We never
              train on your data or sell your information. You can delete
              everything at any time.
            </p>
          </div>
        </div>

        {/* Table of contents */}
        <div
          className="mb-12 p-5 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-xs font-semibold mb-3 uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Contents
          </p>
          <div className="grid grid-cols-2 gap-1">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm py-1 transition-colors"
                style={{ color: "var(--brand)" }}
              >
                {i + 1}. {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {sections.map((section, i) => (
            <div key={section.id} id={section.id}>
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="text-xs font-mono font-medium px-2 py-0.5 rounded"
                  style={{
                    background: "var(--brand-light)",
                    color: "var(--brand)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {section.title}
                </h2>
              </div>

              {section.content && (
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {section.content}
                </p>
              )}

              {section.items && (
                <div className="flex flex-col gap-3">
                  {section.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex gap-4 p-4 rounded-xl"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="w-1 rounded-full flex-shrink-0 self-stretch"
                        style={{ background: "var(--brand)" }}
                      />
                      <div>
                        <p
                          className="text-sm font-medium mb-0.5"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.label}
                        </p>
                        <p
                          className="text-sm leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div
          className="mt-16 pt-8 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Mnemo · {LAST_UPDATED}
          </p>
          <Link
            to="/terms"
            className="text-xs"
            style={{ color: "var(--brand)" }}
          >
            Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}
