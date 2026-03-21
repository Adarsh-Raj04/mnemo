import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  login as loginApi,
  signup as signupApi,
  forgotPassword,
} from "../api/auth";
import { InlineSpinner } from "../components/Spinner";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "signup" ? "signup" : "login",
  );
  const { login, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate("/chat");
  }, [token]);

  // Login state
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loginErr, setLoginErr] = useState("");
  const [loginLoad, setLoginLoad] = useState(false);

  // Signup state
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [signupErr, setSignupErr] = useState("");
  const [signupMsg, setSignupMsg] = useState("");
  const [signupLoad, setSignupLoad] = useState(false);

  // Add these state variables at the top of Login()
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ text: "", ok: true });
  const [forgotLoad, setForgotLoad] = useState(false);

  async function handleForgot(e) {
    e.preventDefault();
    setForgotMsg({ text: "", ok: true });
    setForgotLoad(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotMsg({
        text: "If that email exists, a reset link has been sent.",
        ok: true,
      });
    } catch {
      setForgotMsg({ text: "Something went wrong. Try again.", ok: false });
    } finally {
      setForgotLoad(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr("");
    setLoginLoad(true);
    try {
      const data = await loginApi(loginData);
      const me = await import("../api/auth").then((m) =>
        m.getMe(data.access_token),
      );
      login(data.access_token, me);
      // Check settings to see if onboarding needed
      const settings = await import("../api/settings").then((m) =>
        m.getSettings(),
      );
      navigate(settings.has_api_key ? "/chat" : "/onboarding");
    } catch (err) {
      setLoginErr(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoginLoad(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setSignupErr("");
    setSignupMsg("");
    if (signupData.password !== signupData.confirm) {
      setSignupErr("Passwords do not match");
      return;
    }
    if (signupData.password.length < 8) {
      setSignupErr("Password must be at least 8 characters");
      return;
    }
    setSignupLoad(true);
    try {
      await signupApi({
        name: signupData.name,
        email: signupData.email,
        password: signupData.password,
      });
      setSignupMsg("Account created! Please check your email to verify.");
      setSignupData({ name: "", email: "", password: "", confirm: "" });
    } catch (err) {
      setSignupErr(err.response?.data?.detail || "Signup failed");
    } finally {
      setSignupLoad(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-secondary)" }}
    >
      {/* Top bar */}
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

      {/* Card */}
      <div className="card w-full max-w-md">
        {/* Tabs */}
        <div
          className="flex rounded-lg p-1 mb-6"
          style={{ background: "var(--bg-tertiary)" }}
        >
          {["login", "signup"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setLoginErr("");
                setSignupErr("");
                setSignupMsg("");
              }}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: tab === t ? "var(--bg-primary)" : "transparent",
                color: tab === t ? "var(--brand)" : "var(--text-muted)",
                boxShadow: tab === t ? "var(--shadow-sm)" : "none",
              }}
            >
              {t === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Login form */}
        {tab === "login" && (
          <form
            onSubmit={showForgot ? handleForgot : handleLogin}
            className="flex flex-col gap-4"
          >
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {showForgot ? "Forgot password" : "Welcome back"}
            </h2>

            {showForgot ? (
              <>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Enter your email and we'll send you a reset link.
                </p>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
                {forgotMsg.text && (
                  <p
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: forgotMsg.ok
                        ? "var(--success-light)"
                        : "var(--danger-light)",
                      color: forgotMsg.ok ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {forgotMsg.text}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-primary py-2.5 flex items-center justify-center gap-2"
                  disabled={forgotLoad}
                >
                  {forgotLoad && <InlineSpinner size={14} />}
                  {forgotLoad ? "Sending..." : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  className="text-xs text-center"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    setShowForgot(false);
                    setForgotMsg({ text: "", ok: true });
                  }}
                >
                  ← Back to login
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData((p) => ({ ...p, password: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="text-xs mt-1.5 float-right"
                    style={{ color: "var(--brand)" }}
                    onClick={() => setShowForgot(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                {loginErr && (
                  <p
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: "var(--danger-light)",
                      color: "var(--danger)",
                    }}
                  >
                    {loginErr}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-primary py-2.5 flex items-center justify-center gap-2"
                  disabled={loginLoad}
                >
                  {loginLoad && <InlineSpinner size={14} />}
                  {loginLoad ? "Logging in..." : "Login"}
                </button>
              </>
            )}
          </form>
        )}

        {/* Signup form */}
        {tab === "signup" && (
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Create your account
            </h2>
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                type="text"
                placeholder="Adarsh Raj"
                value={signupData.name}
                onChange={(e) =>
                  setSignupData((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={signupData.email}
                onChange={(e) =>
                  setSignupData((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Min 8 characters"
                value={signupData.password}
                onChange={(e) =>
                  setSignupData((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={signupData.confirm}
                onChange={(e) =>
                  setSignupData((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            {signupErr && (
              <p
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                }}
              >
                {signupErr}
              </p>
            )}
            {signupMsg && (
              <p
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: "var(--success-light)",
                  color: "var(--success)",
                }}
              >
                {signupMsg}
              </p>
            )}
            <button
              type="submit"
              className="btn-primary py-2.5 flex items-center justify-center gap-2"
              disabled={signupLoad}
            >
              {signupLoad && <InlineSpinner size={14} />}
              {signupLoad ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
