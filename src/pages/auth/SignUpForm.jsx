import React from "react";
import { Mail, Lock, ChevronRight } from "lucide-react";
import { Btn } from "../../components/ui";

export default function SignUpForm({ email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, busy, onSubmit }) {
  return (
    <form className="sb-au-form" onSubmit={onSubmit}>
      <div className="sb-au-field">
        <label><Mail size={13} /> Email</label>
        <input className="sb-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="sb-au-field">
        <label><Lock size={13} /> Password</label>
        <input className="sb-input" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="sb-au-field">
        <label><Lock size={13} /> Confirm password</label>
        <input className="sb-input" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="sb-flow-actions">
        <Btn type="submit" disabled={busy}>{busy ? "Please wait..." : "Create account"} <ChevronRight size={16} /></Btn>
      </div>
    </form>
  );
}
