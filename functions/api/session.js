import { json, requireSession } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;

  const { user, isAdmin, isHR, canEvaluate } = auth.session;
  return json({ user, isAdmin, isHR, canEvaluate });
}
