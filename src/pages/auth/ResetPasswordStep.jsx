import React from "react";
import { Lock, Check } from "lucide-react";
import { Btn } from "../../components/ui";

export default function ResetPasswordStep({ password, setPassword, confirmPassword, setConfirmPassword, busy, onSubmit }) {
  return (
    <form className="sb-au-form" onSubmit={onSubmit}>
      <div className="sb-au-field">
        <label><Lock size={13} /> New password</label>
        <input className="sb-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="sb-au-field">
        <label><Lock size={13} /> Confirm new password</label>
        <input className="sb-input" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="sb-flow-actions">
        <Btn type="submit" disabled={busy}>{busy ? "Saving..." : "Save new password"} <Check size={16} /></Btn>
      </div>
    </form>
  );
}
