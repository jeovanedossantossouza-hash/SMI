import { json, requireSession } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const auth=await requireSession(request,env);
  if(auth.response)return auth.response;
  if(!auth.session.isAdmin)return json({error:"Acesso restrito ao administrador."},403);
  const {results}=await env.DB.prepare(`SELECT a.id,a.discord_id,a.discord_name,a.full_name,a.rg,a.score,a.total_points,a.correct_count,a.question_count,a.submitted_at,e.title AS exam_title,e.slug AS exam_slug
    FROM exam_attempts a JOIN exams e ON e.id=a.exam_id ORDER BY a.submitted_at DESC`).all();
  return json({results:results||[]});
}
