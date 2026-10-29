// Mounts the REAL Group Timer page with the REAL focus timer hook, room hook, session tracker,
// global styles and theme -- the same wiring App.jsx does -- minus the rest of the app.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import GlobalStyle from "../src/styles/GlobalStyle";
import { THEMES, themeVars } from "../src/data/themes";
import GroupTimerPage from "../src/pages/GroupTimer";
import { useFocusTimer } from "../src/hooks/useFocusTimer";
import { useGroupTimerRoom } from "../src/hooks/useGroupTimerRoom";
import { createTimerSessionTracker } from "../src/lib/timerSessionTracker";
import { post } from "./fakeSupabase.js";

const params = new URLSearchParams(location.search);
const uid = params.get("u");

function Harness() {
  const [toasts, setToasts] = useState([]);
  const [saved, setSaved] = useState([]);
  const [page, setPage] = useState("grouptimer");
  const tracker = useRef(null);
  if (!tracker.current) {
    tracker.current = createTimerSessionTracker({
      getUserId: () => uid,
      insert: async (payload) => (await post("insert", { table: "timer_sessions", row: payload })).data || null,
      remove: async (id) => !(await post("delete", { table: "timer_sessions", id })).error,
      onInsertFailed: () => {}, onRemoveFailed: () => {},
    });
  }
  const focusTimer = useFocusTimer({
    onComplete: ({ mode, plannedMinutes, actualMinutes, completed, endedAt }) =>
      tracker.current.log({ mode, planned_minutes: plannedMinutes, actual_minutes: actualMinutes, completed, ...(endedAt ? { created_at: endedAt } : {}) }),
    onSessionSettled: (info) => tracker.current.settle(info),
  });
  const showToast = (m) => setToasts((t) => [...t, m]);
  const groupRoom = useGroupTimerRoom({ timer: focusTimer, userId: uid, notify: showToast });
  window.__e2e = { focusTimer, groupRoom };

  return (
    <div className="sb-app" style={themeVars(THEMES["Sakura Bloom"])}>
      <GlobalStyle />
      <main className="sb-main" style={{ padding: 16 }}>
        {page === "grouptimer" ? (
          <GroupTimerPage
            focusTimer={focusTimer} groupRoom={groupRoom} userId={uid} mascot="bunny"
            profile={{ name: params.get("name") || "Me" }}
            addSession={(s) => setSaved((x) => [...x, s])}
            setPage={setPage} showToast={showToast}
          />
        ) : <div id="other-page">Other page <button onClick={() => setPage("grouptimer")}>Back to Group Timer</button></div>}
      </main>
      <button id="go-other" style={{ position: "fixed", right: 4, bottom: 4, width: 40, height: 20, fontSize: 9, opacity: .4 }} onClick={() => setPage("other")}>o</button>
      <ul id="toasts" style={{ position: "fixed", right: 4, bottom: 28, maxWidth: 180, margin: 0, padding: 0, listStyle: "none", fontSize: 10, pointerEvents: "none", zIndex: 1 }}>{toasts.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <ul id="saved" style={{ position: "fixed", left: 4, bottom: 4, margin: 0, padding: 0, listStyle: "none", fontSize: 9, pointerEvents: "none" }}>{saved.map((s, i) => <li key={i}>{s.subject}|{s.chapter}|{s.minutes}</li>)}</ul>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
