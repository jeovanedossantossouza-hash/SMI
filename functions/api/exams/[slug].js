import { json, requireSession } from "../../_shared/auth.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  const exam = await env.DB.prepare("SELECT id,slug,title,description,questions_json,total_points,active,allow_retry FROM exams WHERE slug=?").bind(params.slug).first();
  if (!exam || !exam.active) return json({ error: "Esta prova não está disponível." }, 404);
  const previous = await env.DB.prepare("SELECT id,score,total_points,correct_count,question_count,submitted_at FROM exam_attempts WHERE exam_id=? AND discord_id=?").bind(exam.id,auth.session.user.id).first();
  if (previous && !exam.allow_retry) return json({ error: "Você já realizou esta prova.", alreadySubmitted: true, result: previous }, 409);
  const questions = JSON.parse(exam.questions_json).map((q,index)=>({ id:String(index+1), text:q.text, options:q.options, points:q.points }));
  return json({ exam:{ slug:exam.slug,title:exam.title,description:exam.description,total_points:exam.total_points,questions }, user:auth.session.user, previous: previous || null });
}

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) return json({ error: "Somente o administrador pode alterar o status da prova." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const active = data.active === true ? 1 : data.active === false ? 0 : null;
  if (active === null) return json({ error: "Informe o status da prova." }, 400);
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE exams SET active=?, updated_at=? WHERE slug=?").bind(active, now, params.slug).run();
  if (!result.meta?.changes) return json({ error: "Prova não encontrada." }, 404);
  return json({ exam: { slug: params.slug, active: Boolean(active), updated_at: now } });
}
