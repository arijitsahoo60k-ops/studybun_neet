// ============================================================
// Lifetime data backup: export everything the app stores per-user
// into one portable JSON file, and re-import it later (same or
// different account).
// ============================================================

export const EXPORT_TABLES = [
  { key: "study_sessions", label: "Study sessions" },
  { key: "timer_sessions", label: "Focus timer sessions" },
  { key: "chapter_progress", label: "Chapter progress", conflict: "user_id,subject,chapter" },
  { key: "question_logs", label: "Question logs" },
  { key: "mock_tests", label: "Mock tests" },
  { key: "revision_plans", label: "Revision plans" },
  { key: "tasks", label: "Tasks" },
  { key: "backlog_items", label: "Backlog items" },
  { key: "goals", label: "Goals" },
  { key: "achievements", label: "Achievements", conflict: "user_id,achievement_key" },
];

const PROFILE_FIELDS = [
  "name", "exam", "exam_date", "exam_time", "subject_stream", "custom_exams",
  "daily_goal", "daily_question_target", "theme", "mascot", "dark_mode",
];

export function buildExportPayload(rowsByTable, profile) {
  const data = {};
  EXPORT_TABLES.forEach(({ key }) => {
    data[key] = (rowsByTable[key] || []).map(({ id, user_id, ...rest }) => rest);
  });
  const profileOut = {};
  if (profile) PROFILE_FIELDS.forEach((f) => { if (profile[f] !== undefined) profileOut[f] = profile[f]; });

  return {
    app: "StudyBun NEET",
    export_version: 2,
    exported_at: new Date().toISOString(),
    profile: profileOut,
    data,
  };
}

export function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error("That file isn't valid JSON — was it exported from StudyBun?"));
      }
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function isValidBackup(payload) {
  return Boolean(payload && typeof payload === "object" && payload.data && typeof payload.data === "object");
}

export async function importPayload(supabase, userId, payload, { applyProfile = true, saveProfile } = {}) {
  if (!isValidBackup(payload)) {
    throw new Error("That doesn't look like a StudyBun backup file.");
  }

  const summary = { imported: {}, errors: [] };

  for (const { key, label, conflict } of EXPORT_TABLES) {
    const rows = Array.isArray(payload.data[key]) ? payload.data[key] : [];
    if (!rows.length) continue;

    const cleaned = rows
      .filter((r) => r && typeof r === "object")
      .map((r) => {
        const { id, user_id, ...rest } = r;
        return { ...rest, user_id: userId };
      });

    let count = 0;
    for (const batch of chunk(cleaned, 300)) {
      const query = supabase.from(key);
      const { data, error } = conflict
        ? await query.upsert(batch, { onConflict: conflict }).select("id")
        : await query.insert(batch).select("id");
      if (error) summary.errors.push(`${label}: ${error.message}`);
      else count += data?.length || 0;
    }
    summary.imported[key] = count;
  }

  if (applyProfile && payload.profile && typeof saveProfile === "function") {
    const patch = {};
    PROFILE_FIELDS.forEach((f) => { if (payload.profile[f] !== undefined && payload.profile[f] !== null) patch[f] = payload.profile[f]; });
    if (Object.keys(patch).length) {
      const saved = await saveProfile(patch);
      if (!saved) summary.errors.push("Profile & theme settings didn't save.");
    }
  }

  return summary;
}

export function totalImported(summary) {
  return Object.values(summary.imported).reduce((a, n) => a + n, 0);
}
