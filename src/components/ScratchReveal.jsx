import React, { useRef, useState, useCallback } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { Confetti } from "./ui";

/*
 * A little scratch-card easter egg for the "reach out to me" FAQ answer.
 * The email is never rendered as plain text until someone actually scratches
 * it clear — kept as char codes (not a literal string) so it doesn't show up
 * in a quick source/bundle text-search either, only after this component
 * decodes and reveals it through real interaction.
 */
const EMAIL_CODES = [112, 111, 109, 101, 103, 114, 97, 110, 97, 116, 101, 108, 101, 97, 115, 116, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109];
function decodeEmail() {
  return String.fromCharCode(...EMAIL_CODES);
}

export default function ScratchReveal() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const moveCount = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [copied, setCopied] = useState(false);

  const initCanvas = useCallback((node) => {
    canvasRef.current = node;
    if (!node) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = node.getBoundingClientRect();
    const w = Math.max(rect.width, 1), h = Math.max(rect.height, 1);
    node.width = w * dpr;
    node.height = h * dpr;
    const ctx = node.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#F3C4D4";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.55;
    ctx.font = "11px sans-serif";
    for (let y = 12, row = 0; y < h; y += 18, row++) {
      for (let x = row % 2 === 0 ? 6 : 18; x < w; x += 26) ctx.fillText("🐾", x, y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#6B3F5C";
    ctx.font = "700 11px 'Nunito', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("scratch to reveal ✨", w / 2, h / 2 + 4);
  }, []);

  const scratchAt = (clientX, clientY) => {
    const node = canvasRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const ctx = node.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, 20, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkProgress = () => {
    const node = canvasRef.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    const { width, height } = node;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * 41) {
      total++;
      if (data[i] < 40) cleared++;
    }
    if (total && cleared / total > 0.45) {
      setRevealed(true);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1500);
    }
  };

  const handleMove = (e) => {
    if (!drawing.current || revealed) return;
    const point = e.touches ? e.touches[0] : e;
    scratchAt(point.clientX, point.clientY);
    moveCount.current += 1;
    if (moveCount.current % 3 === 0) checkProgress();
    if (e.touches) e.preventDefault();
  };
  const start = (e) => { drawing.current = true; handleMove(e); };
  const stop = () => { drawing.current = false; };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(decodeEmail());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable — silently ignore */ }
  };

  return (
    <div className={`sb-scratch-wrap${revealed ? " revealed" : ""}`}>
      <div className="sb-scratch-content">
        <Mail size={13} />
        {revealed ? (
          <button type="button" className="sb-scratch-email" onClick={copyEmail} title="Tap to copy">
            {decodeEmail()} {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        ) : (
          <span className="sb-scratch-placeholder">•••••••••••••••••••••</span>
        )}
      </div>
      {!revealed && (
        <canvas
          ref={initCanvas}
          className="sb-scratch-canvas"
          onMouseDown={start} onMouseMove={handleMove} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={handleMove} onTouchEnd={stop}
        />
      )}
      {celebrate && <Confetti type="petals" theme={{ emoji: "💌" }} />}
    </div>
  );
}
