import React, { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import { Card, SectionTitle, Btn } from "./ui";
import { useAuth } from "../lib/AuthContext";
import {
  isPushSupported, isPushConfigured, getCurrentSubscription,
  enablePushNotifications, disablePushNotifications, sendTestNotification,
  getNotificationPrefs, setNotificationPrefs,
} from "../lib/pushClient";

const SLOTS = [
  { id: "morning", label: "Morning", hint: "~8:30am IST — today's plan" },
  { id: "afternoon", label: "Afternoon", hint: "~2:30pm IST — check-in nudge" },
  { id: "evening", label: "Evening", hint: "~8:00pm IST — wrap-up & revision" },
];

export default function SmartNotificationsCard() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testState, setTestState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const supported = isPushSupported();
  const configured = isPushConfigured();

  useEffect(() => {
    (async () => {
      const sub = await getCurrentSubscription().catch(() => null);
      setSubscribed(Boolean(sub));
      if (user) {
        const p = await getNotificationPrefs(user.id).catch(() => null);
        if (p) setPrefs(p);
      }
    })();
  }, [user]);

  const toggleSubscribed = async () => {
    setBusy(true);
    setErrorMsg("");
    try {
      if (subscribed) {
        await disablePushNotifications();
        setSubscribed(false);
      } else {
        await enablePushNotifications();
        setSubscribed(true);
        if (user) {
          const p = await getNotificationPrefs(user.id).catch(() => null);
          if (p) setPrefs(p);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
    }
    setBusy(false);
  };

  const toggleSlot = async (slotId) => {
    if (!user || !prefs) return;
    const next = { ...prefs, [slotId]: !prefs[slotId] };
    setPrefs(next);
    await setNotificationPrefs(user.id, { [slotId]: next[slotId] }).catch(() => {});
  };

  const toggleEnabled = async () => {
    if (!user || !prefs) return;
    const next = { ...prefs, enabled: !prefs.enabled };
    setPrefs(next);
    await setNotificationPrefs(user.id, { enabled: next.enabled }).catch(() => {});
  };

  const runTest = async () => {
    setTestState("sending");
    try {
      await sendTestNotification();
      setTestState("sent");
      setTimeout(() => setTestState("idle"), 3000);
    } catch (err) {
      setErrorMsg(err.message || "Test notification failed.");
      setTestState("error");
    }
  };

  return (
    <Card>
      <SectionTitle icon={BellRing}>Smart Notifications</SectionTitle>
      <p className="sb-muted" style={{ fontSize: 12.5, marginTop: 2, marginBottom: 14 }}>
        Up to 3 pushes a day — an AI reads your actual tasks, due revisions, and study time each time and writes
        something specific to your day, not a generic reminder. Generated server-side; your data never leaves
        StudyBun's own backend to build these.
      </p>

      {!supported && (
        <div className="sb-buddy-status-row"><Circle size={16} className="sb-muted" /><span>This browser doesn't support push notifications.</span></div>
      )}
      {supported && !configured && (
        <div className="sb-buddy-status-row"><Circle size={16} className="sb-muted" /><span>The app owner hasn't finished setting this up yet (VAPID keys missing).</span></div>
      )}

      {supported && configured && (
        <>
          <div className="sb-buddy-status-row">
            {subscribed ? <CheckCircle2 size={16} color="#6fcf8f" /> : <Circle size={16} className="sb-muted" />}
            <span>{subscribed ? "Notifications are on for this device" : "Notifications are off for this device"}</span>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={toggleSubscribed} disabled={busy}>
              {busy ? <Loader2 size={15} className="sb-spin" style={{ marginRight: 6, verticalAlign: "-2px" }} /> : null}
              {subscribed ? "Turn off on this device" : "Enable notifications"}
            </Btn>
            {subscribed && (
              <Btn variant="ghost" onClick={runTest} disabled={testState === "sending"}>
                <Send size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                {testState === "sending" ? "Sending…" : testState === "sent" ? "Sent! Check your device" : "Send test notification"}
              </Btn>
            )}
          </div>

          {errorMsg && <p style={{ color: "#e0736b", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</p>}

          {subscribed && prefs && (
            <div style={{ marginTop: 18 }}>
              <label className="sb-backup-checkbox">
                <input type="checkbox" checked={prefs.enabled !== false} onChange={toggleEnabled} />
                Smart Notifications enabled overall
              </label>

              <div className="sb-form-grid" style={{ marginTop: 12, opacity: prefs.enabled === false ? 0.5 : 1 }}>
                {SLOTS.map((s) => (
                  <label key={s.id} className="sb-backup-checkbox" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={prefs[s.id] !== false}
                      disabled={prefs.enabled === false}
                      onChange={() => toggleSlot(s.id)}
                    />
                    <span>
                      <strong>{s.label}</strong>
                      <div className="sb-muted" style={{ fontSize: 11.5 }}>{s.hint}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
