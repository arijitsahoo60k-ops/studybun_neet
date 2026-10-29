import React, { useState } from "react";
import { Mail, Lock, ChevronRight } from "lucide-react";
import { Btn } from "../components/ui";
import Mascot from "../components/Mascot";
import { useAuth } from "../lib/AuthContext";

const MODES = { SIGN_IN: "signin", SIGN_UP: "signup", FORGOT: "forgot" };

export default function Auth() {
  const { signUp, signIn, sendPasswordReset, resendConfirmation, passwordRecovery, updatePassword } = useAuth();
  const [mode, setMode] = useState(MODES.SIGN_IN);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  if (passwordRecovery) {
    return (
      <div className="sb-onboard-card">
        <Mascot species="bunny" mood="thinking" size={72} />
        <h1 className="sb-onboard-title">Choose a new password</h1>
        <p className="sb-onboard-sub">You're signed in via your reset link — set a new password to finish.</p>
        {error && <p className="sb-auth-error">{error}</p>}
        {info && <p className="sb-auth-info">{info}</p>}
        <form
          className="sb-onboard-step"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(""); setInfo("");
            if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
            if (password !== confirmPassword) { setError("Passwords don't match."); return; }
            setBusy(true);
            const { error: err } = await updatePassword(password);
            setBusy(false);
            if (err) setError(err.message);
            else setInfo("Password updated! You're all set.");
          }}
        >
          <label>New password</label>
          <input className="sb-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <label style={{ marginTop: 12 }}>Confirm new password</label>
          <input className="sb-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          <div className="sb-onboard-actions" style={{ marginTop: 18 }}>
            <Btn type="submit" disabled={busy}>{busy ? "Saving..." : "Save new password"}</Btn>
          </div>
        </form>
      </div>
    );
  }

  if (awaitingConfirmation) {
    return (
      <div className="sb-onboard-card">
        <Mascot species="bunny" mood="happy" size={72} />
        <h1 className="sb-onboard-title">Check your email 📬</h1>
        <p className="sb-onboard-sub">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back and sign in.</p>
        {info && <p className="sb-auth-info">{info}</p>}
        <div className="sb-onboard-actions">
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true); setInfo(""); setError("");
              const { error: err } = await resendConfirmation(email);
              setBusy(false);
              if (err) setError(err.message);
              else setInfo("Confirmation email resent.");
            }}
          >
            {busy ? "Sending..." : "Resend email"}
          </Btn>
          <Btn onClick={() => { setAwaitingConfirmation(false); setMode(MODES.SIGN_IN); }}>Back to sign in</Btn>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo("");

    if (mode === MODES.FORGOT) {
      setBusy(true);
      const { error: err } = await sendPasswordReset(email);
      setBusy(false);
      if (err) setError(err.message);
      else setInfo("If that email has an account, a reset link is on its way.");
      return;
    }

    if (mode === MODES.SIGN_UP) {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { setError("Passwords don't match."); return; }
      setBusy(true);
      const { data, error: err } = await signUp(email, password);
      setBusy(false);
      if (err) { setError(err.message); return; }
      if (data.user && !data.session) { setAwaitingConfirmation(true); return; }
      // If email confirmation is disabled on the project, signUp already
      // returns a session — the auth listener picks it up and the app moves on.
      return;
    }

    setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div className="sb-onboard-card">
      <Mascot species="bunny" mood="happy" size={80} hopLoop />
      <h1 className="sb-onboard-title">
        {mode === MODES.SIGN_UP ? <>Create your account <span className="sb-auth-emoji-wiggle">🌸</span></> : mode === MODES.FORGOT ? "Reset your password" : <>Welcome back <span className="sb-auth-emoji-wiggle">🌸</span></>}
      </h1>
      <p className="sb-onboard-sub">
        {mode === MODES.FORGOT
          ? "We'll email you a link to set a new password."
          : "Sign in to keep your study data synced across devices."}
      </p>

      {mode !== MODES.FORGOT && (
        <div className="sb-chip-row" style={{ justifyContent: "center", marginBottom: 18 }}>
          <button type="button" className={`sb-chip ${mode === MODES.SIGN_IN ? "active" : ""}`} onClick={() => { setMode(MODES.SIGN_IN); setError(""); setInfo(""); }}>Sign in</button>
          <button type="button" className={`sb-chip ${mode === MODES.SIGN_UP ? "active" : ""}`} onClick={() => { setMode(MODES.SIGN_UP); setError(""); setInfo(""); }}>Sign up</button>
        </div>
      )}

      {error && <p className="sb-auth-error">{error}</p>}
      {info && <p className="sb-auth-info">{info}</p>}

      <form className="sb-onboard-step" onSubmit={handleSubmit}>
        <label><Mail size={13} style={{ verticalAlign: "-2px" }} /> Email</label>
        <input className="sb-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

        {mode !== MODES.FORGOT && (
          <>
            <label style={{ marginTop: 12 }}><Lock size={13} style={{ verticalAlign: "-2px" }} /> Password</label>
            <input className="sb-input" type="password" autoComplete={mode === MODES.SIGN_UP ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </>
        )}

        {mode === MODES.SIGN_UP && (
          <>
            <label style={{ marginTop: 12 }}>Confirm password</label>
            <input className="sb-input" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </>
        )}

        {mode === MODES.SIGN_IN && (
          <button type="button" className="sb-auth-link" onClick={() => { setMode(MODES.FORGOT); setError(""); setInfo(""); }}>Forgot password?</button>
        )}
        {mode === MODES.FORGOT && (
          <button type="button" className="sb-auth-link" onClick={() => { setMode(MODES.SIGN_IN); setError(""); setInfo(""); }}>Back to sign in</button>
        )}

        <div className="sb-onboard-actions" style={{ marginTop: 18 }}>
          <Btn type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === MODES.SIGN_UP ? "Create account" : mode === MODES.FORGOT ? "Send reset link" : "Sign in"} <ChevronRight size={16} />
          </Btn>
        </div>
      </form>
    </div>
  );
}
