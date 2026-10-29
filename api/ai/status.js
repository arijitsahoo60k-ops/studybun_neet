import { getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { hasUsableKeys as geminiHasKeys } from "../_lib/geminiClient.js";
import { hasUsableKeys as groqHasKeys } from "../_lib/groqClient.js";

// Reports only booleans — never key values, counts, or any provider detail.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ success: false, error: authError || "Not signed in." });

  return res.status(200).json({
    success: true,
    data: { geminiReady: geminiHasKeys(), groqReady: groqHasKeys() },
  });
}
