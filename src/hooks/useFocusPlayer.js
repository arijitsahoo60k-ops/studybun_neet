import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "../lib/youtubeApi";
import { buildOrder, stepOrder, ytErrorMessage } from "../lib/radio";

// The playback engine behind Focus Music. It owns ONE YouTube IFrame player
// and makes it follow three inputs -- and nothing else:
//
//   items      what's in the queue (a station = 1 item, a playlist = N)
//   wantPlay   whether music should be audible right now
//   volume / shuffle / loop
//
// It never decides *when* music should play -- useFocusMusic derives
// `wantPlay` from the timer (running && music on) plus explicit user
// overrides. That separation is the whole fix for "music starts the moment
// I open the app": the old code rendered an autoplay=1 iframe whenever a
// link was saved; this only ever calls playVideo() while wantPlay is true.
//
// The player itself is created lazily (only once there's something to play
// AND a reason to load it) so people who never use music never download
// YouTube's player script.

const RESUME_KEY = "sb.focusMusic.resume.v1";
const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const BLOCKED_AFTER_MS = 4000;

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;

function readResume() {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeResume(v) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(v));
  } catch {
    /* private mode etc. -- resume position is a nicety, never critical */
  }
}

export function useFocusPlayer({ queueKey, items, wantPlay, needPlayer, volume, shuffle, loop }) {
  const [host, setHost] = useState(null); // React-owned wrapper the iframe is appended into
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused | blocked | ended | error
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  const playerRef = useRef(null);
  const creatingRef = useRef(false);
  const aliveRef = useRef(true);
  const loadedKeyRef = useRef(null);
  const ytStateRef = useRef(-1);
  const blockedTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const failedRef = useRef(new Set());
  const orderRef = useRef([]);
  const orderKeyRef = useRef(null);
  const lastQueueKeyRef = useRef(null);
  const loadedQueueRef = useRef(null);
  const lastIndexRef = useRef(0);
  const resumeUsedRef = useRef(new Set());

  // Latest-value mirrors so the player's long-lived event callbacks never
  // close over stale props.
  const itemsRef = useRef(items);
  const wantPlayRef = useRef(wantPlay);
  const loopRef = useRef(loop);
  const volumeRef = useRef(volume);
  const currentIdRef = useRef(currentId);
  const queueKeyRef = useRef(queueKey);
  itemsRef.current = items;
  wantPlayRef.current = wantPlay;
  loopRef.current = loop;
  volumeRef.current = volume;
  currentIdRef.current = currentId;
  queueKeyRef.current = queueKey;

  const idsSig = items.map((i) => i.id).join("|");
  const currentItem = items.find((i) => i.id === currentId) || null;
  const currentVideoId = currentItem ? currentItem.videoId : null;

  const flashNotice = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  /* ---------- which track is "current" ---------- */
  useEffect(() => {
    const ids = itemsRef.current.map((i) => i.id);
    const prev = currentIdRef.current;
    const sameQueue = lastQueueKeyRef.current === queueKey;
    lastQueueKeyRef.current = queueKey;
    if (!sameQueue) failedRef.current = new Set();
    let next;
    if (prev && ids.includes(prev)) {
      next = prev;
    } else if (!ids.length) {
      next = null;
    } else {
      // Picking a track from scratch: prefer where we left off before a
      // reload (once per queue per page load -- consumed in the apply
      // effect below), else the first track. Only if the current track was
      // just deleted from the SAME queue do we stay on the same slot.
      const r = readResume();
      const canResume = r && r.queueKey === queueKey && ids.includes(r.itemId)
        && Date.now() - (r.at || 0) < RESUME_MAX_AGE_MS && !resumeUsedRef.current.has(queueKey);
      if (canResume) next = r.itemId;
      else if (prev && sameQueue) next = ids[Math.min(lastIndexRef.current, ids.length - 1)];
      else next = ids[0];
    }
    if (next !== prev) setCurrentId(next);
  }, [queueKey, idsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const i = itemsRef.current.findIndex((x) => x.id === currentId);
    if (i >= 0) lastIndexRef.current = i;
  }, [currentId]);

  /* ---------- play order (shuffle) ---------- */
  useEffect(() => {
    const ids = itemsRef.current.map((i) => i.id);
    const key = `${queueKey}|${shuffle}`;
    if (orderKeyRef.current !== key || !shuffle) {
      orderRef.current = buildOrder(ids, currentIdRef.current, shuffle);
    } else {
      // Same shuffled queue, tracks added/removed: keep the order the
      // listener has already been hearing, just splice the changes in.
      const kept = orderRef.current.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      orderRef.current = [...kept, ...added];
    }
    orderKeyRef.current = key;
  }, [queueKey, idsSig, shuffle]);

  /* ---------- blocked-autoplay watchdog ---------- */
  const armBlockedWatch = useCallback(() => {
    clearTimeout(blockedTimerRef.current);
    blockedTimerRef.current = setTimeout(() => {
      if (!wantPlayRef.current) return;
      const s = ytStateRef.current;
      if (s === YT_PLAYING || s === YT_BUFFERING) return;
      setStatus((cur) => (cur === "error" ? cur : "blocked"));
    }, BLOCKED_AFTER_MS);
  }, []);

  /* ---------- track finished / failed ---------- */
  const handleEnded = useCallback(() => {
    const cur = currentIdRef.current;
    const nextId = stepOrder(orderRef.current, cur, 1, loopRef.current);
    if (nextId == null) {
      setStatus("ended");
      return;
    }
    if (nextId === cur) {
      // A one-track queue on loop (or a station that just ended): replay it.
      try { playerRef.current.seekTo(0, true); playerRef.current.playVideo(); } catch { /* ignore */ }
      return;
    }
    setCurrentId(nextId);
  }, []);

  const handleError = useCallback((code) => {
    const list = itemsRef.current;
    const cur = currentIdRef.current;
    const msg = ytErrorMessage(code);
    failedRef.current.add(cur);
    const failedItem = list.find((i) => i.id === cur);
    const nextId = (() => {
      let probe = cur;
      for (let n = 0; n < list.length; n++) {
        probe = stepOrder(orderRef.current, probe, 1, true);
        if (probe == null) return null;
        if (!failedRef.current.has(probe)) return probe;
      }
      return null;
    })();
    if (list.length <= 1 || nextId == null) {
      setStatus("error");
      setError(msg);
      return;
    }
    flashNotice(`Skipped “${failedItem?.title || "a track"}” — ${msg}`);
    setCurrentId(nextId);
  }, [flashNotice]);

  /* ---------- create the player (lazily) ---------- */
  useEffect(() => {
    if (!needPlayer || !host || playerRef.current || creatingRef.current) return;
    creatingRef.current = true;
    loadYouTubeApi()
      .then((YT) => {
        if (!aliveRef.current || playerRef.current) return; // (StrictMode re-runs effects: never build two players)
        const mount = document.createElement("div");
        host.appendChild(mount);
        playerRef.current = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              try { playerRef.current.setVolume(volumeRef.current); } catch { /* ignore */ }
              setReady(true);
            },
            onStateChange: (e) => {
              const s = e.data;
              ytStateRef.current = s;
              if (s === YT_PLAYING) {
                clearTimeout(blockedTimerRef.current);
                setError(null);
                setStatus("playing");
              } else if (s === YT_BUFFERING) {
                if (wantPlayRef.current) setStatus((cur) => (cur === "playing" ? cur : "loading"));
              } else if (s === YT_PAUSED) {
                setStatus((cur) => (cur === "error" ? cur : "paused"));
              } else if (s === YT_ENDED) {
                handleEnded();
              }
            },
            onError: (e) => handleError(e.data),
            // Fires when the browser refuses scripted playback (no user
            // gesture yet -- e.g. right after a page reload mid-session).
            onAutoplayBlocked: () => setStatus("blocked"),
          },
        });
      })
      .catch(() => {
        creatingRef.current = false;
        if (!aliveRef.current) return;
        setStatus("error");
        setError("Couldn't load YouTube's player — check your connection.");
      });
  }, [needPlayer, host, retryTick, handleEnded, handleError]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimeout(blockedTimerRef.current);
      clearTimeout(noticeTimerRef.current);
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      creatingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try { playerRef.current.setVolume(volume); } catch { /* ignore */ }
  }, [ready, volume]);

  /* ---------- make the player match (currentItem, wantPlay) ---------- */
  useEffect(() => {
    const p = playerRef.current;
    if (!ready || !p) return;
    const item = itemsRef.current.find((i) => i.id === currentIdRef.current);

    if (!item) {
      loadedKeyRef.current = null;
      try { p.stopVideo(); } catch { /* ignore */ }
      clearTimeout(blockedTimerRef.current);
      setStatus("idle");
      return;
    }

    const key = `${item.id}|${item.videoId}`;
    if (loadedKeyRef.current !== key) {
      loadedKeyRef.current = key;
      loadedQueueRef.current = queueKeyRef.current;
      const args = { videoId: item.videoId };
      const r = readResume();
      if (
        r && r.itemId === item.id && r.queueKey === queueKeyRef.current && !resumeUsedRef.current.has(queueKeyRef.current)
        && !r.live && !item.live && r.time > 5 && Date.now() - (r.at || 0) < RESUME_MAX_AGE_MS
      ) {
        args.startSeconds = Math.floor(r.time);
      }
      resumeUsedRef.current.add(queueKeyRef.current);
      setError(null);
      ytStateRef.current = -1;
      if (wantPlay) {
        setStatus("loading");
        armBlockedWatch();
        try { p.loadVideoById(args); } catch { /* ignore */ }
      } else {
        setStatus("paused");
        try { p.cueVideoById(args); } catch { /* ignore */ }
      }
    } else if (wantPlay) {
      setStatus((cur) => (cur === "playing" || cur === "error" ? cur : "loading"));
      armBlockedWatch();
      try { p.playVideo(); } catch { /* ignore */ }
    } else {
      clearTimeout(blockedTimerRef.current);
      setStatus((cur) => (cur === "playing" || cur === "loading" || cur === "blocked" ? "paused" : cur));
      try { p.pauseVideo(); } catch { /* ignore */ }
    }
  }, [ready, currentId, currentVideoId, wantPlay, retryTick, armBlockedWatch]);

  /* ---------- blocked: any real tap/keypress resumes ---------- */
  // After a reload the browser won't let us start audio until the person
  // interacts with the page once. Instead of silently staying quiet, the
  // very next click/tap/key anywhere resumes the music -- but only if it's
  // still supposed to be playing by then (so tapping "Pause" doesn't
  // blip it on for a split second).
  useEffect(() => {
    if (status !== "blocked") return undefined;
    const kick = () => {
      if (!wantPlayRef.current) return;
      try { playerRef.current?.playVideo(); } catch { /* ignore */ }
      armBlockedWatch();
    };
    window.addEventListener("click", kick);
    window.addEventListener("keydown", kick);
    window.addEventListener("touchend", kick);
    return () => {
      window.removeEventListener("click", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("touchend", kick);
    };
  }, [status, armBlockedWatch]);

  /* ---------- remember where we are, so a reload picks up here ---------- */
  useEffect(() => {
    if (status !== "playing") return undefined;
    const save = () => {
      const p = playerRef.current;
      const key = loadedKeyRef.current;
      if (!p || !key) return;
      try {
        const sep = key.lastIndexOf("|");
        const itemId = key.slice(0, sep);
        const videoId = key.slice(sep + 1);
        const vd = typeof p.getVideoData === "function" ? p.getVideoData() : null;
        // Never record a position for a video the player isn't actually on
        // (e.g. mid track-change, when getCurrentTime() still belongs to the
        // previous video).
        if (vd && vd.video_id && vd.video_id !== videoId) return;
        const dur = p.getDuration();
        const live = !!(vd && vd.isLive) || dur === 0;
        let time = p.getCurrentTime();
        if (!live && dur > 0 && time >= dur - 3) time = 0; // basically finished: restart it next time
        writeResume({ queueKey: loadedQueueRef.current, itemId, time, live, at: Date.now() });
      } catch { /* ignore */ }
    };
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    save(); // record the track right away, not only after the first 5s
    const id = setInterval(save, 5000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [status]);

  /* ---------- controls ---------- */
  const step = useCallback((dir) => {
    const nextId = stepOrder(orderRef.current, currentIdRef.current, dir, true);
    if (nextId == null) return;
    failedRef.current.delete(nextId);
    if (nextId === currentIdRef.current) {
      try { playerRef.current?.seekTo(0, true); } catch { /* ignore */ }
      return;
    }
    setCurrentId(nextId);
  }, []);

  const playItem = useCallback((id) => {
    failedRef.current.delete(id);
    if (id === currentIdRef.current) {
      try { playerRef.current?.seekTo(0, true); } catch { /* ignore */ }
      return;
    }
    setCurrentId(id);
  }, []);

  const resume = useCallback(() => {
    try { playerRef.current?.playVideo(); } catch { /* ignore */ }
    if (wantPlayRef.current) { armBlockedWatch(); setStatus((cur) => (cur === "playing" ? cur : "loading")); }
  }, [armBlockedWatch]);

  const retry = useCallback(() => {
    failedRef.current = new Set();
    loadedKeyRef.current = null;
    creatingRef.current = false;
    setError(null);
    setStatus("idle");
    setRetryTick((t) => t + 1);
  }, []);

  return {
    attachHost: setHost,
    status,
    error,
    notice,
    currentId,
    currentItem,
    next: useCallback(() => step(1), [step]),
    prev: useCallback(() => step(-1), [step]),
    playItem,
    resume,
    retry,
  };
}
