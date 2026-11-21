import { json, requireSession } from "../../_shared/auth.js";

export async function onRequestDelete({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Apenas o RH autorizado pode arquivar avaliações." }, 403);
  }

  const active = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM evaluations WHERE deleted_at IS NULL"
  ).first();
  const total = Number(active?.total || 0);
  if (!total) {
    return json({ success: true, archived_count: 0, message: "Não há avaliações ativas para arquivar." });
  }

  const now = new Date().toISOString();
  const archiveAudit = env.DB.prepare(
    `INSERT INTO evaluation_audit (
      evaluation_id, action, actor_discord_id, actor_name,
      before_json, after_json, created_at
    )
    SELECT
      id, 'ARCHIVED_BULK', ?, ?,
      json_object(
        'id', id,
        'agp_name', agp_name,
        'rg', rg,
        'courses', courses,
        'cpd_certified', cpd_certified,
        'professional_posture', professional_posture,
        'teamwork', teamwork,
        'proactivity', proactivity,
        'practical_modulation', practical_modulation,
        'technical_knowledge', technical_knowledge,
        'average', average,
        'verdict', verdict,
        'observations', observations,
        'created_by_id', created_by_id,
        'created_by_name', created_by_name,
        'created_at', created_at,
        'updated_at', updated_at
      ),
      NULL,
      ?
    FROM evaluations
    WHERE deleted_at IS NULL`
  ).bind(auth.session.user.id, auth.session.user.name, now);

  const archiveRecords = env.DB.prepare(
    `UPDATE evaluations
     SET deleted_at = ?, deleted_by_id = ?, deleted_by_name = ?
     WHERE deleted_at IS NULL`
  ).bind(now, auth.session.user.id, auth.session.user.name);

  await env.DB.batch([archiveAudit, archiveRecords]);

  return json({
    success: true,
    archived_count: total,
    message: `${total} avaliação(ões) arquivada(s). Os dados e o histórico de auditoria foram preservados.`
  });
}
