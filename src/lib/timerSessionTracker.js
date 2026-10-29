// Tracks the timer_sessions row that a finished focus session auto-logged,
// so it can be removed again if the person discards the session on the
// "What did you study?" card (or resets while that card is up).
//
// Why this exists: the row is written the instant the timer ends (so a
// finished session is never lost), long before the person decides whether to
// keep it. Without this, "Discard" left the row behind and the minutes kept
// counting in study hours, streak and leaderboard points.
//
// Kept framework-free (all I/O injected) so the race conditions below can be
// unit-tested without React or Supabase.

const STORAGE_KEY = "sb.focusTimer.pendingRow.v1";

function safeStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function createTimerSessionTracker({
  getUserId,
  insert,            // (payload, { idempotencyKey }) => Promise<row|null>
  remove,            // (id) => Promise<boolean>
  onInsertFailed,    // (retry: () => void) => void
  onRemoveFailed,    // (retry: () => void) => void
  newToken = () => crypto.randomUUID(),
  storage = safeStorage(),
}) {
  // Promise of the insert for the session currently awaiting a decision.
  let current = null;
  // clientToken of an insert that failed and is still offered a Retry.
  let failedToken = null;

  const readId = () => {
    try {
      const v = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
      return v && v.uid === getUserId() ? v.id : null;
    } catch { return null; }
  };
  const writeId = (id) => { try { storage?.setItem(STORAGE_KEY, JSON.stringify({ id, uid: getUserId() })); } catch { /* ignore */ } };
  const clearId = () => { try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore */ } };

  async function log(payload, clientToken = newToken()) {
    // A new session supersedes whatever was pending before.
    clearId();
    failedToken = null;
    const pending = insert(payload, { idempotencyKey: clientToken });
    current = pending;
    const row = await pending;
    if (!row) {
      failedToken = clientToken;
      onInsertFailed(() => {
        // Ignore a Retry for a session that was discarded in the meantime.
        if (failedToken !== clientToken) return;
        failedToken = null;
        log(payload, clientToken);
      });
      return null;
    }
    // Only remember the id if this session is still the one awaiting a
    // decision. If it was already kept/discarded while the insert was in
    // flight, writing it now would leave a stale id that a LATER discard
    // could wrongly delete.
    if (current === pending) writeId(row.id);
    return row;
  }

  async function removeRow(id) {
    const ok = await remove(id);
    if (!ok) onRemoveFailed(() => removeRow(id));
    return ok;
  }

  async function settle({ discarded }) {
    const inFlight = current;
    current = null;
    if (!discarded) {
      clearId();
      return;
    }
    failedToken = null; // a discarded session must never be re-inserted by a Retry
    // Take (and clear) the remembered id BEFORE any await, so a second
    // Discard tap landing while the first is still awaiting finds nothing
    // left to delete instead of deleting the same row twice.
    const storedId = readId();
    clearId();
    // Wait for an insert that hasn't resolved yet so a quick discard can't
    // race ahead of it and leave the row behind.
    const row = inFlight ? await inFlight : null;
    const id = row?.id || storedId;
    if (id) await removeRow(id);
  }

  return { log, settle };
}
