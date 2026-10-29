import { authedApiPost } from "../lib/apiClient";
import { getModelPreference } from "./buddyKeyManager";

/**
 * Sends one chat turn to the Smart Study Buddy via StudyBun's server-side
 * endpoint (api/ai/buddy.js). The server holds the Gemini key(s) and rotates
 * across them — the browser never sees a key. `modelPreference` is a small
 * allowlisted family id ("auto" | "gemini3" | "gemini2"), never a raw model
 * name, so the client can't pin an arbitrary/expensive model.
 */
export async function askBuddy({ message, history, mascotLabel, userName, statsSnapshot }) {
  return authedApiPost("/api/ai/buddy", {
    message,
    history,
    mascotLabel,
    userName,
    statsSnapshot,
    modelPreference: getModelPreference(),
  });
}
