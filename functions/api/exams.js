import { json, requireSession } from "../_shared/auth.js";

function slugify(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) return json({ error: "Acesso restrito ao administrador." }, 403);
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.slug, e.title, e.description, e.total_points, e.active, e.allow_retry, e.created_at,
      (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id=e.id) AS attempts
     FROM exams e ORDER BY e.created_at DESC`
  ).all();
  return json({ exams: results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) return json({ error: "Somente o administrador pode criar provas." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const title = String(data.title || "").trim().slice(0, 140);
  const description = String(data.description || "").trim().slice(0, 1000);
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (!title || !questions.length || questions.length > 100) return json({ error: "Informe o título e as questões da prova." }, 400);
  let total = 0;
  for (const q of questions) {
    if (!q.text || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 ||
        !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) {
      return json({ error: "Há questão com enunciado, alternativas ou gabarito inválido." }, 400);
    }
    q.text = String(q.text).slice(0, 2000);
    q.options = q.options.map(v => String(v).slice(0, 700));
    q.points = Math.max(1, Math.min(10, Number(q.points) || 1));
    total += q.points;
  }
  const slug = slugify(title) + "-" + crypto.randomUUID().slice(0, 8);
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO exams (id,slug,title,description,questions_json,total_points,active,allow_retry,created_by_id,created_by_name,created_at,updated_at)
    VALUES (?,?,?,?,?,?,0,0,?,?,?,?)`).bind(id,slug,title,description,JSON.stringify(questions),total,auth.session.user.id,auth.session.user.name,now,now).run();
  return json({ exam: { id, slug, title, description, total_points: total, active: 0, link: new URL(request.url).origin + "/?prova=" + slug } }, 201);
}
