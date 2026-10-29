import React, { useState, lazy, Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { THEMES, themeVars, readStoredDarkMode } from "./data/themes";
import { DecorLayer, LoadingScreen } from "./components/ui";
import GlobalStyle from "./styles/GlobalStyle";
import Landing from "./pages/landing";

// Auth and App were eagerly imported here, which meant the ~955KB main
// bundle -- gsap, framer-motion, the entire Mascot mood engine, GlobalStyle,
// and every page's lazy-loader map -- had to be downloaded, parsed, and
// executed before an ANONYMOUS visitor could even see the landing page.
// Lighthouse hits "/" logged out, so this was the single biggest chunk of
// its 8.4s mobile LCP. Landing is the only thing a first-time visitor
// actually needs; Auth/App now load on demand, right when they're reached.
const Auth = lazy(() => import("./pages/auth"));
const App = lazy(() => import("./App"));

const DEFAULT_THEME = THEMES["Sakura Bloom"];

function Gate() {
  const { user, loading, passwordRecovery, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const darkMode = readStoredDarkMode(false);
  const cssVars = themeVars(DEFAULT_THEME, darkMode);

  // Supabase isn't configured yet — skip the auth wall so the existing
  // "not configured" banner inside App can explain what to do next.
  if (!isSupabaseConfigured) {
    return (
      <Suspense fallback={<LoadingScreen message="Waking up your study buddy..." />}>
        <App />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div style={cssVars} data-dark={darkMode ? "true" : "false"}>
        <GlobalStyle />
        <DecorLayer theme={DEFAULT_THEME} />
        <LoadingScreen message="Waking up your study buddy..." />
      </div>
    );
  }

  // A password-reset link signs the user in (Supabase needs a session to let
  // them set a new password), so `user` is already truthy at this point.
  // Without this check, Gate falls through to the normal dashboard below and
  // the "choose a new password" form (rendered inside <Auth />) never mounts
  // — the user just lands on their existing account, old password unchanged.
  if (!user || passwordRecovery) {
    if (!showAuth && !passwordRecovery) {
      return (
        <div style={themeVars(DEFAULT_THEME, false)}>
          <GlobalStyle />
          <Landing onGetStarted={() => setShowAuth(true)} />
        </div>
      );
    }
    return (
      <div className="sb-onboard sb-auth-page" style={cssVars} data-dark={darkMode ? "true" : "false"}>
        <GlobalStyle />
        {darkMode && <div className="sb-dark-glow-mesh" aria-hidden="true" />}
        <DecorLayer theme={DEFAULT_THEME} />
        {passwordRecovery ? (
          // Regular "Back to explore" would be a dead click here: Gate's
          // condition above (`!user || passwordRecovery`) keeps showing this
          // same screen no matter what showAuth is set to, since the recovery
          // session makes `user` truthy. Give the user a real way out instead
          // — sign out drops the recovery session, so Gate re-evaluates and
          // sends them to the landing page.
          <button
            className="sb-land-back-btn"
            onClick={async () => {
              await signOut();
              setShowAuth(false);
            }}
          >
            <ArrowLeft size={14} /> Cancel & sign out
          </button>
        ) : (
          <button className="sb-land-back-btn" onClick={() => setShowAuth(false)}>
            <ArrowLeft size={14} /> Back to explore
          </button>
        )}
        <div className="sb-flow-shell">
          <Suspense fallback={<LoadingScreen message="Waking up your study buddy..." />}>
            <Auth />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen message="Waking up your study buddy..." />}>
      <App />
    </Suspense>
  );
}

export default function AppRoot() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
