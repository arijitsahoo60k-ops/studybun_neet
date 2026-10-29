# StudyBun NEET 🐰🌸🩺

Your cozy NEET UG study companion — complete NCERT Biology classification (**Botany 17 chapters + Zoology 15 chapters**), **PCB / PCMB** subject stream customization, live **NEET Date Tracker & Custom Exam Time Tracker** system, real Supabase persistence + realtime sync, a multi-mascot system, Gemini-powered AI Insights, and a **Mathematical + AI Mock Test Comparison Engine** (`+4/-1` 720-mark NEET UG pattern, NTA marks-vs-rank log interpolation, OLS regression slope $\beta_1$, Z-score consistency, and game-theoretic Expected Value counterfactual rank simulations).

## Key NEET Customizations & Features

1. **Complete Rationalised NCERT Biology Curriculum (32 Chapters · 360 Marks)**:
   - **Section I: Botany (17 Chapters · 45 Scored Qs · 180 Marks)**:
     - Class 11 (`BOT-01` to `BOT-10`): *Cell: The Unit of Life*, *Cell Cycle and Cell Division*, *The Living World*, *Biological Classification*, *Plant Kingdom*, *Morphology of Flowering Plants*, *Anatomy of Flowering Plants*, *Respiration in Plants*, *Photosynthesis in Higher Plants*, *Plant Growth and Development*.
     - Class 12 (`BOT-11` to `BOT-17`): *Sexual Reproduction in Flowering Plants*, *Principles of Inheritance and Variation*, *Molecular Basis of Inheritance*, *Microbes in Human Welfare*, *Organisms and Populations*, *Ecosystem*, *Biodiversity and Conservation*.
   - **Section II: Zoology (15 Chapters · 45 Scored Qs · 180 Marks)**:
     - Class 11 (`ZOO-01` to `ZOO-09`): *Structural Organisation in Animals (Frog/Tissues)*, *Breathing and Exchange of Gases*, *Body Fluids and Circulation*, *Excretory Products and their Elimination*, *Locomotion and Movement*, *Neural Control and Coordination*, *Chemical Coordination and Integration*, *Animal Kingdom*, *Biomolecules*.
     - Class 12 (`ZOO-10` to `ZOO-15`): *Human Reproduction*, *Reproductive Health*, *Human Health and Disease*, *Biotechnology: Principles and Processes*, *Biotechnology and its Applications*, *Evolution*.
   - Includes NCERT Class (`Class 11` / `Class 12`), Batch ID (`BOT-01`..`BOT-17`, `ZOO-01`..`ZOO-15`), NCERT Unit Correlation tags, and High-Yield Unit question weightage guides directly in the **Syllabus** page.

2. **Subjects Choice (`PCB` vs `PCMB`) in Onboarding & Settings**:
   - **PCB**: Biology (Botany + Zoology), Physics, and Chemistry.
   - **PCMB**: Unlocks Mathematics alongside Biology, Physics, and Chemistry across Syllabus, Study Tracker, Focus Timer, Question Practice, Daily Planner, Backlog, Analytics, and Mock Tests.

3. **NEET Date Tracker & Custom Exam Time Tracker System**:
   - Track **NEET UG** (with IST date & start time, default `14:00` [2:00 PM IST]) OR set a **Custom Primary Exam** in Onboarding and Settings.
   - Add unlimited **Additional Custom Exam / Coaching Test Time Trackers** (e.g., AIATS, Allen Major Test, Pre-Boards, CUET) with live `Days : Hours : Minutes : Seconds` countdowns on the **Dashboard**, **Daily Recap**, **Profile**, and **Settings**.

4. **Mock Tests & Critical Mathematical + AI Comparison Engine**:
   - **NEET UG (720 Marks)**: Supports both **Auto (`+4 / -1` from Correct & Incorrect counts)** across Botany (45 Qs / 180M), Zoology (45 Qs / 180M), Physics (45 Qs / 180M), and Chemistry (45 Qs / 180M) AND **Direct Marks Entry** (with mathematical validation for impossible `+4/-1` section scores).
   - **Custom / Part Tests**: Supports any custom total marks and PCMB Mathematics marks.
   - **Mathematical & Statistical Diagnostics**:
     - Log-linear NTA NEET UG Marks-to-Rank (AIR) & Percentile interpolation across ~24,00,000 candidates.
     - Ordinary Least Squares (OLS) linear regression trajectory ($\beta_1$ slope in marks/mock, $R^2$ goodness-of-fit, and next-mock score projection).
     - Sample Standard Deviation ($\sigma$), Coefficient of Variation ($CV$), Consistency Index ($0\text{–}100$), Exponential Moving Average ($\text{EMA}$), and latest mock Z-score ($Z$).
     - Game-Theoretic `+4/-1` Accuracy & Negative Marking Bleed ($EV = 5p - 1$ marks/attempt) with **Counterfactual Rank Jump Simulations** (exact marks and AIR places gained by skipping 50% of wrong guesses vs. converting 50% of errors via NCERT revision).

## 1. Install

```bash
npm install
```

## 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your project, paste the contents of `supabase/schema.sql`, and run it.
   - If upgrading an existing StudyBun database, run `supabase/migration_studybun_neet.sql` in the SQL Editor (and note that the app also includes automatic schema-fallback logic so it works even before migrations are applied).
3. Go to **Settings → API** and copy your **Project URL** and **anon public key**.

## 3. Environment variables & Running locally

```bash
cp .env.example .env
npm run dev
```

## 4. Build & Deploy

```bash
npm run build
```
