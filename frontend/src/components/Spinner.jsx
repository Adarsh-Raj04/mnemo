import { useEffect, useRef } from "react";

// Top progress bar — like YouTube/GitHub
let progressInterval = null;

export function startProgress() {
  const bar = document.getElementById("kb-progress-bar");
  if (!bar) return;
  let width = 0;
  bar.style.opacity = "1";
  bar.style.width = "0%";
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    width += Math.random() * 12;
    if (width >= 90) {
      width = 90;
      clearInterval(progressInterval);
    }
    bar.style.width = width + "%";
  }, 150);
}

export function finishProgress() {
  const bar = document.getElementById("kb-progress-bar");
  if (!bar) return;
  clearInterval(progressInterval);
  bar.style.width = "100%";
  setTimeout(() => {
    bar.style.opacity = "0";
    bar.style.width = "0%";
  }, 400);
}

// Progress bar element — put this once in your layout
export function ProgressBar() {
  return (
    <div
      id="kb-progress-bar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        width: "0%",
        background: "var(--brand)",
        zIndex: 99999,
        opacity: 0,
        borderRadius: "0 2px 2px 0",
        transition: "width 0.15s ease, opacity 0.4s ease",
        pointerEvents: "none",
      }}
    />
  );
}

// Full screen overlay spinner — for heavy tasks like uploading
export function FullScreenSpinner({
  message = "Processing...",
  sub = "This may take a few seconds",
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-50"
      style={{
        background: "rgba(var(--bg-primary-rgb, 255,255,255), 0.92)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full border-4 animate-spin"
        style={{
          borderColor: "var(--brand-light)",
          borderTopColor: "var(--brand)",
        }}
      />
      <div className="text-center">
        <p className="font-medium text-sm" style={{ color: "var(--brand)" }}>
          {message}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

// Inline spinner — for buttons and small loading states
export function InlineSpinner({ size = 16, className = "" }) {
  return (
    <div
      className={`rounded-full border-2 animate-spin flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: "var(--brand-light)",
        borderTopColor: "var(--brand)",
      }}
    />
  );
}
