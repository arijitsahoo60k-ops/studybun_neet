import React, { useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import AuthOnboardStyle from "../../styles/AuthOnboardStyle";
import AuthCard from "./AuthCard";
import ModeToggle from "./ModeToggle";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ConfirmEmailStep from "./ConfirmEmailStep";
import ResetPasswordStep from "./ResetPasswordStep";

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

  const clearMessages = () => { setError(""); setInfo(""); };
  const switchMode = (next) => { setMode(next); clearMessages(); };

  if (passwordRecovery) {
    return (
      <>
        <AuthOnboardStyle />
        <AuthCard mood="thinking" bubble="Almost there!" title="Choose a new password"
          subtitle="You're signed in via your reset link — set a new password to finish." error={error} info={info}>
          <ResetPasswordStep
            password={password} setPassword={setPassword}
            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              clearMessages();
              if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
              if (password !== confirmPassword) { setError("Passwords don't match."); return; }
              setBusy(true);
              const { error: err } = await updatePassword(password);
              setBusy(false);
              if (err) setError(err.message);
              else setInfo("Password updated! You're all set.");
            }}
          />
        </AuthCard>
      </>
    );
  }

  if (awaitingConfirmation) {
    return (
      <>
        <AuthOnboardStyle />
        <AuthCard mood="happy" bubble="One quick step left!" title="Check your email 📬" info={info}>
          <ConfirmEmailStep
            email={email}
            busy={busy}
            onResend={async () => {
              setBusy(true); clearMessages();
              const { error: err } = await resendConfirmation(email);
              setBusy(false);
              if (err) setError(err.message);
              else setInfo("Confirmation email resent.");
            }}
            onBack={() => { setAwaitingConfirmation(false); switchMode(MODES.SIGN_IN); }}
          />
        </AuthCard>
      </>
    );
  }

  async function handleSignIn(e) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err.message);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    clearMessages();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { data, error: err } = await signUp(email, password);
    setBusy(false);
    if (err) { setError(err.message); return; }
    if (data.user && !data.session) { setAwaitingConfirmation(true); return; }
    // If email confirmation is disabled on the project, signUp already
    // returns a session — the auth listener picks it up and the app moves on.
  }

  async function handleForgot(e) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    const { error: err } = await sendPasswordReset(email);
    setBusy(false);
    if (err) setError(err.message);
    else setInfo("If that email has an account, a reset link is on its way.");
  }

  const titleFor = {
    [MODES.SIGN_UP]: <>Create your account <span className="sb-auth-emoji-wiggle">🌸</span></>,
    [MODES.FORGOT]: "Reset your password",
    [MODES.SIGN_IN]: <>Welcome back <span className="sb-auth-emoji-wiggle">🌸</span></>,
  };
  const subFor = {
    [MODES.FORGOT]: "We'll email you a link to set a new password.",
    [MODES.SIGN_UP]: "Sign in to keep your study data synced across devices.",
    [MODES.SIGN_IN]: "Sign in to keep your study data synced across devices.",
  };
  const bubbleFor = {
    [MODES.SIGN_UP]: "So glad you're here!",
    [MODES.FORGOT]: "No worries, it happens!",
    [MODES.SIGN_IN]: "Welcome back, friend!",
  };

  return (
    <>
      <AuthOnboardStyle />
      <AuthCard mood={mode === MODES.SIGN_UP ? "celebrate" : "happy"} bubble={bubbleFor[mode]}
        title={titleFor[mode]} subtitle={subFor[mode]} error={error} info={info}>
        {mode !== MODES.FORGOT && <ModeToggle mode={mode} onChange={switchMode} />}

        {mode === MODES.SIGN_IN && (
          <SignInForm email={email} setEmail={setEmail} password={password} setPassword={setPassword}
            busy={busy} onSubmit={handleSignIn} onForgot={() => switchMode(MODES.FORGOT)} />
        )}
        {mode === MODES.SIGN_UP && (
          <SignUpForm email={email} setEmail={setEmail} password={password} setPassword={setPassword}
            confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
            busy={busy} onSubmit={handleSignUp} />
        )}
        {mode === MODES.FORGOT && (
          <ForgotPasswordForm email={email} setEmail={setEmail} busy={busy}
            onSubmit={handleForgot} onBack={() => switchMode(MODES.SIGN_IN)} />
        )}
      </AuthCard>
    </>
  );
}
