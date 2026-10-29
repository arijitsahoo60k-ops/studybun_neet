import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { weightageFor } from "../data/syllabus";
import { packMockMeta, unpackMockRow } from "../lib/mockScore";
import { readLocalProfileExt, writeLocalProfileExt } from "../lib/examTracker";

const BASE_MOCK_COLUMNS = new Set([
  "user_id", "mock_date", "exam_name", "provider", "exam_type", "total_marks",
  "physics_marks", "chemistry_marks", "math_marks",
  "physics_correct", "physics_incorrect", "chemistry_correct", "chemistry_incorrect", "math_correct", "math_incorrect",
  "attempted", "correct", "incorrect", "negative_marks", "percentile", "rank", "duration_minutes",
  "physics_minutes", "chemistry_minutes", "math_minutes", "notes", "client_token",
]);

const BASE_PROFILE_COLUMNS = new Set([
  "user_id", "name", "exam", "exam_date", "daily_goal", "daily_question_target",
  "theme", "mascot", "dark_mode", "streak_freeze_tokens", "streak_freeze_granted_days",
  "bio", "prep_year", "community_opt_out", "updated_at",
]);

function stripTransientMockKeys(obj) {
  const clean = { ...obj };
  if (clean.user_notes !== undefined && clean.notes === undefined) {
    clean.notes = clean.user_notes;
  }
  delete clean.user_notes;
  delete clean.real_exam_type;
  delete clean.userNotes;
  return clean;
}

function prepareMockPayloadForFallback(payload) {
  const ext = {
    real_exam_type: payload.exam_type,
    input_mode: payload.input_mode,
    biology_marks: payload.biology_marks,
    botany_marks: payload.botany_marks,
    zoology_marks: payload.zoology_marks,
    biology_correct: payload.biology_correct,
    biology_incorrect: payload.biology_incorrect,
    botany_correct: payload.botany_correct,
    botany_incorrect: payload.botany_incorrect,
    zoology_correct: payload.zoology_correct,
    zoology_incorrect: payload.zoology_incorrect,
    biology_minutes: payload.biology_minutes,
    botany_minutes: payload.botany_minutes,
    zoology_minutes: payload.zoology_minutes,
  };
  const fallback = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (BASE_MOCK_COLUMNS.has(k)) fallback[k] = v;
  });
  // Legacy DB constraint only allowed 'JEE Main' | 'JEE Advanced'
  if (fallback.exam_type && fallback.exam_type !== "JEE Main" && fallback.exam_type !== "JEE Advanced") {
    fallback.exam_type = fallback.exam_type === "NEET UG" ? "JEE Main" : "JEE Advanced";
  }
  const cleanNotes = payload.user_notes !== undefined
    ? payload.user_notes
    : (typeof payload.notes === "string" && !payload.notes.startsWith("__sb_neet_meta:") ? payload.notes : "");
  fallback.notes = packMockMeta(ext, cleanNotes);
  return fallback;
}

/**
 * Keeps a Supabase table's rows (scoped to the signed-in user) in sync in
 * real time. If there's no signed-in user yet (e.g. Supabase isn't
 * configured), it stays idle with empty rows rather than erroring.
 */
export function useRealtimeTable(table, { orderBy = "created_at", ascending = false, enabled = true } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const loadRef = useRef(null);

  const normalizeRow = useCallback(
    (r) => (table === "mock_tests" && r ? unpackMockRow(r) : r),
    [table]
  );

  useEffect(() => {
    mounted.current = true;

    if (!userId) {
      setRows([]);
      setLoading(false);
      loadRef.current = null;
      return () => { mounted.current = false; };
    }

    if (!enabled) {
      setLoading(false);
      loadRef.current = null;
      return () => { mounted.current = false; };
    }

    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order(orderBy, { ascending });
      if (!mounted.current) return;
      if (err) setError(err);
      else setRows((data || []).map(normalizeRow));
      setLoading(false);
    }
    load();
    loadRef.current = load;

    const channel = supabase
      .channel(`rt:${table}:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const nr = normalizeRow(payload.new);
              if (prev.some((r) => r.id === nr.id)) return prev;
              return [nr, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const nr = normalizeRow(payload.new);
              return prev.map((r) => (r.id === nr.id ? nr : r));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, userId, enabled]);

  const insert = useCallback(
    async (row, { idempotencyKey } = {}) => {
      if (!userId) return null;
      const rawPayload = { ...row, user_id: userId };
      const payload = table === "mock_tests" ? stripTransientMockKeys(rawPayload) : rawPayload;

      const runInsert = (p) =>
        idempotencyKey
          ? supabase.from(table).upsert({ ...p, client_token: idempotencyKey }, { onConflict: "user_id,client_token" }).select().single()
          : supabase.from(table).insert(p).select().single();

      let { data, error: err } = await runInsert(payload);
      if (err && table === "mock_tests") {
        // Fallback for unmigrated mock_tests schema
        const fallbackPayload = prepareMockPayloadForFallback(rawPayload);
        const retry = await runInsert(fallbackPayload);
        data = retry.data;
        err = retry.error;
      }
      if (err) { setError(err); console.error(`[StudyBun] insert into ${table} failed:`, err.message); return null; }
      const normalized = normalizeRow(data);
      setRows((prev) => (prev.some((r) => r.id === normalized.id) ? prev : [normalized, ...prev]));
      return normalized;
    },
    [table, userId, normalizeRow]
  );

  const update = useCallback(
    async (id, patch) => {
      const nextPatch = table === "mock_tests" ? stripTransientMockKeys(patch) : { ...patch };

      let { data, error: err } = await supabase.from(table).update(nextPatch).eq("id", id).select().single();
      if (err && table === "mock_tests") {
        const fallbackPatch = prepareMockPayloadForFallback(patch);
        const retry = await supabase.from(table).update(fallbackPatch).eq("id", id).select().single();
        data = retry.data;
        err = retry.error;
      }
      if (err) { setError(err); console.error(`[StudyBun] update on ${table} failed:`, err.message); return null; }
      const normalized = normalizeRow(data);
      setRows((prev) => prev.map((r) => (r.id === id ? normalized : r)));
      return normalized;
    },
    [table, normalizeRow]
  );

  const remove = useCallback(
    async (id) => {
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) { setError(err); console.error(`[StudyBun] delete on ${table} failed:`, err.message); return false; }
      setRows((prev) => prev.filter((r) => r.id !== id));
      return true;
    },
    [table]
  );

  const removeMany = useCallback(
    async (ids) => {
      if (!ids || !ids.length) return true;
      const CHUNK = 80;
      const gone = new Set();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { error: err } = await supabase.from(table).delete().in("id", slice);
        if (err) {
          setError(err);
          console.error(`[StudyBun] bulk delete on ${table} failed:`, err.message);
          if (gone.size) setRows((prev) => prev.filter((r) => !gone.has(r.id)));
          return false;
        }
        slice.forEach((id) => gone.add(id));
      }
      setRows((prev) => prev.filter((r) => !gone.has(r.id)));
      return true;
    },
    [table]
  );

  const refetch = useCallback(() => loadRef.current?.(), []);

  return { rows, loading, error, insert, update, remove, removeMany, setRows, refetch };
}

/** Single-row-per-user table (profiles, user_settings, user_statistics). */
export function useDeviceRow(table, defaults = {}, { enabled = true } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(null);

  const mergeProfileExt = useCallback(
    (r) => {
      if (table !== "profiles" || !r) return r;
      const ext = readLocalProfileExt();
      const rawExam = r.exam || ext.exam || defaults.exam || "NEET UG";
      const exam = rawExam === "JEE Main" || rawExam === "JEE Advanced" ? (ext.exam || "NEET UG") : rawExam;
      return {
        ...ext,
        ...r,
        exam,
        subject_stream: r.subject_stream || ext.subject_stream || defaults.subject_stream || "PCB",
        exam_time: r.exam_time || ext.exam_time || defaults.exam_time || "14:00",
        custom_exams: Array.isArray(r.custom_exams)
          ? r.custom_exams
          : Array.isArray(ext.custom_exams)
            ? ext.custom_exams
            : (defaults.custom_exams || []),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table]
  );

  useEffect(() => {
    let active = true;

    if (!userId) {
      setRow(null);
      setLoading(false);
      return () => { active = false; };
    }

    if (!enabled) {
      setLoading(false);
      loadRef.current = null;
      return () => { active = false; };
    }

    async function load() {
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).maybeSingle();
      if (!active) return;
      if (!data && !error) {
        let { data: created, error: createErr } = await supabase
          .from(table)
          .insert({ user_id: userId, ...defaults })
          .select()
          .single();
        if (createErr && table === "profiles") {
          const baseDefaults = {};
          Object.entries(defaults).forEach(([k, v]) => {
            if (BASE_PROFILE_COLUMNS.has(k)) baseDefaults[k] = v;
          });
          const retry = await supabase.from(table).insert({ user_id: userId, ...baseDefaults }).select().single();
          created = retry.data;
        }
        setRow(mergeProfileExt(created));
      } else {
        setRow(mergeProfileExt(data));
      }
      setLoading(false);
    }
    load();
    loadRef.current = load;

    const channel = supabase
      .channel(`rt:${table}:row:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        (payload) => setRow(payload.new ? mergeProfileExt(payload.new) : null)
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, userId, enabled]);

  const save = useCallback(
    async (patch) => {
      if (!userId) return null;
      if (table === "profiles") {
        const extKeys = ["subject_stream", "exam_time", "custom_exams", "exam", "exam_date"];
        const extPatch = {};
        extKeys.forEach((k) => {
          if (patch[k] !== undefined) extPatch[k] = patch[k];
        });
        if (Object.keys(extPatch).length > 0) writeLocalProfileExt(extPatch);
      }

      let { data, error } = await supabase
        .from(table)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .single();

      if (error && table === "profiles") {
        const basePatch = {};
        Object.entries(patch).forEach(([k, v]) => {
          if (BASE_PROFILE_COLUMNS.has(k)) basePatch[k] = v;
        });
        const retry = await supabase
          .from(table)
          .update({ ...basePatch, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .select()
          .single();
        data = retry.data ? { ...retry.data, ...patch } : null;
        error = retry.error;
      }

      if (error) { console.error(`[StudyBun] update on ${table} failed:`, error.message); return null; }
      const merged = mergeProfileExt(data);
      setRow(merged);
      return merged;
    },
    [table, userId, mergeProfileExt]
  );

  const refetch = useCallback(() => loadRef.current?.(), []);

  return { row, loading, save, refetch };
}

/** mock_analysis is 1:1 with a mock_tests row (keyed by mock_id) — a thin wrapper with upsert semantics. */
export function useMockAnalysis(options = {}) {
  const { rows, loading, insert, update, remove, refetch } = useRealtimeTable("mock_analysis", { orderBy: "created_at", ...options });

  const map = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.mock_id] = r; });
    return m;
  }, [rows]);

  const upsert = useCallback(
    async (mockId, patch) => {
      const existing = map[mockId];
      if (existing) return update(existing.id, patch);
      return insert({ mock_id: mockId, ...patch });
    },
    [map, insert, update]
  );

  return { map, rows, loading, upsert, remove, refetch };
}

/** chapter_progress is keyed by (subject, chapter) rather than id-first — a thin wrapper with upsert semantics. */
export function useChapterProgress(options = {}) {
  const { rows, loading, insert, update, refetch } = useRealtimeTable("chapter_progress", { orderBy: "updated_at", ...options });

  const map = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[`${r.subject}::${r.chapter}`] = r; });
    return m;
  }, [rows]);

  const upsert = useCallback(
    async (subject, chapter, patch) => {
      const key = `${subject}::${chapter}`;
      const existing = map[key];
      if (existing) return update(existing.id, { ...patch, updated_at: new Date().toISOString() });
      const seededWeightage = patch.weightage != null ? {} : { weightage: weightageFor(chapter) };
      return insert({ subject, chapter, ...seededWeightage, ...patch });
    },
    [map, insert, update]
  );

  return { map, rows, loading, upsert, refetch };
}
