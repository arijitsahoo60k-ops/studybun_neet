/**
 * Shared image file validation used by both CommunityComposer (post images)
 * and the reply composer inside CommunityPost. Keeps validation logic in one
 * place so the two UIs can't drift apart.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB, matches storage bucket limit

/**
 * Returns null if the file is acceptable, or a user-readable error string.
 * @param {File} file
 * @returns {string|null}
 */
export function validateImageFile(file) {
  if (!file) return "No file selected.";
  if (!file.type.startsWith("image/")) return "That file isn't an image.";
  if (file.size > MAX_IMAGE_BYTES) return "That image is too big (max 8MB).";
  return null;
}
