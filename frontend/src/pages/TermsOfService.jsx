import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const LAST_UPDATED = "March 21, 2026";
const EFFECTIVE_DATE = "March 21, 2026";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of terms",
    content: `By creating an account or using Mnemo, you agree to these Terms of Service. If you do not agree, please do not use the service. These terms apply to all users, including those accessing Mnemo through shared knowledge bases.`,
  },
  {
    id: "description",
    title: "What Mnemo is",
    content: `Mnemo is a personal knowledge base application that allows you to upload documents, connect data sources, and chat with your data using AI. Mnemo acts as infrastructure — we connect your documents to AI models using your own API credentials. We do not provide AI services directly.`,
  },
  {
    id: "account",
    title: "Your account",
    items: [
      {
        label: "Eligibility",
        detail:
          "You must be at least 13 years old to use Mnemo. By using the service you represent that you meet this requirement.",
      },
      {
        label: "Accuracy",
        detail:
          "You are responsible for providing accurate information when creating your account and keeping it up to date.",
      },
      {
        label: "Security",
        detail:
          "You are responsible for maintaining the confidentiality of your password and for all activity under your account. Notify us immediately if you suspect unauthorized access.",
      },
      {
        label: "One account per person",
        detail:
          "You may not create multiple accounts to circumvent limitations or policies.",
      },
    ],
  },
  {
    id: "your-content",
    title: "Your content",
    content: `You retain full ownership of all documents, data, and content you upload to Mnemo. By uploading content, you grant Mnemo a limited, non-exclusive license to process and store that content solely for the purpose of providing the service to you. This license ends when you delete your content or your account.`,
    items: [
      {
        label: "Your responsibility",
        detail:
          "You are solely responsible for the content you upload. Do not upload content you do not have the right to use, or content that violates any law.",
      },
      {
        label: "No sensitive data",
        detail:
          "Do not upload documents containing passwords, financial account numbers, government ID numbers, or medical records unless you fully understand and accept the associated risks.",
      },
      {
        label: "No illegal content",
        detail:
          "You may not upload content that infringes copyright, contains malware, is defamatory, or violates any applicable law.",
      },
    ],
  },
  {
    id: "api-keys",
    title: "API keys & third-party services",
    content: `Mnemo requires you to provide your own API keys for AI services (OpenAI) and optionally for vector stores (Pinecone, Azure AI Search). By providing these keys:`,
    items: [
      {
        label: "Your responsibility",
        detail:
          "You are responsible for all usage and costs incurred through your API keys. Mnemo is not liable for unexpected charges from third-party providers.",
      },
      {
        label: "Security",
        detail:
          "Keep your API keys confidential. Mnemo encrypts them, but you should rotate them if you suspect compromise.",
      },
      {
        label: "Third-party terms",
        detail:
          "Your use of third-party services through Mnemo is subject to those services' own terms and privacy policies.",
      },
    ],
  },
  {
    id: "storage-limits",
    title: "Storage limits",
    content: `Each account is subject to a 50MB storage limit across all uploaded documents and connected data sources. You will receive a warning notification when you reach 40MB. Mnemo reserves the right to suspend indexing (but not reading) of your knowledge base if you exceed the limit. You will never lose access to existing data due to exceeding the limit — only new indexing will be paused.`,
  },
  {
    id: "sharing",
    title: "Sharing & collaboration",
    content: `Mnemo allows you to share your knowledge base with other registered users. When you share:`,
    items: [
      {
        label: "Viewer access",
        detail:
          "Viewers can chat with your knowledge base. They cannot upload documents or see your credentials.",
      },
      {
        label: "Contributor access",
        detail:
          "Contributors can upload documents to your knowledge base in addition to chatting. Their uploads count against your storage limit.",
      },
      {
        label: "Your responsibility",
        detail:
          "You are responsible for who you share your knowledge base with. Revoke access at any time from the Sharing page.",
      },
      {
        label: "API key usage",
        detail:
          "When someone chats with your shared knowledge base, your OpenAI API key is used. This may incur costs on your account.",
      },
    ],
  },
  {
    id: "prohibited",
    title: "Prohibited uses",
    content: "You may not use Mnemo to:",
    items: [
      {
        label: "Illegal activity",
        detail:
          "Use the service for any unlawful purpose or in violation of any applicable regulations.",
      },
      {
        label: "Abuse",
        detail:
          "Attempt to gain unauthorized access to other users' data, reverse engineer the service, or interfere with its operation.",
      },
      {
        label: "Automated abuse",
        detail:
          "Use automated scripts to create accounts, upload content at scale, or circumvent rate limits.",
      },
      {
        label: "Harmful content",
        detail:
          "Upload or generate content that is abusive, harassing, hateful, or that promotes violence.",
      },
    ],
  },
  {
    id: "availability",
    title: "Service availability",
    content: `Mnemo is provided "as is." We do not guarantee 100% uptime. We may perform maintenance, updates, or experience downtime. We will make reasonable efforts to notify users of planned maintenance. We are not liable for losses resulting from service interruptions.`,
  },
  {
    id: "termination",
    title: "Termination",
    content: `You may delete your account at any time from the Settings page. Upon deletion, your data will be removed from our systems within 30 days, except where retention is required by law. We reserve the right to suspend or terminate accounts that violate these terms, with or without notice depending on the severity of the violation.`,
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: `To the maximum extent permitted by law, Mnemo and its operators are not liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of profits, or business interruption, arising from your use of the service. Our total liability for any claim is limited to the amount you paid us in the 12 months prior to the claim (which is zero for free accounts).`,
  },
  {
    id: "changes",
    title: "Changes to terms",
    content: `We may update these terms from time to time. We will notify you of material changes by email at least 14 days before they take effect. Continued use of Mnemo after that date constitutes acceptance. If you do not agree to updated terms, you may delete your account before they take effect.`,
  },
  {
    id: "governing-law",
    title: "Governing law",
    content: `These terms are governed by applicable law. Any disputes will be resolved through good-faith negotiation first. If unresolved, disputes will be subject to binding arbitration rather than litigation, except where prohibited by law.`,
  },
  {
    id: "contact",
    title: "Contact",
    content: `Questions about these terms? Contact us at legal@mnemo.app. We aim to respond within 5 business days.`,
  },
];

export default function TermsOfService() {
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
              Terms of Service
            </span>
          </div>
          <h1
            className="text-3xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Terms of Service
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Last updated: {LAST_UPDATED}
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Effective: {EFFECTIVE_DATE}
            </p>
          </div>
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
              Be respectful, don't upload illegal content, keep your API keys
              safe, and understand that Mnemo is infrastructure — your API costs
              are your own.
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
            to="/privacy"
            className="text-xs"
            style={{ color: "var(--brand)" }}
          >
            ← Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
