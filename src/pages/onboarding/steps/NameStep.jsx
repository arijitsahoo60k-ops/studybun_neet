import React from "react";
import { User } from "lucide-react";

export default function NameStep({ form, setForm }) {
  return (
    <>
      <div className="sb-flow-step-head">
        <span className="sb-flow-step-icon">👋</span>
        <label>What should I call you?</label>
      </div>
      <div className="sb-ob-input-icon-wrap">
        <User size={15} />
        <input
          className="sb-input"
          placeholder="Your name"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <p className="sb-ob-hint">This is how your study buddy will greet you every day 🌸</p>
    </>
  );
}
