import React from "react";
import { Btn } from "../../components/ui";

export default function ConfirmEmailStep({ email, busy, onResend, onBack }) {
  return (
    <div className="sb-flow-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <p style={{ textAlign: "left", fontWeight: 700, fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>
        We sent a confirmation link to <strong style={{ color: "var(--ink)" }}>{email}</strong>. Click it to activate your account, then come back and sign in.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        <Btn variant="ghost" disabled={busy} onClick={onResend}>{busy ? "Sending..." : "Resend email"}</Btn>
        <Btn onClick={onBack}>Back to sign in</Btn>
      </div>
    </div>
  );
}
