import { json, requireSession } from "../../_shared/auth.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Acesso restrito ao Recursos Humanos." }, 403);
  }

  const id = String(params.id || "");
  const evaluation = await env.DB.prepare(
    "SELECT * FROM evaluations WHERE id = ?"
  ).bind(id).first();

  if (!evaluation) return json({ error: "Avaliação não encontrada." }, 404);

  const { results: history } = await env.DB.prepare(
    `SELECT action, actor_discord_id, actor_name, before_json, after_json, created_at
     FROM evaluation_audit
     WHERE evaluation_id = ?
     ORDER BY created_at DESC`
  ).bind(id).all();

  return json({ evaluation, history: history || [] });
}
