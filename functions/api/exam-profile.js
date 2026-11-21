import { json, requireSession } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const auth=await requireSession(request,env);
  if(auth.response)return auth.response;
  const profile=await env.DB.prepare("SELECT full_name,rg FROM exam_profiles WHERE discord_id=?").bind(auth.session.user.id).first();
  return json({profile:profile||null,discord:{id:auth.session.user.id,name:auth.session.user.name}});
}

export async function onRequestPost({ request, env }) {
  const auth=await requireSession(request,env);
  if(auth.response)return auth.response;
  let data;
  try{data=await request.json();}catch{return json({error:"Dados inválidos."},400);}
  const fullName=String(data.full_name||"").trim().slice(0,140);
  const rg=String(data.rg||"").trim().slice(0,40);
  if(fullName.length<3||rg.length<3)return json({error:"Informe nome completo e RG/matrícula."},400);
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO exam_profiles (discord_id,discord_name,full_name,rg,created_at,updated_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(discord_id) DO UPDATE SET discord_name=excluded.discord_name,full_name=excluded.full_name,rg=excluded.rg,updated_at=excluded.updated_at`)
    .bind(auth.session.user.id,auth.session.user.name,fullName,rg,now,now).run();
  return json({profile:{full_name:fullName,rg}});
}
