import { json, requireSession } from "../../_shared/auth.js";

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) {
    return json({ error: "Somente o administrador geral pode remover materiais." }, 403);
  }

  const id = String(params.id || "");
  const existing = await env.DB.prepare(
    "SELECT * FROM materials WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!existing) return json({ error: "Material não encontrado ou já removido." }, 404);

  const now = new Date().toISOString();
  const archived = {
    ...existing,
    deleted_at: now,
    deleted_by_id: auth.session.user.id,
    deleted_by_name: auth.session.user.name
  };

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE materials
       SET deleted_at = ?, deleted_by_id = ?, deleted_by_name = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).bind(now, auth.session.user.id, auth.session.user.name, id),
    env.DB.prepare(
      `INSERT INTO materials_audit (
        material_id, action, actor_discord_id, actor_name,
        before_json, after_json, created_at
      ) VALUES (?, 'ARCHIVED', ?, ?, ?, ?, ?)`
    ).bind(
      id, auth.session.user.id, auth.session.user.name,
      JSON.stringify(existing), JSON.stringify(archived), now
    )
  ]);

  return json({ success: true, message: "Material removido da área de publicação. O registro foi preservado para auditoria." });
}
