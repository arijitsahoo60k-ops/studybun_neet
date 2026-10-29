import React, { useState } from "react";
import { THEMES, themeVars, readStoredDarkMode, writeStoredDarkMode } from "../../data/themes";
import { DEFAULT_NEET_EXAM, DEFAULT_NEET_DATE, DEFAULT_NEET_TIME, writeLocalProfileExt } from "../../lib/examTracker";
import AuthOnboardStyle from "../../styles/AuthOnboardStyle";
import OnboardingShell from "./OnboardingShell";
import { ONBOARDING_STEPS } from "./steps";
import NameStep from "./steps/NameStep";
import SubjectsStep from "./steps/SubjectsStep";
import ExamStep from "./steps/ExamStep";
import GoalStep from "./steps/GoalStep";
import MascotStep from "./steps/MascotStep";
import ThemeStep from "./steps/ThemeStep";

const STEP_COMPONENTS = {
  name: NameStep,
  subjects: SubjectsStep,
  exam: ExamStep,
  goal: GoalStep,
  mascot: MascotStep,
  theme: ThemeStep,
};

export default function Onboarding({ profile, onSave }) {
  const initialExam = profile?.exam && profile.exam !== "JEE Main" && profile.exam !== "JEE Advanced"
    ? profile.exam
    : DEFAULT_NEET_EXAM;

  const [form, setForm] = useState({
    name: profile?.name || "",
    subject_stream: profile?.subject_stream || "PCB",
    exam_mode: initialExam === "NEET UG" ? "neet" : "custom",
    exam: initialExam,
    exam_date: profile?.exam_date && profile.exam_date !== "2027-01-24" ? profile.exam_date : DEFAULT_NEET_DATE,
    exam_time: profile?.exam_time || DEFAULT_NEET_TIME,
    custom_exams: Array.isArray(profile?.custom_exams) ? profile.custom_exams : [],
    daily_goal: profile?.daily_goal || 6,
    theme: profile?.theme || "Sakura Bloom",
    mascot: profile?.mascot || "bunny",
    dark_mode: typeof profile?.dark_mode === "boolean" ? profile.dark_mode : readStoredDarkMode(false),
  });
  const [step, setStep] = useState(0);

  const t = THEMES[form.theme] || THEMES["Sakura Bloom"];
  const cssVars = themeVars(t, form.dark_mode);
  const stepId = ONBOARDING_STEPS[step].id;
  const StepComponent = STEP_COMPONENTS[stepId];
  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const nextDisabled =
    (stepId === "name" && !form.name.trim()) ||
    (stepId === "exam" && (!form.exam.trim() || !form.exam_date));

  const goNext = () => {
    if (isLastStep) {
      writeStoredDarkMode(Boolean(form.dark_mode));
      const { exam_mode: _examMode, ...cleanPayload } = form;
      writeLocalProfileExt({
        subject_stream: cleanPayload.subject_stream,
        exam: cleanPayload.exam,
        exam_date: cleanPayload.exam_date,
        exam_time: cleanPayload.exam_time,
        custom_exams: cleanPayload.custom_exams,
      });
      onSave(cleanPayload);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="sb-onboard" style={cssVars} data-dark={form.dark_mode ? "true" : "false"}>
      <AuthOnboardStyle />
      {form.dark_mode && <div className="sb-dark-glow-mesh" aria-hidden="true" />}
      <OnboardingShell
        mascot={form.mascot}
        stepIndex={step}
        title="Welcome to StudyBun NEET 🌸"
        subtitle="Your cozy NEET & medical prep companion. Let's set things up."
        onBack={() => setStep((s) => s - 1)}
        onNext={goNext}
        nextDisabled={nextDisabled}
        isLastStep={isLastStep}
        nextLabel="Start studying"
      >
        <StepComponent form={form} setForm={setForm} />
      </OnboardingShell>
    </div>
  );
}
