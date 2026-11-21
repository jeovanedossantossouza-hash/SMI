import { json, requireSession } from "../../../_shared/auth.js";

export async function onRequestPost({ request, env, params }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  const exam = await env.DB.prepare("SELECT id,questions_json,total_points,active,allow_retry FROM exams WHERE slug=?").bind(params.slug).first();
  if (!exam || !exam.active) return json({ error: "Esta prova não está disponível." }, 404);
  let data;
  try { data = await request.json(); } catch { return json({ error: "Respostas inválidas." }, 400); }
  const fullName = String(data.full_name || "").trim().slice(0,140);
  const rg = String(data.rg || "").trim().slice(0,40);
  if (fullName.length < 3 || rg.length < 3) return json({ error: "Informe seu nome completo e RG/matrícula." }, 400);
  const questions = JSON.parse(exam.questions_json);
  const answers = data.answers && typeof data.answers === "object" ? data.answers : {};
  if (Object.keys(answers).length !== questions.length || questions.some((q,i)=>!Number.isInteger(Number(answers[String(i+1)])))) {
    return json({ error: "Responda todas as questões antes de enviar." }, 400);
  }
  const previous = await env.DB.prepare("SELECT id FROM exam_attempts WHERE exam_id=? AND discord_id=?").bind(exam.id,auth.session.user.id).first();
  if (previous && !exam.allow_retry) return json({ error: "Esta conta Discord já enviou uma resposta para esta prova." }, 409);
  let score=0, correct=0;
  questions.forEach((q,i)=>{ if(Number(answers[String(i+1)])===q.correct){score+=q.points;correct++;} });
  const now=new Date().toISOString(), id=crypto.randomUUID();
  if (previous && exam.allow_retry) {
    await env.DB.prepare("DELETE FROM exam_attempts WHERE id=?").bind(previous.id).run();
  }
  await env.DB.prepare(`INSERT INTO exam_attempts (id,exam_id,discord_id,discord_name,full_name,rg,answers_json,score,total_points,correct_count,question_count,submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,exam.id,auth.session.user.id,auth.session.user.name,fullName,rg,JSON.stringify(answers),score,exam.total_points,correct,questions.length,now).run();
  return json({ result:{ score,total_points:exam.total_points,correct_count:correct,question_count:questions.length,submitted_at:now } },201);
}
