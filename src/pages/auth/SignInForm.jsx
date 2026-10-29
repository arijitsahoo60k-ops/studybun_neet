import React from "react";
import { Mail, Lock, ChevronRight } from "lucide-react";
import { Btn } from "../../components/ui";

export default function SignInForm({ email, setEmail, password, setPassword, busy, onSubmit, onForgot }) {
  return (
    <form className="sb-au-form" onSubmit={onSubmit}>
      <div className="sb-au-field">
        <label><Mail size={13} /> Email</label>
        <input className="sb-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="sb-au-field">
        <label><Lock size={13} /> Password</label>
        <input className="sb-input" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="sb-au-link-row">
        <button type="button" className="sb-au-link" onClick={onForgot}>Forgot password?</button>
      </div>
      <div className="sb-flow-actions">
        <Btn type="submit" disabled={busy}>{busy ? "Please wait..." : "Sign in"} <ChevronRight size={16} /></Btn>
      </div>
    </form>
  );
}
