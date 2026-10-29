import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeviceRow, useRealtimeTable } from "./useRealtimeTable";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { useFocusPlayer } from "./useFocusPlayer";
import {
  RADIO_OPTIONS, MAX_PLAYLISTS, MAX_TRACKS_PER_PLAYLIST, MAX_PLAYLIST_NAME,
  extractYouTubeId, isPlaylistOnlyLink, fetchVideoMeta,
} from "../lib/radio";

// Everything Focus Music: settings (Supabase row + localStorage cache),
// the user's playlists/tracks (Supabase), and the player engine. Mounted
// ONCE at the app root (like useFocusTimer) so music keeps going across
// page navigation.
//
// Rule that fixes the "plays as soon as I open the app" bug: audio is only
// wanted while the timer is running (and music is switched on), plus an
// explicit, temporary user override (preview / pause-from-mini-bar) that
// is tied to the timer state it was made in.

const LS_KEY = "sb.focusMusic.v1";
const LEGACY_TIMER_KEY = "sb.focusTimer.v1";
const LEGACY_DONE_KEY = "sb.focusMusic.legacyDone";

const DEFAULTS = {
  enabled: false,
  source: "stations", // "stations" | "own"
  stationId: RADIO_OPTIONS[0].id,
  playlistId: null,
  volume: 70,
  shuffle: false,
  loop: true,
};

// Full row -- only used to CREATE the account's row the first time. The
// playlist is left null there: it might be a stale local id, and the column
// is a foreign key.
const toRow = (s) => ({
  enabled: s.enabled,
  source: s.source,
  station_id: s.stationId,
  playlist_id: null,
  volume: s.volume,
  shuffle: s.shuffle,
  loop_playlist: s.loop,
});

const ROW_KEY = {
  enabled: "enabled", source: "source", stationId: "station_id", playlistId: "playlist_id",
  volume: "volume", shuffle: "shuffle", loop: "loop_playlist",
};

// Saves send ONLY the columns that changed. Re-sending the whole row would
// also re-send a stale playlist_id (e.g. one deleted on another device), and
// the foreign key would reject the entire update -- silently losing the
// change the person actually made.
const toRowPatch = (patch) => {
  const out = {};
  Object.keys(patch).forEach((k) => { if (ROW_KEY[k]) out[ROW_KEY[k]] = patch[k]; });
  return out;
};

const fromRow = (r) => ({
  enabled: !!r.enabled,
  source: r.source === "own" ? "own" : "stations",
  stationId: RADIO_OPTIONS.some((o) => o.id === r.station_id) ? r.station_id : DEFAULTS.stationId,
  playlistId: r.playlist_id || null,
  volume: Number.isFinite(r.volume) ? Math.min(100, Math.max(0, r.volume)) : DEFAULTS.volume,
  shuffle: !!r.shuffle,
  loop: r.loop_playlist !== false,
});

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// People who used the old single "Custom link" radio carry that choice in
// the timer's own localStorage blob. Carry it over instead of silently
// dropping it: a chosen station stays chosen, a custom link becomes the
// first track of a playlist (see the migration effect below).
function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_TIMER_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || !t.radioChoice || t.radioChoice === "none") return null;
    if (t.radioChoice === "custom") {
      const id = extractYouTubeId(t.radioCustomUrl);
      return id ? { kind: "link", videoId: id } : null;
    }
    return RADIO_OPTIONS.some((o) => o.id === t.radioChoice) ? { kind: "station", stationId: t.radioChoice } : null;
  } catch {
    return null;
  }
}

function initialSettings() {
  const local = readLocal();
  if (local) return { ...DEFAULTS, ...local };
  const legacy = readLegacy();
  if (legacy?.kind === "station") return { ...DEFAULTS, enabled: true, stationId: legacy.stationId };
  if (legacy?.kind === "link") return { ...DEFAULTS, enabled: true, source: "own" };
  return { ...DEFAULTS };
}

export function useFocusMusic({ timerRunning, page }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Data only needs to be live on the timer page or while a session is
  // running (a reload mid-session can happen on any page). Like every other
  // page-scoped query in the app, the last snapshot stays in memory.
  const dataEnabled = page === "timer" || !!timerRunning;

  const settingsRow = useDeviceRow("focus_music_settings", toRow(settings), { enabled: dataEnabled });
  const playlistsQ = useRealtimeTable("focus_playlists", { orderBy: "sort_order", ascending: true, enabled: dataEnabled });
  const tracksQ = useRealtimeTable("focus_playlist_tracks", { orderBy: "sort_order", ascending: true, enabled: dataEnabled });

  /* ---------- settings: local first, Supabase follows ---------- */
  const hydratedRef = useRef(false);
  const pendingRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const saveRow = settingsRow.save;
  const rowLoaded = !!settingsRow.row;

  useEffect(() => {
    if (!settingsRow.row || hydratedRef.current) return;
    hydratedRef.current = true;
    // The account's saved choice wins on first load, so a new device picks
    // up where the last one left off -- except for anything the person
    // changed here before the row had finished loading.
    const pending = pendingRef.current;
    pendingRef.current = null;
    const next = { ...fromRow(settingsRow.row), ...(pending || {}) };
    setSettings(next);
    writeLocal(next);
    if (pending) saveRow(toRowPatch(pending));
  }, [settingsRow.row, saveRow]);

  const persist = useCallback((patch, { debounce = false } = {}) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    writeLocal(next);
    const flush = () => {
      if (!hydratedRef.current) {
        pendingRef.current = { ...(pendingRef.current || {}), ...patch };
        return;
      }
      saveRow(toRowPatch(patch));
    };
    if (debounce) {
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = setTimeout(flush, 500);
    } else {
      flush();
    }
  }, [saveRow]);

  useEffect(() => () => clearTimeout(volumeTimerRef.current), []);

  /* ---------- playlists / tracks ---------- */
  const playlists = useMemo(() => {
    const byPl = {};
    tracksQ.rows.forEach((t) => { (byPl[t.playlist_id] ||= []).push(t); });
    const bySort = (a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(String(b.created_at));
    return playlistsQ.rows
      .slice()
      .sort(bySort)
      .map((p) => ({ ...p, tracks: (byPl[p.id] || []).slice().sort(bySort) }));
  }, [playlistsQ.rows, tracksQ.rows]);

  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;

  const activePlaylist = useMemo(() => {
    if (!playlists.length) return null;
    return playlists.find((p) => p.id === settings.playlistId) || playlists[0];
  }, [playlists, settings.playlistId]);

  const createPlaylist = useCallback(async (rawName) => {
    const name = String(rawName || "").trim().slice(0, MAX_PLAYLIST_NAME);
    if (!name) return { ok: false, error: "Give the playlist a name first." };
    const list = playlistsRef.current;
    if (list.length >= MAX_PLAYLISTS) return { ok: false, error: `You can have up to ${MAX_PLAYLISTS} playlists.` };
    if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "You already have a playlist with that name." };
    const sort_order = list.reduce((m, p) => Math.max(m, p.sort_order || 0), 0) + 1;
    const row = await playlistsQ.insert({ name, sort_order });
    if (!row) return { ok: false, error: "Couldn't create the playlist — check your connection and try again." };
    persist({ source: "own", playlistId: row.id });
    return { ok: true, playlist: row };
  }, [playlistsQ, persist]);

  const renamePlaylist = useCallback(async (id, rawName) => {
    const name = String(rawName || "").trim().slice(0, MAX_PLAYLIST_NAME);
    if (!name) return { ok: false, error: "A playlist needs a name." };
    if (playlistsRef.current.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "You already have a playlist with that name." };
    }
    const row = await playlistsQ.update(id, { name });
    return row ? { ok: true } : { ok: false, error: "Couldn't rename it — try again." };
  }, [playlistsQ]);

  const deletePlaylist = useCallback(async (id) => {
    const ok = await playlistsQ.remove(id);
    if (!ok) return { ok: false, error: "Couldn't delete it — try again." };
    tracksQ.setRows((prev) => prev.filter((t) => t.playlist_id !== id));
    if (settingsRef.current.playlistId === id) persist({ playlistId: null });
    return { ok: true };
  }, [playlistsQ, tracksQ, persist]);

  // `fresh: true` = the playlist was created a moment ago and React may not
  // have re-rendered with it yet, so it's known to be empty.
  const addTrack = useCallback(async (playlistId, rawLink, { fresh = false } = {}) => {
    const pl = playlistsRef.current.find((p) => p.id === playlistId) || (fresh ? { id: playlistId, tracks: [] } : null);
    if (!pl) return { ok: false, error: "Pick a playlist first." };
    const videoId = extractYouTubeId(rawLink);
    if (!videoId) {
      return {
        ok: false,
        error: isPlaylistOnlyLink(rawLink)
          ? "That's a whole-playlist link — paste the link of a single video from it instead."
          : "Couldn't read a video from that link — copy it from YouTube's address bar or Share button.",
      };
    }
    if (pl.tracks.length >= MAX_TRACKS_PER_PLAYLIST) return { ok: false, error: `A playlist can hold up to ${MAX_TRACKS_PER_PLAYLIST} tracks.` };
    if (pl.tracks.some((t) => t.video_id === videoId)) return { ok: false, error: "That video is already in this playlist." };
    const meta = await fetchVideoMeta(videoId);
    if (!meta.ok) {
      return {
        ok: false,
        error: meta.reason === "unembeddable"
          ? "The owner doesn't allow this video to play outside YouTube — try another one."
          : "YouTube couldn't find that video (it may be private or removed).",
      };
    }
    // Re-read: another add may have landed while we were awaiting oEmbed.
    const current = playlistsRef.current.find((p) => p.id === playlistId) || (fresh ? { tracks: [] } : null);
    if (!current) return { ok: false, error: "That playlist no longer exists." };
    const sort_order = current.tracks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0) + 1;
    const row = await tracksQ.insert({
      playlist_id: playlistId,
      video_id: videoId,
      title: meta.title,
      author: meta.author,
      sort_order,
    });
    if (!row) return { ok: false, error: "Couldn't save the track — check your connection and try again." };
    return { ok: true, track: row };
  }, [tracksQ]);

  const removeTrack = useCallback((id) => tracksQ.remove(id), [tracksQ]);

  // Renumbers the whole playlist 1..n after the swap so order can never
  // get stuck when two tracks happen to share a sort_order.
  const moveTrack = useCallback(async (playlistId, trackId, dir) => {
    const pl = playlistsRef.current.find((p) => p.id === playlistId);
    if (!pl) return;
    const i = pl.tracks.findIndex((t) => t.id === trackId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= pl.tracks.length) return;
    const ordered = pl.tracks.slice();
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const changes = [];
    ordered.forEach((t, idx) => { if (t.sort_order !== idx + 1) changes.push([t.id, idx + 1]); });
    tracksQ.setRows((prev) => prev.map((t) => {
      const c = changes.find(([id]) => id === t.id);
      return c ? { ...t, sort_order: c[1] } : t;
    }));
    const results = await Promise.all(changes.map(([id, n]) => tracksQ.update(id, { sort_order: n })));
    if (results.some((r) => !r)) tracksQ.refetch();
  }, [tracksQ]);

  /* ---------- legacy "Custom link" -> first playlist (one time) ---------- */
  const migratingRef = useRef(false);
  useEffect(() => {
    if (!userId || !dataEnabled) return undefined;
    let done = false;
    try { done = localStorage.getItem(LEGACY_DONE_KEY) === "1"; } catch { /* ignore */ }
    if (done) return undefined;
    const legacy = readLegacy();
    const markDone = () => { try { localStorage.setItem(LEGACY_DONE_KEY, "1"); } catch { /* ignore */ } };
    if (!legacy || legacy.kind !== "link") { markDone(); return undefined; }
    if (migratingRef.current) return undefined;
    migratingRef.current = true;
    (async () => {
      try {
        // Authoritative check against the DB (the hook's rows may not have
        // loaded yet): only seed if the account has no playlists at all.
        const { data, error } = await supabase.from("focus_playlists").select("id").eq("user_id", userId).limit(1);
        if (error) return; // try again next time
        if (data && data.length) { markDone(); return; }
        // Past this point it always runs to completion (even if the person
        // navigates away meanwhile) so we never leave an empty playlist.
        const made = await createPlaylist("My music");
        if (!made.ok) return;
        const added = await addTrack(made.playlist.id, legacy.videoId, { fresh: true });
        if (added.ok) markDone();
      } finally {
        migratingRef.current = false;
      }
    })();
    return undefined;
  }, [userId, dataEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- the queue the engine plays ---------- */
  const queue = useMemo(() => {
    if (settings.source === "own") {
      if (!activePlaylist) return { key: "own:none", items: [] };
      return {
        key: `own:${activePlaylist.id}`,
        items: activePlaylist.tracks.map((t) => ({
          id: t.id, videoId: t.video_id, title: t.title || "YouTube video", author: t.author || "", live: false,
        })),
      };
    }
    const st = RADIO_OPTIONS.find((o) => o.id === settings.stationId);
    if (!st) return { key: "station:none", items: [] };
    return {
      key: `station:${st.id}`,
      items: [{ id: st.id, videoId: st.videoId, title: st.label, author: st.hint, live: true }],
    };
  }, [settings.source, settings.stationId, activePlaylist]);

  /* ---------- when should it actually make sound? ---------- */
  // Temporary explicit override, valid only for the timer state it was made
  // in (so "pause music" while running lapses when the timer pauses/
  // restarts, and a settings preview lapses when the timer starts).
  const [override, setOverride] = useState(null); // { value: "play" | "pause", forRunning: bool }
  const activeOverride = override && override.forRunning === !!timerRunning ? override.value : null;
  // An override belongs to ONE run/pause state. Without this, "pause music"
  // while running would silently come back to life the next time the timer
  // started (forRunning matches again), leaving the music muted for good.
  useEffect(() => { setOverride(null); }, [timerRunning]);
  const wantPlay = activeOverride === "play" ? true
    : activeOverride === "pause" ? false
    : settings.enabled && !!timerRunning;

  // The Sound settings preview slot (a DOM node) -- while it exists the
  // one real player is drawn inside it (see FocusMusicStage).
  const [slotEl, setSlotEl] = useState(null);
  useEffect(() => {
    // Closing settings ends a preview that was only ever a preview.
    if (!slotEl) setOverride((o) => (o && o.value === "play" && !o.forRunning ? null : o));
  }, [slotEl]);

  const needPlayer = queue.items.length > 0 && (wantPlay || !!slotEl);

  const player = useFocusPlayer({
    queueKey: queue.key,
    items: queue.items,
    wantPlay,
    needPlayer,
    volume: settings.volume,
    shuffle: settings.shuffle,
    loop: settings.loop,
  });

  const audible = player.status === "playing";

  // Clicking a specific track in the list: jump to it, and if nothing is
  // supposed to be playing right now, start a (settings-only) preview of it.
  const playTrack = useCallback((id) => {
    if (!wantPlay) setOverride({ value: "play", forRunning: !!timerRunning });
    player.playItem(id);
  }, [wantPlay, player, timerRunning]);

  const togglePlay = useCallback(() => {
    if (wantPlay && (player.status === "playing" || player.status === "loading")) {
      setOverride({ value: "pause", forRunning: !!timerRunning });
    } else {
      setOverride({ value: "play", forRunning: !!timerRunning });
      player.resume();
    }
  }, [wantPlay, player, timerRunning]);

  const setEnabled = useCallback((enabled) => persist({ enabled }), [persist]);
  const setSource = useCallback((source) => {
    const patch = { source };
    if (source === "own" && !playlistsRef.current.some((p) => p.id === settingsRef.current.playlistId) && playlistsRef.current[0]) {
      patch.playlistId = playlistsRef.current[0].id;
    }
    persist(patch);
  }, [persist]);
  const setStation = useCallback((stationId) => persist({ source: "stations", stationId }), [persist]);
  const selectPlaylist = useCallback((playlistId) => persist({ source: "own", playlistId }), [persist]);
  const setVolume = useCallback((volume) => persist({ volume: Math.round(volume) }, { debounce: true }), [persist]);
  const setShuffle = useCallback((shuffle) => persist({ shuffle }), [persist]);
  const setLoop = useCallback((loop) => persist({ loop }), [persist]);

  return {
    // settings
    ...settings,
    activePlaylistId: activePlaylist ? activePlaylist.id : null,
    setEnabled, setSource, setStation, selectPlaylist, setVolume, setShuffle, setLoop,
    // data
    playlists, rowLoaded,
    dataLoading: playlistsQ.loading || tracksQ.loading,
    stations: RADIO_OPTIONS,
    createPlaylist, renamePlaylist, deletePlaylist, addTrack, removeTrack, moveTrack,
    // playback
    queueItems: queue.items,
    hasQueue: queue.items.length > 0,
    wantPlay, audible,
    status: player.status, error: player.error, notice: player.notice,
    currentId: player.currentId, currentItem: player.currentItem,
    togglePlay, playTrack, next: player.next, prev: player.prev, retry: player.retry,
    // player hosting (used by FocusMusicStage + the settings preview slot)
    attachHost: player.attachHost,
    slotEl, setSlotEl,
  };
}
