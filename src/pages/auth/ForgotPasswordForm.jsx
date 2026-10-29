import React from "react";
import { Mail, ChevronRight } from "lucide-react";
import { Btn } from "../../components/ui";

export default function ForgotPasswordForm({ email, setEmail, busy, onSubmit, onBack }) {
  return (
    <form className="sb-au-form" onSubmit={onSubmit}>
      <div className="sb-au-field">
        <label><Mail size={13} /> Email</label>
        <input className="sb-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="sb-au-link-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="sb-au-link" onClick={onBack}>Back to sign in</button>
      </div>
      <div className="sb-flow-actions">
        <Btn type="submit" disabled={busy}>{busy ? "Sending..." : "Send reset link"} <ChevronRight size={16} /></Btn>
      </div>
    </form>
  );
}
