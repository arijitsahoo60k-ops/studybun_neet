import React from "react";
import { Lock, Ban, Download } from "lucide-react";

export default function DataNote() {
  return (
    <div className="sb-info-note">
      <span className="sb-info-note-icon"><Lock size={15} /></span>
      <div>
        <div className="sb-info-note-title">Your data, in plain kawaii terms</div>
        <div className="sb-info-note-row"><Lock size={11} /> Private to your account, always</div>
        <div className="sb-info-note-row"><Ban size={11} /> Never sold, never advertised against</div>
        <div className="sb-info-note-row"><Download size={11} /> Exportable as JSON, anytime you like</div>
      </div>
    </div>
  );
}
