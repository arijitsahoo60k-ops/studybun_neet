import React from "react";

const MIN = 1;
const MAX = 16;

export default function GoalStep({ form, setForm }) {
  const clamp = (v) => Math.min(MAX, Math.max(MIN, v));

  return (
    <>
      <div className="sb-flow-step-head">
        <span className="sb-flow-step-icon">⏰</span>
        <label>Daily study goal</label>
      </div>
      <div className="sb-ob-stepper">
        <button
          type="button"
          className="sb-ob-stepper-btn"
          disabled={form.daily_goal <= MIN}
          onClick={() => setForm({ ...form, daily_goal: clamp(form.daily_goal - 1) })}
          aria-label="Decrease"
        >−</button>
        <div className="sb-ob-stepper-value">
          <div className="sb-ob-stepper-num">{form.daily_goal}</div>
          <div className="sb-ob-stepper-label">hour{form.daily_goal === 1 ? "" : "s"} / day</div>
        </div>
        <button
          type="button"
          className="sb-ob-stepper-btn"
          disabled={form.daily_goal >= MAX}
          onClick={() => setForm({ ...form, daily_goal: clamp(form.daily_goal + 1) })}
          aria-label="Increase"
        >+</button>
      </div>
      <p className="sb-ob-hint" style={{ textAlign: "center" }}>You can always change this later in Settings.</p>
    </>
  );
}
