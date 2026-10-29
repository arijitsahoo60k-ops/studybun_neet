import React, { useState } from "react";
import {
  Headphones, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Trash2, Pencil, Plus,
  ChevronUp, ChevronDown, Check, X, Volume2, VolumeX, ExternalLink, AlertTriangle, ListMusic,
  Radio, Loader2,
} from "lucide-react";
import { Btn } from "./ui";
import { RADIO_LINKS, MAX_PLAYLISTS, MAX_TRACKS_PER_PLAYLIST, MAX_PLAYLIST_NAME, thumbUrl } from "../lib/radio";

function Eq({ on }) {
  return <span className={`sb-music-eq ${on ? "on" : ""}`} aria-hidden="true"><i /><i /><i /></span>;
}

function statusLine(m, timerRunning) {
  if (m.error) return { text: m.error, err: true };
  if (m.status === "blocked" && m.wantPlay) return { text: "Your browser is holding the audio — tap play (or anywhere) to start.", err: false };
  if (m.audible) return { text: "Playing", err: false };
  if (m.status === "loading" && m.wantPlay) return { text: "Loading…", err: false };
  if (m.status === "ended") return { text: "Playlist finished — turn on Loop to keep it going.", err: false };
  if (!m.hasQueue) return { text: "Nothing to play yet.", err: false };
  if (m.enabled && !timerRunning) return { text: "Ready — starts when you start the timer.", err: false };
  if (!m.enabled) return { text: "Music is off for sessions. Use play to preview.", err: false };
  return { text: "Paused", err: false };
}

/* ------------------------------------------------------------------ */
/* Sound section of the Timer Settings dialog                          */
/* ------------------------------------------------------------------ */

export default function FocusMusicSettings({ music, timerRunning }) {
  if (!music) return null;
  return <SettingsBody m={music} timerRunning={!!timerRunning} />;
}

function SettingsBody({ m, timerRunning }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [plError, setPlError] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const pl = m.playlists.find((p) => p.id === m.activePlaylistId) || null;
  const item = m.currentItem;
  const line = statusLine(m, timerRunning);
  const playing = m.wantPlay && (m.status === "playing" || m.status === "loading");
  const playTitle = timerRunning
    ? (playing ? "Pause music" : "Play music")
    : (playing ? "Stop preview" : "Preview (stops when you close settings)");
  const multi = m.queueItems.length > 1;

  const submitNew = async () => {
    setPlError(null);
    const res = await m.createPlaylist(newName);
    if (!res.ok) { setPlError(res.error); return; }
    setNewName("");
    setCreating(false);
  };

  const submitRename = async () => {
    setPlError(null);
    const res = await m.renamePlaylist(pl.id, renameDraft);
    if (!res.ok) { setPlError(res.error); return; }
    setRenaming(false);
  };

  const doDelete = async () => {
    setPlError(null);
    const res = await m.deletePlaylist(pl.id);
    setConfirmDelete(false);
    if (!res.ok) setPlError(res.error);
  };

  const submitLink = async () => {
    if (!linkDraft.trim() || adding) return;
    setLinkError(null);
    setAdding(true);
    const res = await m.addTrack(pl.id, linkDraft);
    setAdding(false);
    if (!res.ok) { setLinkError(res.error); return; }
    setLinkDraft("");
  };

  return (
    <section className="sb-music" aria-label="Focus music">
      <div className="sb-music-head">
        <span className="sb-timer-settings-label"><Headphones size={16} /> Focus music</span>
        <button
          className={`sb-sound-toggle ${m.enabled ? "on" : ""}`}
          onClick={() => m.setEnabled(!m.enabled)}
          aria-pressed={m.enabled}
          title={m.enabled ? "Music plays while your timer runs" : "Music is off"}
        >
          {m.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>{m.enabled ? "On" : "Off"}</span>
        </button>
      </div>
      <p className="sb-music-hint">
        {m.enabled
          ? "Starts when you hit Start, pauses when you pause, and picks back up after a reload."
          : "Turn on to have music play during focus sessions. It never plays on its own."}
      </p>

      {/* live preview of whatever is selected */}
      <div
        className={`sb-music-preview ${m.audible ? "" : "dim"}`}
        ref={m.setSlotEl}
        style={item ? { backgroundImage: `url(${thumbUrl(item.videoId)})` } : undefined}
      >
        {!item && <span>{m.source === "own" ? "Add a track below to see it here" : "Pick a station"}</span>}
      </div>

      <div className="sb-music-now">
        <Eq on={m.audible} />
        <div className="sb-music-now-text">
          <span className="sb-music-now-title">{item ? item.title : "Nothing selected"}</span>
          <span className="sb-music-now-sub">{item && item.author ? item.author : "\u00A0"}</span>
        </div>
        <div className="sb-music-ctrls">
          <button className="sb-music-ico" onClick={m.prev} disabled={!multi} aria-label="Previous track" title="Previous"><SkipBack size={15} /></button>
          <button className="sb-music-ico primary" onClick={m.togglePlay} disabled={!m.hasQueue} aria-label={playTitle} title={playTitle}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button className="sb-music-ico" onClick={m.next} disabled={!multi} aria-label="Next track" title="Next"><SkipForward size={15} /></button>
        </div>
      </div>

      <p className={`sb-music-note ${line.err ? "err" : ""}`}>
        {line.err && <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
        <span>{line.text}{line.err && <Btn variant="ghost" onClick={m.retry}>Try again</Btn>}</span>
      </p>
      {m.notice && <p className="sb-music-note"><AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {m.notice}</p>}

      <label className="sb-music-volume">
        {m.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        <input
          type="range" min={0} max={100} step={1} value={m.volume}
          onChange={(e) => m.setVolume(Number(e.target.value))}
          aria-label="Music volume"
        />
        <span>{m.volume}%</span>
      </label>

      {/* Stations | My music */}
      <div className="sb-music-pill" role="tablist" aria-label="Music source" data-active={m.source}>
        <span className="sb-music-pill-thumb" aria-hidden="true" />
        <button role="tab" aria-selected={m.source === "stations"} onClick={() => m.setSource("stations")}>
          <Radio size={15} /> Stations
        </button>
        <button role="tab" aria-selected={m.source === "own"} onClick={() => m.setSource("own")}>
          <ListMusic size={15} /> My music
        </button>
      </div>

      {m.source === "stations" ? (
        <div className="sb-music-panel" role="tabpanel">
          <div className="sb-music-chips">
            {m.stations.map((s) => (
              <button key={s.id} className={`sb-radio-chip ${m.stationId === s.id ? "active" : ""}`} onClick={() => m.setStation(s.id)}>
                <span>{s.label}<span className="sb-music-chip-sub">{s.hint}</span></span>
              </button>
            ))}
          </div>
          <p className="sb-radio-hint" style={{ textAlign: "left" }}>
            Stations are 24/7 live streams. If one ever shows unavailable, the stream itself has ended — switch to My music and add your own.
          </p>
          <div className="sb-radio-links">
            {RADIO_LINKS.map((l) => (
              <a key={l.label} className="sb-radio-link" target="_blank" rel="noopener noreferrer"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(l.query)}`}>
                {l.label} <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="sb-music-panel" role="tabpanel">
          {m.dataLoading && !m.playlists.length ? (
            <p className="sb-radio-hint">Loading your playlists…</p>
          ) : (
            <>
              {m.playlists.length > 0 && (
                <div className="sb-music-chips">
                  {m.playlists.map((p) => (
                    <button
                      key={p.id}
                      className={`sb-radio-chip ${pl && pl.id === p.id ? "active" : ""}`}
                      onClick={() => { setRenaming(false); setConfirmDelete(false); setLinkError(null); setPlError(null); m.selectPlaylist(p.id); }}
                    >
                      {p.name} <span style={{ opacity: 0.75 }}>· {p.tracks.length}</span>
                    </button>
                  ))}
                  {m.playlists.length < MAX_PLAYLISTS && !creating && (
                    <button className="sb-radio-chip sb-music-chip-add" onClick={() => { setCreating(true); setPlError(null); }}>
                      <Plus size={14} /> New playlist
                    </button>
                  )}
                </div>
              )}

              {creating && (
                <div className="sb-music-inline-form">
                  <input
                    className="sb-input" autoFocus placeholder="Playlist name (e.g. Deep focus)"
                    maxLength={MAX_PLAYLIST_NAME} value={newName}
                    onChange={(e) => { setNewName(e.target.value); setPlError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") setCreating(false); }}
                  />
                  <Btn variant="soft" onClick={submitNew}><Check size={14} /> Create</Btn>
                  <button className="sb-music-ico small" aria-label="Cancel" onClick={() => { setCreating(false); setNewName(""); setPlError(null); }}><X size={13} /></button>
                </div>
              )}

              {!m.playlists.length && !creating && (
                <div className="sb-music-empty">
                  <ListMusic size={22} />
                  <span>No playlists yet. Make one and drop in any YouTube videos — they'll play one after another while you focus.</span>
                  <Btn onClick={() => { setCreating(true); setPlError(null); }}><Plus size={14} /> Create a playlist</Btn>
                </div>
              )}

              {plError && <p className="sb-radio-error"><AlertTriangle size={14} /> {plError}</p>}

              {pl && (
                <div className="sb-music-plcard">
                  <div className="sb-music-plhead">
                    {renaming ? (
                      <>
                        <input
                          className="sb-input" autoFocus maxLength={MAX_PLAYLIST_NAME} value={renameDraft}
                          onChange={(e) => { setRenameDraft(e.target.value); setPlError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
                          style={{ flex: 1, minWidth: 0, fontSize: 14, padding: "8px 10px" }}
                        />
                        <button className="sb-music-ico small" aria-label="Save name" onClick={submitRename}><Check size={13} /></button>
                        <button className="sb-music-ico small" aria-label="Cancel rename" onClick={() => setRenaming(false)}><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <span className="sb-music-plname">{pl.name}</span>
                        <button className="sb-music-ico small" aria-label="Rename playlist" title="Rename" onClick={() => { setRenameDraft(pl.name); setRenaming(true); setConfirmDelete(false); }}><Pencil size={12} /></button>
                        <button className="sb-music-ico small danger" aria-label="Delete playlist" title="Delete playlist" onClick={() => setConfirmDelete(true)}><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>

                  {confirmDelete && (
                    <div className="sb-music-confirm">
                      Delete “{pl.name}” and its {pl.tracks.length} track{pl.tracks.length === 1 ? "" : "s"}?
                      <Btn variant="soft" onClick={doDelete}><Trash2 size={13} /> Delete</Btn>
                      <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Btn>
                    </div>
                  )}

                  <div className="sb-music-plopts">
                    <button className={`sb-sound-toggle ${m.shuffle ? "on" : ""}`} aria-pressed={m.shuffle} onClick={() => m.setShuffle(!m.shuffle)}>
                      <Shuffle size={15} /> Shuffle
                    </button>
                    <button className={`sb-sound-toggle ${m.loop ? "on" : ""}`} aria-pressed={m.loop} onClick={() => m.setLoop(!m.loop)}>
                      <Repeat size={15} /> Loop
                    </button>
                  </div>

                  {pl.tracks.length === 0 ? (
                    <p className="sb-radio-hint" style={{ textAlign: "left" }}>Empty for now — paste a YouTube link below to add the first track.</p>
                  ) : (
                    <ul className="sb-music-tracks">
                      {pl.tracks.map((t, i) => {
                        const isCurrent = m.currentId === t.id;
                        return (
                          <li key={t.id} className={`sb-music-track ${isCurrent ? "current" : ""}`}>
                            <button className="sb-music-track-main" onClick={() => m.playTrack(t.id)} title="Play this track">
                              <img src={thumbUrl(t.video_id)} alt="" loading="lazy" />
                              <span className="sb-music-track-text">
                                <span className="sb-music-track-title">{t.title || "YouTube video"}</span>
                                <span className="sb-music-track-author">{t.author || "YouTube"}</span>
                              </span>
                              {isCurrent && <Eq on={m.audible} />}
                            </button>
                            <span className="sb-music-track-actions">
                              <button className="sb-music-ico small" aria-label="Move up" disabled={i === 0} onClick={() => m.moveTrack(pl.id, t.id, -1)}><ChevronUp size={13} /></button>
                              <button className="sb-music-ico small" aria-label="Move down" disabled={i === pl.tracks.length - 1} onClick={() => m.moveTrack(pl.id, t.id, 1)}><ChevronDown size={13} /></button>
                              <button className="sb-music-ico small danger" aria-label={`Remove ${t.title || "track"}`} onClick={() => m.removeTrack(t.id)}><Trash2 size={12} /></button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="sb-music-inline-form">
                    <input
                      className="sb-input" placeholder="Paste a YouTube video or live link…"
                      value={linkDraft} disabled={adding || pl.tracks.length >= MAX_TRACKS_PER_PLAYLIST}
                      onChange={(e) => { setLinkDraft(e.target.value); setLinkError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") submitLink(); }}
                    />
                    <Btn variant="soft" onClick={submitLink} disabled={adding || !linkDraft.trim()}>
                      {adding ? <Loader2 size={14} className="sb-spin" /> : <Plus size={14} />} {adding ? "Adding" : "Add"}
                    </Btn>
                  </div>
                  {linkError && <p className="sb-radio-error"><AlertTriangle size={14} /> {linkError}</p>}
                  <p className="sb-radio-hint" style={{ textAlign: "left" }}>
                    {pl.tracks.length}/{MAX_TRACKS_PER_PLAYLIST} tracks · saved to your account, so they follow you to every device.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Little now-playing bar under the timer controls                     */
/* ------------------------------------------------------------------ */

export function FocusMusicMiniBar({ music, running, onOpenSettings }) {
  if (!music) return null;
  const m = music;

  // Music is off entirely -- don't spend a row nagging the user to set it
  // up; just render nothing so the layout reclaims that space, same as
  // before focus music existed. It reappears the moment they turn it on.
  if (!m.enabled) return null;
  if (!m.hasQueue) {
    return (
      <div className="sb-music-mini">
        <Headphones size={14} />
        <span className="sb-music-mini-muted">Music is on but nothing's picked —</span>
        <button className="sb-music-mini-link" onClick={onOpenSettings}>choose a station or playlist</button>
      </div>
    );
  }

  const title = m.currentItem ? m.currentItem.title : "";

  if (m.error) {
    return (
      <div className="sb-music-mini">
        <AlertTriangle size={14} color="#d1495b" />
        <span className="sb-music-mini-title" style={{ color: "#d1495b" }} title={m.error}>{m.error}</span>
        <button className="sb-music-mini-link" onClick={m.retry}>Retry</button>
        <button className="sb-music-mini-link" onClick={onOpenSettings}>Change</button>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="sb-music-mini">
        <Headphones size={14} />
        <span className="sb-music-mini-title" title={title}>{title}</span>
        <span className="sb-music-mini-muted">· plays when you start</span>
        <button className="sb-music-mini-link" onClick={onOpenSettings}>Change</button>
      </div>
    );
  }

  const blocked = m.status === "blocked" && m.wantPlay;
  const playing = m.wantPlay && (m.status === "playing" || m.status === "loading");
  const multi = m.queueItems.length > 1;
  return (
    <div className="sb-music-mini">
      {blocked ? (
        <button className="sb-music-mini-cta" onClick={m.togglePlay}>🔊 Tap to start music</button>
      ) : (
        <>
          <Eq on={m.audible} />
          <span className="sb-music-mini-title" title={title}>{title}</span>
          <span className="sb-music-ctrls">
            {multi && <button className="sb-music-ico small" onClick={m.prev} aria-label="Previous track"><SkipBack size={12} /></button>}
            <button className="sb-music-ico small" onClick={m.togglePlay} aria-label={playing ? "Pause music" : "Play music"}>
              {playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
            {multi && <button className="sb-music-ico small" onClick={m.next} aria-label="Next track"><SkipForward size={12} /></button>}
          </span>
        </>
      )}
    </div>
  );
}
