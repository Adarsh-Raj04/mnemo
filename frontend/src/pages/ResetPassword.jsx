import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { InlineSpinner } from "../components/Spinner";
import ThemeToggle from "../components/ThemeToggle";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [pw, setPw] = useState({ new: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: "", ok: true });

    if (!token) {
      setMsg({
        text: "Invalid reset link. Please request a new one.",
        ok: false,
      });
      return;
    }
    if (pw.new !== pw.confirm) {
      setMsg({ text: "Passwords do not match", ok: false });
      return;
    }
    if (pw.new.length < 8) {
      setMsg({ text: "Password must be at least 8 characters", ok: false });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, pw.new);
      setMsg({
        text: "Password reset successfully! Redirecting to login...",
        ok: true,
      });
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setMsg({
        text:
          err.response?.data?.detail || "Reset failed. Link may have expired.",
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-secondary)" }}
    >
      <div className="absolute top-4 left-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold text-sm"
          style={{ color: "var(--brand)" }}
        >
          🧬 Mnemo
        </Link>
      </div>
      <div className="absolute top-4 right-6">
        <ThemeToggle />
      </div>

      <div className="card w-full max-w-md">
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Reset your password
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Enter your new password below.
        </p>

        {!token ? (
          <div
            className="text-sm px-3 py-2 rounded-lg"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
          >
            Invalid or missing reset token. Please request a new reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                placeholder="Min 8 characters"
                value={pw.new}
                onChange={(e) => setPw((p) => ({ ...p, new: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={pw.confirm}
                onChange={(e) =>
                  setPw((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>

            {msg.text && (
              <p
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: msg.ok
                    ? "var(--success-light)"
                    : "var(--danger-light)",
                  color: msg.ok ? "var(--success)" : "var(--danger)",
                }}
              >
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary py-2.5 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading && <InlineSpinner size={14} />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <Link
              to="/login"
              className="text-xs text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
