import { json, requireSession } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) {
    return json({ error: "Somente o administrador geral pode gerenciar acessos do RH." }, 403);
  }

  const { results } = await env.DB.prepare(
    `SELECT discord_id, display_name, granted_by_name, granted_at
     FROM hr_access ORDER BY display_name COLLATE NOCASE`
  ).all();

  return json({ users: results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) {
    return json({ error: "Somente o administrador geral pode liberar acesso ao RH." }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Os dados enviados são inválidos." }, 400);
  }

  const discordId = String(data.discord_id || "").trim();
  const displayName = String(data.display_name || "").trim().slice(0, 140);
  if (!/^\d{17,20}$/.test(discordId) || !displayName) {
    return json({ error: "Informe um nome e um ID Discord válido (17 a 20 números)." }, 400);
  }
  if (discordId === auth.session.user.id) {
    return json({ error: "O administrador geral já possui acesso ao RH." }, 400);
  }

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO hr_access (discord_id, display_name, granted_by_id, granted_by_name, granted_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(discord_id) DO UPDATE SET
         display_name = excluded.display_name,
         granted_by_id = excluded.granted_by_id,
         granted_by_name = excluded.granted_by_name,
         granted_at = excluded.granted_at`
    ).bind(discordId, displayName, auth.session.user.id, auth.session.user.name, now),
    env.DB.prepare(
      `INSERT INTO hr_access_audit
       (discord_id, display_name, action, actor_discord_id, actor_name, created_at)
       VALUES (?, ?, 'GRANTED', ?, ?, ?)`
    ).bind(discordId, displayName, auth.session.user.id, auth.session.user.name, now)
  ]);

  return json({ success: true, discord_id: discordId, display_name: displayName }, 201);
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) {
    return json({ error: "Somente o administrador geral pode remover acessos do RH." }, 403);
  }

  const url = new URL(request.url);
  const discordId = String(url.searchParams.get("id") || "").trim();
  if (!/^\d{17,20}$/.test(discordId)) {
    return json({ error: "ID Discord inválido." }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT discord_id, display_name FROM hr_access WHERE discord_id = ?"
  ).bind(discordId).first();
  if (!existing) return json({ error: "Acesso não encontrado." }, 404);

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM hr_access WHERE discord_id = ?").bind(discordId),
    env.DB.prepare(
      `INSERT INTO hr_access_audit
       (discord_id, display_name, action, actor_discord_id, actor_name, created_at)
       VALUES (?, ?, 'REVOKED', ?, ?, ?)`
    ).bind(discordId, existing.display_name, auth.session.user.id, auth.session.user.name, now)
  ]);

  return json({ success: true });
}
