import { json, requireSession } from "../_shared/auth.js";

const ALLOWED_TYPES = new Set(["PDF", "DOCX", "XLSX", "Vídeo", "Imagem"]);
const ALLOWED_TAGS = new Set(["Normativo", "Rotina", "Processo", "Comunicação", "Gestão", "Crítico", "Obrigatório"]);

function hasPortalAccess(session) {
  return session.isAdmin || session.isHR || session.canEvaluate;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!hasPortalAccess(auth.session)) {
    return json({ error: "Você não tem autorização para consultar os materiais do SMI." }, 403);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, title, type, tag, size, link, created_by_name, created_at, updated_at
     FROM materials
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  ).all();

  return json({ materials: results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  if (!auth.session.isAdmin) {
    return json({ error: "Somente o administrador geral pode publicar materiais." }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Os dados enviados são inválidos." }, 400);
  }

  const title = String(data.title || "").trim().slice(0, 180);
  const type = String(data.type || "").trim();
  const tag = String(data.tag || "").trim();
  const size = String(data.size || "").trim().slice(0, 40);
  const link = String(data.link || "").trim().slice(0, 2048);

  if (!title || !size || !link) {
    return json({ error: "Preencha o título, tamanho e link do material." }, 400);
  }
  if (!ALLOWED_TYPES.has(type)) {
    return json({ error: "Tipo de material não permitido." }, 400);
  }
  if (!ALLOWED_TAGS.has(tag)) {
    return json({ error: "Categoria de material não permitida." }, 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch {
    return json({ error: "Informe um link válido para o arquivo." }, 400);
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return json({ error: "O link deve começar com https:// ou http://." }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const material = {
    id, title, type, tag, size, link,
    created_by_name: auth.session.user.name,
    created_at: now,
    updated_at: now
  };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO materials (
        id, title, type, tag, size, link,
        created_by_id, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, title, type, tag, size, link,
      auth.session.user.id, auth.session.user.name, now, now
    ),
    env.DB.prepare(
      `INSERT INTO materials_audit (
        material_id, action, actor_discord_id, actor_name,
        before_json, after_json, created_at
      ) VALUES (?, 'CREATED', ?, ?, NULL, ?, ?)`
    ).bind(id, auth.session.user.id, auth.session.user.name, JSON.stringify(material), now)
  ]);

  return json({ material }, 201);
}
