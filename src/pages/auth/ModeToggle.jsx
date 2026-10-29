import React from "react";

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="sb-au-toggle" data-mode={mode === "signup" ? "signup" : "signin"}>
      <span className="sb-au-toggle-pill" aria-hidden="true" />
      <button type="button" className={`sb-au-toggle-btn ${mode === "signin" ? "active" : ""}`} onClick={() => onChange("signin")}>
        Sign in
      </button>
      <button type="button" className={`sb-au-toggle-btn ${mode === "signup" ? "active" : ""}`} onClick={() => onChange("signup")}>
        Sign up
      </button>
    </div>
  );
}
