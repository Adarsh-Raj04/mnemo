import { useTheme } from "../hooks/useTheme";

const options = [
  { value: "light", icon: "☀️", label: "Light" },
  { value: "dark", icon: "🌙", label: "Dark" },
  { value: "system", icon: "💻", label: "System" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-1"
      style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs
                     font-medium transition-all duration-150"
          style={{
            background:
              theme === opt.value ? "var(--bg-primary)" : "transparent",
            color: theme === opt.value ? "var(--brand)" : "var(--text-muted)",
            boxShadow: theme === opt.value ? "var(--shadow-sm)" : "none",
          }}
        >
          <span style={{ fontSize: 13 }}>{opt.icon}</span>

          {/* <span className="hidden sm:inline">{opt.label}</span> */}
        </button>
      ))}
    </div>
  );
}
