export const ADMIN_USER_ID = "552947639025401888";
export const GUILD_ID = "1329544134272356512";
export const ALLOWED_ROLE_IDS = [
  "1329545094163988510",
  "1412247141505699981"
];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function getPortalSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return { error: json({ error: "Autenticação necessária." }, 401) };
  }

  const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: authorization }
  });
  if (!userResponse.ok) {
    return { error: json({ error: "Sessão do Discord inválida ou expirada." }, 401) };
  }

  const user = await userResponse.json();
  const isAdmin = user.id === ADMIN_USER_ID;
  let member = null;

  if (!isAdmin) {
    const memberResponse = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: authorization } }
    );

    if (memberResponse.ok) {
      member = await memberResponse.json();
    } else if (memberResponse.status !== 404) {
      return { error: json({ error: "Não foi possível validar seus cargos no servidor SMI." }, 502) };
    }
  }

  const hr = isAdmin ? null : await env.DB
    .prepare("SELECT discord_id FROM hr_access WHERE discord_id = ?")
    .bind(user.id)
    .first();

  const isHR = isAdmin || Boolean(hr);
  const canEvaluate = isAdmin || isHR || Boolean(
    member?.roles?.some(roleId => ALLOWED_ROLE_IDS.includes(roleId))
  );

  return {
    user: {
      id: user.id,
      name: user.global_name || user.username || "Usuário Discord"
    },
    isAdmin,
    isHR,
    canEvaluate
  };
}

export async function requireSession(request, env) {
  const session = await getPortalSession(request, env);
  if (session.error) return { response: session.error };
  return { session };
}

export function requireAdmin(session) {
  return session.isAdmin;
}
