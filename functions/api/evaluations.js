import { json, requireSession } from "../_shared/auth.js";

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

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isHR) {
    return json({ error: "Acesso restrito ao Recursos Humanos." }, 403);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, agp_name, rg, courses, cpd_certified,
            professional_posture, teamwork, proactivity,
            practical_modulation, technical_knowledge,
            average, verdict, observations,
            created_by_id, created_by_name, created_at, updated_at
     FROM evaluations
     ORDER BY updated_at DESC`
  ).all();

  return json({ evaluations: results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.canEvaluate) {
    return json({ error: "Você não tem permissão para registrar avaliações." }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Os dados enviados são inválidos." }, 400);
  }

  const agpName = String(data.agp_name || "").trim().slice(0, 140);
  const rg = String(data.rg || "").trim().slice(0, 40);
  const courses = String(data.courses || "").trim().slice(0, 500);
  const observations = String(data.observations || "").trim().slice(0, 4000);
  const cpdCertified = data.cpd_certified === true || data.cpd_certified === "SIM" ? 1 : 0;

  if (!agpName || !rg) {
    return json({ error: "Informe o nome e o RG do AGP." }, 400);
  }

  const scores = {};
  for (const field of SCORE_FIELDS) {
    const score = Number(data[field]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return json({ error: "Todos os cinco critérios devem receber uma nota de 1 a 5." }, 400);
    }
    scores[field] = score;
  }

  // A média segue a planilha de referência: média dos cinco critérios numéricos.
  const average = Math.round(
    SCORE_FIELDS.reduce((sum, field) => sum + scores[field], 0) / SCORE_FIELDS.length * 100
  ) / 100;
  const verdict = verdictFor(average);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record = {
    id,
    agp_name: agpName,
    rg,
    courses,
    cpd_certified: cpdCertified,
    ...scores,
    average,
    verdict,
    observations,
    created_by_id: auth.session.user.id,
    created_by_name: auth.session.user.name,
    created_at: now,
    updated_at: now
  };

  const insertEvaluation = env.DB.prepare(
    `INSERT INTO evaluations (
      id, agp_name, rg, courses, cpd_certified,
      professional_posture, teamwork, proactivity,
      practical_modulation, technical_knowledge,
      average, verdict, observations,
      created_by_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, agpName, rg, courses, cpdCertified,
    scores.professional_posture, scores.teamwork, scores.proactivity,
    scores.practical_modulation, scores.technical_knowledge,
    average, verdict, observations,
    auth.session.user.id, auth.session.user.name, now, now
  );

  const insertAudit = env.DB.prepare(
    `INSERT INTO evaluation_audit (
      evaluation_id, action, actor_discord_id, actor_name,
      before_json, after_json, created_at
    ) VALUES (?, 'CREATED', ?, ?, NULL, ?, ?)`
  ).bind(id, auth.session.user.id, auth.session.user.name, JSON.stringify(record), now);

  await env.DB.batch([insertEvaluation, insertAudit]);
  return json({ evaluation: record }, 201);
}
