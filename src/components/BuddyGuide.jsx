import React, { useEffect, useRef, useState } from "react";
import { X, Sparkles, Send, GraduationCap, Settings as SettingsIcon, RefreshCw, Lock } from "lucide-react";
import Mascot from "./Mascot";
import { buddyLine, MASCOTS, mascotTheme } from "../data/mascots";
import { askBuddy } from "../services/buddyAI";
import { getCachedAIStatus, fetchAIStatus } from "../services/buddyKeyManager";
import { buildStatsSnapshot } from "../lib/statsSnapshot";
import { ProgressBar } from "./ui";

/**
 * The mascot as the app's ever-present study buddy.
 *
 * Two layers:
 *  - Quick tip (default): the existing fast, rule-based line grounded in the
 *    user's numbers for whatever page they're on — no AI call, instant.
 *  - Smart chat: tapping "Ask" opens a real conversation with the buddy
 *    acting as an instructor/guide, powered by Gemini through the buddy's
 *    own multi-key pool (configured in Settings). Every answer is grounded
 *    in the same real stats snapshot the AI Insights page uses.
 */
export default function BuddyGuide(p) {
  const [open, setOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [smartReady, setSmartReady] = useState(() => getCachedAIStatus().geminiReady);
  const listRef = useRef(null);

  const mascotLabel = MASCOTS[p.mascot]?.label || "Study Buddy";
  const mSound = mascotTheme(p.mascot).sound;

  const tip = buddyLine(p.page, {
    name: p.profile?.name,
    species: p.mascot,
    streak: p.streak,
    longestStreak: p.longestStreak,
    todayHours: p.todayHours,
    dailyGoal: p.profile?.daily_goal || 6,
    overdueRevisions: p.overdueRevisions.length,
    dueRevisions: p.dueRevisions.length,
    upcomingRevisions: p.upcomingRevisions?.length || 0,
    backlogChapters: p.backlogChapters.length,
    totalQuestions: p.totalQuestions,
    todayQuestions: p.todayQuestions,
    mocks: p.mocks,
    mocksCount: p.mocks.length,
    unlockedCount: p.unlockedAchievements.length,
    achievementDefsCount: p.achievementDefs.length,
    overallPct: p.overallPct,
    masteredCount: p.masteredCount,
    weeklyData: p.weeklyData,
  });

  const urgent = p.mood === "reminder" || p.mood === "concerned";
  const unlockAt = p.featureUnlockStreak ?? 6;
  const streakLocked = (p.streak || 0) < unlockAt;
  const chatLocked = streakLocked || !smartReady;

  useEffect(() => {
    // Re-check whenever the chat is opened, in case the server config changed.
    if (chatOpen) fetchAIStatus().then((s) => setSmartReady(s.geminiReady));
  }, [chatOpen]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, chatOpen]);

  const openChat = () => {
    setOpen(true);
    setChatOpen(true);
    fetchAIStatus().then((s) => setSmartReady(s.geminiReady));
    if (messages.length === 0) {
      setMessages([{
        role: "buddy",
        text: `${mSound} Hey${p.profile?.name ? ` ${p.profile.name}` : ""} — I'm ${mascotLabel}, your instructor here. Ask me anything about your prep and I'll answer straight, based on your actual numbers.`,
      }]);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const snapshot = buildStatsSnapshot(p);
      const { reply } = await askBuddy({
        message: text,
        history: nextMessages,
        mascotLabel,
        userName: p.profile?.name,
        statsSnapshot: snapshot,
      });
      setMessages((cur) => [...cur, { role: "buddy", text: reply }]);
    } catch (e) {
      setError(e.message || "Couldn't reach Gemini just now.");
      if (e.code === "no_keys") setSmartReady(false);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`sb-buddy ${open ? "open" : "closed"}`}>
      {open && chatOpen && (
        <div className="sb-buddy-chat">
          <div className="sb-buddy-chat-head">
            <div className="sb-buddy-chat-title">
              <GraduationCap size={15} />
              <span>{mascotLabel} · Instructor</span>
            </div>
            <button className="sb-buddy-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
              <X size={15} />
            </button>
          </div>

          {streakLocked ? (
            <div className="sb-buddy-chat-empty">
              <Lock size={22} />
              <p>Smart chat unlocks at a {unlockAt}-day streak — you're on day {p.streak || 0}.</p>
              <div style={{ width: "100%", maxWidth: 200 }}><ProgressBar pct={((p.streak || 0) / unlockAt) * 100} paw={false} /></div>
              <p style={{ fontSize: 11, opacity: 0.8 }}>Keeps AI usage tied to real, daily study — not spammed for fun.</p>
            </div>
          ) : !smartReady ? (
            <div className="sb-buddy-chat-empty">
              <Mascot species={p.mascot} mood="idle" size={48} />
              <p>Smart chat isn't set up yet — check back soon.</p>
              <button className="sb-buddy-action" onClick={() => { setChatOpen(false); p.setPage("settings"); }}>
                <SettingsIcon size={12} /> Smart Buddy status
              </button>
            </div>
          ) : (
            <>
              <div className="sb-buddy-chat-list" ref={listRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`sb-buddy-msg sb-buddy-msg-${m.role}`}>{m.text}</div>
                ))}
                {sending && (
                  <div className="sb-buddy-msg sb-buddy-msg-buddy sb-buddy-msg-loading">
                    <RefreshCw size={12} className="sb-spin" /> Thinking...
                  </div>
                )}
                {error && <div className="sb-buddy-msg sb-buddy-msg-error">{error}</div>}
              </div>
              <div className="sb-buddy-chat-input">
                <textarea
                  rows={1}
                  placeholder={`Ask ${mascotLabel} something...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                />
                <button onClick={send} disabled={sending || !input.trim()} aria-label="Send">
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {open && !chatOpen && (
        <div className="sb-buddy-bubble">
          <button className="sb-buddy-close" onClick={() => setOpen(false)} aria-label="Minimize study buddy">
            <X size={13} />
          </button>
          <p className="sb-buddy-text">{tip.text}</p>
          <div className="sb-buddy-bubble-row">
            {tip.action && (
              <button className="sb-buddy-action" onClick={() => p.setPage(tip.action.page)}>
                {tip.action.label} <Sparkles size={12} />
              </button>
            )}
            <button className="sb-buddy-action sb-buddy-action-ask" onClick={openChat}>
              Ask {mascotLabel} {chatLocked ? <Lock size={11} /> : <GraduationCap size={12} />}
            </button>
          </div>
        </div>
      )}

      <button
        className="sb-buddy-avatar"
        onClick={() => { if (!open) { setOpen(true); } else if (chatOpen) { setChatOpen(false); } else { setOpen(false); } }}
        aria-label="Open study buddy"
      >
        <Mascot species={p.mascot} mood={p.mood} energy={p.energy} size={52} hop={p.hopping} />
        {urgent && !open && <span className="sb-buddy-dot" />}
        {smartReady && !streakLocked && <span className="sb-buddy-smart-dot" title="Smart mode ready" />}
      </button>
    </div>
  );
}
