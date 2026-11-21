import { json, requireSession } from "../../_shared/auth.js";

const SCORE_FIELDS = [
  "professional_posture",
  "teamwork",
  "proactivity",
  "practical_modulation",
  "technical_knowledge"
];

function verdictFor(average) {
  if (average >= 4) return "APTO PARA EFETIVAÇÃO";
  if (average >= 3) return "APTO COM RESSALVAS";
  return "NÃO APTO PARA EFETIVAÇÃO";
}

function normalizedScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

export async function onRequestGet({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Acesso restrito ao Recursos Humanos." }, 403);
  }

  const id = String(params.id || "");
  const evaluation = await env.DB.prepare(
    "SELECT * FROM evaluations WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();

  if (!evaluation) return json({ error: "Avaliação não encontrada ou arquivada." }, 404);

  const { results: history } = await env.DB.prepare(
    `SELECT action, actor_discord_id, actor_name, before_json, after_json, created_at
     FROM evaluation_audit
     WHERE evaluation_id = ?
     ORDER BY created_at DESC`
  ).bind(id).all();

  return json({ evaluation, history: history || [] });
}

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Apenas o RH autorizado pode alterar avaliações." }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Os dados enviados são inválidos." }, 400);
  }

  const id = String(params.id || "");
  const existing = await env.DB.prepare(
    "SELECT * FROM evaluations WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();
  if (!existing) return json({ error: "Avaliação não encontrada ou arquivada." }, 404);

  const agpName = String(data.agp_name ?? existing.agp_name).trim().slice(0, 140);
  const rg = String(data.rg ?? existing.rg).trim().slice(0, 40);
  const courses = String(data.courses ?? existing.courses).trim().slice(0, 500);
  const observations = String(data.observations ?? existing.observations).trim().slice(0, 4000);
  const cpdValue = data.cpd_certified ?? existing.cpd_certified;
  const cpdCertified = cpdValue === true || cpdValue === "SIM" || Number(cpdValue) === 1 ? 1 : 0;

  if (!agpName || !rg) {
    return json({ error: "Informe o nome e o RG do AGP." }, 400);
  }

  const scores = {};
  for (const field of SCORE_FIELDS) {
    const score = normalizedScore(data[field] ?? existing[field]);
    if (score === null) {
      return json({ error: "Todos os cinco critérios devem receber uma nota de 1 a 5." }, 400);
    }
    scores[field] = score;
  }

  const average = Math.round(
    SCORE_FIELDS.reduce((sum, field) => sum + scores[field], 0) / SCORE_FIELDS.length * 100
  ) / 100;
  const verdict = verdictFor(average);
  const now = new Date().toISOString();

  const updated = {
    ...existing,
    agp_name: agpName,
    rg,
    courses,
    cpd_certified: cpdCertified,
    ...scores,
    average,
    verdict,
    observations,
    updated_at: now
  };

  const updateStatement = env.DB.prepare(
    `UPDATE evaluations SET
      agp_name = ?, rg = ?, courses = ?, cpd_certified = ?,
      professional_posture = ?, teamwork = ?, proactivity = ?,
      practical_modulation = ?, technical_knowledge = ?,
      average = ?, verdict = ?, observations = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).bind(
    agpName, rg, courses, cpdCertified,
    scores.professional_posture, scores.teamwork, scores.proactivity,
    scores.practical_modulation, scores.technical_knowledge,
    average, verdict, observations, now, id
  );

  const auditStatement = env.DB.prepare(
    `INSERT INTO evaluation_audit (
      evaluation_id, action, actor_discord_id, actor_name,
      before_json, after_json, created_at
    ) VALUES (?, 'UPDATED', ?, ?, ?, ?, ?)`
  ).bind(
    id,
    auth.session.user.id,
    auth.session.user.name,
    JSON.stringify(existing),
    JSON.stringify(updated),
    now
  );

  await env.DB.batch([updateStatement, auditStatement]);
  return json({ evaluation: updated });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Apenas o RH autorizado pode arquivar avaliações." }, 403);
  }

  const id = String(params.id || "");
  const existing = await env.DB.prepare(
    "SELECT * FROM evaluations WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();
  if (!existing) return json({ error: "Avaliação não encontrada ou já arquivada." }, 404);

  const now = new Date().toISOString();
  const archived = {
    ...existing,
    deleted_at: now,
    deleted_by_id: auth.session.user.id,
    deleted_by_name: auth.session.user.name
  };

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE evaluations
       SET deleted_at = ?, deleted_by_id = ?, deleted_by_name = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).bind(now, auth.session.user.id, auth.session.user.name, id),
    env.DB.prepare(
      `INSERT INTO evaluation_audit (
        evaluation_id, action, actor_discord_id, actor_name,
        before_json, after_json, created_at
      ) VALUES (?, 'ARCHIVED', ?, ?, ?, ?, ?)`
    ).bind(
      id, auth.session.user.id, auth.session.user.name,
      JSON.stringify(existing), JSON.stringify(archived), now
    )
  ]);

  return json({ success: true, archived: true, message: "Avaliação arquivada. O histórico de auditoria foi preservado." });
}
