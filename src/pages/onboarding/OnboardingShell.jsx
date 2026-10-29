import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Mascot from "../../components/Mascot";
import { Btn } from "../../components/ui";
import { ONBOARDING_STEPS } from "./steps";

const SPARKLES = [
  { emoji: "✨", top: "6%", left: "8%", delay: "0s" },
  { emoji: "🌸", top: "14%", right: "10%", delay: "1.4s" },
  { emoji: "💫", bottom: "10%", left: "6%", delay: "2.6s" },
  { emoji: "⭐", bottom: "16%", right: "8%", delay: "0.8s" },
];

export default function OnboardingShell({ mascot, stepIndex, title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, isLastStep }) {
  const step = ONBOARDING_STEPS[stepIndex];

  return (
    <div className="sb-flow-card">
      <div className="sb-flow-sparkles" aria-hidden="true">
        {SPARKLES.map((s, i) => (
          <span key={i} className="sb-flow-sparkle" style={{ ...s, animationDelay: s.delay }}>{s.emoji}</span>
        ))}
      </div>

      <div className="sb-flow-mascot-wrap">
        <Mascot species={mascot} mood={step.mood} size={80} hopLoop={stepIndex === 0} />
      </div>
      <div className="sb-flow-bubble" key={step.id}>{step.bubble}</div>

      <h1 className="sb-flow-title">{title}</h1>
      <p className="sb-flow-sub">{subtitle}</p>

      <div className="sb-ob-trail" aria-hidden="true">
        {ONBOARDING_STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <span className={`sb-ob-trail-line ${i <= stepIndex ? "done" : ""}`} />}
            <span className={`sb-ob-trail-node ${i < stepIndex ? "done" : ""} ${i === stepIndex ? "active" : ""}`}>
              {i <= stepIndex ? s.emoji : ""}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="sb-flow-step-viewport">
        <div className="sb-flow-step-enter" key={step.id}>
          {children}
        </div>
      </div>

      <div className="sb-flow-actions">
        {stepIndex > 0 && <Btn variant="ghost" onClick={onBack}><ChevronLeft size={16} /> Back</Btn>}
        <Btn onClick={onNext} disabled={nextDisabled}>
          {isLastStep ? nextLabel || "Start studying" : "Continue"} {!isLastStep && <ChevronRight size={16} />}
        </Btn>
      </div>
    </div>
  );
}
