import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { z } from "zod";
import { id, now, audit } from "./db.mjs";
import {
  presentationPlan,
  presentationBuffer,
  pptxMime,
} from "./canva-presentation.mjs";
export const canvaScopes = ["design:content:write", "design:meta:read"];
const base = "https://api.canva.com/rest/v1",
  UUID = z.string().uuid(),
  remoteId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  fail = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode }),
  hash = (v) => createHash("sha256").update(v).digest("hex");
export function canvaConfiguration(c) {
  const redirectUri = c.canvaRedirectUri || c.origin + "/api/canva/callback",
    missing = [];
  if (!c.canvaClientId) missing.push("CANVA_CLIENT_ID");
  if (!c.canvaClientSecret) missing.push("CANVA_CLIENT_SECRET");
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(c.canvaEncryptionKey || "") ||
    Buffer.from(c.canvaEncryptionKey, "base64").length !== 32
  )
    missing.push("CANVA_TOKEN_KEY (32 octets en base64)");
  try {
    const uri = new URL(redirectUri),
      origin = new URL(c.origin);
    if (
      uri.origin !== origin.origin ||
      uri.pathname !== "/api/canva/callback" ||
      uri.search ||
      uri.hash ||
      uri.username ||
      uri.password ||
      !(
        uri.protocol === "https:" ||
        (uri.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname))
      )
    )
      throw Error();
  } catch {
    missing.push(
      "CANVA_REDIRECT_URI / APP_ORIGIN (même origine, HTTPS ou boucle locale)",
    );
  }
  return {
    configured: missing.length === 0,
    redirectUri,
    scopes: canvaScopes,
    missing,
  };
}
export function sealCanva(c, owner, value) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(c.canvaEncryptionKey, "base64"),
      iv,
    );
  cipher.setAAD(Buffer.from(c.canvaClientId + ":" + owner));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unsealCanva(c, owner, value) {
  try {
    const [iv, tag, body] = value
        .split(".")
        .map((s) => Buffer.from(s, "base64url")),
      decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(c.canvaEncryptionKey, "base64"),
        iv,
      );
    decipher.setAAD(Buffer.from(c.canvaClientId + ":" + owner));
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(body), decipher.final()]).toString(),
    );
  } catch {
    throw fail(
      "Connexion Canva illisible. Déconnectez puis reconnectez votre compte.",
      409,
    );
  }
}
export function safeCanvaUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      ["www.canva.com", "canva.com"].includes(u.hostname) &&
      !u.port &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function registerCanva(app, { db, c, authorized }) {
  const locks = new Map();
  async function locked(userId, fn) {
    const previous = locks.get(userId) || Promise.resolve();
    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    locks.set(userId, barrier);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(userId) === barrier) locks.delete(userId);
    }
  }
  const ready = () => {
    if (!canvaConfiguration(c).configured)
      throw fail(
        "Configurez le connecteur Canva dans API & connexions. Le fichier PowerPoint reste disponible.",
        409,
      );
  };
  // No arbitrary host, redirects, token-bearing logs, or automatic POST retries.
  async function request(endpoint, options, expectEmpty = false) {
    let response;
    try {
      response = await (c.canvaFetcher || fetch)(base + endpoint, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw fail(
        "Canva ne répond pas. Si un envoi était en cours, vérifiez vos créations Canva avant de recommencer.",
        408,
      );
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if (response.status === 401)
        throw fail(
          "Votre connexion Canva a expiré. Reconnectez votre compte.",
          401,
        );
      if (response.status === 429)
        throw fail(
          "Canva limite momentanément les requêtes. Réessayez dans une minute.",
          429,
        );
      throw fail(
        "Canva a refusé la requête. Vérifiez les autorisations de l’application et votre compte Canva.",
        400,
      );
    }
    if (expectEmpty) {
      await response.body?.cancel().catch(() => {});
      return {};
    }
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw Error();
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      throw fail("Réponse Canva invalide ou trop volumineuse.", 400);
    }
  }
  const basic = () =>
    "Basic " +
    Buffer.from(c.canvaClientId + ":" + c.canvaClientSecret).toString("base64");
  async function exchange(params) {
    const data = await request("/oauth/token", {
      method: "POST",
      headers: {
        Authorization: basic(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
    const parsed = z
      .object({
        access_token: z.string().min(1).max(16384),
        refresh_token: z.string().min(1).max(16384),
        expires_in: z
          .number()
          .int()
          .positive()
          .max(365 * 86400),
        scope: z.string().max(4096),
      })
      .safeParse(data);
    if (
      !parsed.success ||
      !canvaScopes.every((s) => data.scope.split(" ").includes(s))
    )
      throw fail(
        "Autorisation Canva incomplète. Activez les deux permissions indiquées dans la configuration.",
      );
    return { ...parsed.data, expires_at: Date.now() + data.expires_in * 1000 };
  }
  async function token(userId) {
    ready();
    const row = db
      .prepare("SELECT * FROM canva_connections WHERE user_id=?")
      .get(userId);
    if (!row) throw fail("Connectez votre compte Canva avant l’envoi.", 409);
    let tokens = unsealCanva(c, userId, row.tokens);
    if (tokens.expires_at < Date.now() + 60_000) {
      tokens = await exchange({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      db.prepare("UPDATE canva_connections SET tokens=? WHERE user_id=?").run(
        sealCanva(c, userId, tokens),
        userId,
      );
    }
    return tokens.access_token;
  }
  const remote = async (userId, endpoint, options = {}) =>
    request(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: "Bearer " + (await token(userId)),
      },
    });
  const publicProject = (row) => ({
    id: row.id,
    animalId: row.animal_id,
    title: row.title,
    format: row.format,
    photoCount: row.photo_count,
    state: row.state,
    designs: JSON.parse(row.designs),
    error: row.error,
    createdAt: row.created_at,
  });
  const ownProject = (req) => {
    const row = db
      .prepare("SELECT * FROM canva_projects WHERE id=? AND user_id=?")
      .get(UUID.parse(req.params.id), req.user.id);
    if (!row) throw fail("Création Canva introuvable.", 404);
    return row;
  };
  function applyJob(row, raw) {
    const parsed = z
      .object({
        id: remoteId,
        status: z.enum(["in_progress", "success", "failed"]),
        result: z
          .object({
            designs: z
              .array(
                z.object({
                  id: remoteId,
                  title: z.string().max(200).optional(),
                }),
              )
              .max(20),
          })
          .optional(),
      })
      .safeParse(raw);
    if (
      !parsed.success ||
      (row.remote_job && parsed.data.id !== row.remote_job)
    )
      throw fail("Résultat d’import Canva invalide.");
    const job = parsed.data;
    if (job.status === "success" && !job.result?.designs.length)
      throw fail("Canva n’a retourné aucune création.");
    db.prepare(
      "UPDATE canva_projects SET remote_job=?,state=?,designs=?,error=?,checked_at=? WHERE id=?",
    ).run(
      job.id,
      job.status,
      JSON.stringify(job.result?.designs || []),
      job.status === "failed"
        ? "Canva n’a pas pu importer ce pré-design. Le PowerPoint reste téléchargeable."
        : "",
      now(),
      row.id,
    );
    return publicProject(
      db.prepare("SELECT * FROM canva_projects WHERE id=?").get(row.id),
    );
  }
  db.prepare(
    "UPDATE canva_projects SET state='interrupted',error='Envoi interrompu. Vérifiez vos créations Canva avant un nouvel envoi.' WHERE state='sending'",
  ).run();
  app.get("/api/canva/status", { preHandler: authorized() }, async (req) => {
    const cfg = canvaConfiguration(c),
      connection = db
        .prepare("SELECT connected_at FROM canva_connections WHERE user_id=?")
        .get(req.user.id);
    return {
      ...cfg,
      connected: !!connection,
      connectedAt: connection?.connected_at || null,
    };
  });
  app.post(
    "/api/canva/connect",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      ready();
      const { animalId } = z
        .object({ animalId: UUID.optional() })
        .parse(req.body || {});
      if (
        animalId &&
        !db.prepare("SELECT 1 FROM animals WHERE id=?").get(animalId)
      )
        throw fail("Animal introuvable.", 404);
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(64).toString("base64url"),
        stateHash = hash(state);
      db.prepare(
        "DELETE FROM canva_oauth WHERE expires_at<? OR session_hash=?",
      ).run(now(), req.user.token_hash);
      db.prepare("INSERT INTO canva_oauth VALUES (?,?,?,?,?,?)").run(
        stateHash,
        req.user.id,
        req.user.token_hash,
        sealCanva(c, stateHash, verifier),
        animalId || null,
        new Date(Date.now() + 600_000).toISOString(),
      );
      const params = new URLSearchParams({
        client_id: c.canvaClientId,
        response_type: "code",
        scope: canvaScopes.join(" "),
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "s256",
        state,
        redirect_uri: canvaConfiguration(c).redirectUri,
      });
      reply.setCookie("anipic_canva_return", req.cookies.anipic_session, {
        path: "/api/canva/callback",
        httpOnly: true,
        sameSite: "lax",
        secure: c.secureCookie,
        maxAge: 600,
      });
      return { url: "https://www.canva.com/api/oauth/authorize?" + params };
    },
  );
  app.get(
    "/api/canva/callback",
    {
      preHandler: [
        async (req, reply) => {
          reply.clearCookie("anipic_canva_return", {
            path: "/api/canva/callback",
            httpOnly: true,
            sameSite: "lax",
            secure: c.secureCookie,
          });
        },
        authorized(),
      ],
      logLevel: "silent",
    },
    async (req, reply) => {
      reply.header("Referrer-Policy", "no-referrer");
      const { state, code, error } = z
        .object({
          state: z.string().min(20).max(200),
          code: z.string().min(1).max(4096).optional(),
          error: z.string().max(200).optional(),
        })
        .parse(req.query);
      const stateHash = hash(state),
        record = db
          .prepare(
            "SELECT * FROM canva_oauth WHERE state_hash=? AND user_id=? AND session_hash=? AND expires_at>?",
          )
          .get(stateHash, req.user.id, req.user.token_hash, now());
      if (!record)
        throw fail(
          "Connexion Canva expirée ou déjà utilisée. Relancez la connexion.",
        );
      db.prepare("DELETE FROM canva_oauth WHERE state_hash=?").run(stateHash);
      let result = "denied";
      if (!error && code) {
        try {
          await locked(req.user.id, async () => {
            ready();
            const tokens = await exchange({
              grant_type: "authorization_code",
              code,
              code_verifier: unsealCanva(c, stateHash, record.verifier),
              redirect_uri: canvaConfiguration(c).redirectUri,
            });
            db.prepare(
              "INSERT INTO canva_connections VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET tokens=excluded.tokens,connected_at=excluded.connected_at",
            ).run(req.user.id, sealCanva(c, req.user.id, tokens), now());
            audit(db, req.user, "canva_connected");
          });
          result = "connected";
        } catch {
          result = "failed";
        }
      }
      return reply.redirect(
        `/?canva=${result}#${record.animal_id ? "canva/" + record.animal_id : "api"}`,
      );
    },
  );
  app.delete(
    "/api/canva/connection",
    { preHandler: authorized() },
    async (req) =>
      locked(req.user.id, async () => {
        const row = db
          .prepare("SELECT * FROM canva_connections WHERE user_id=?")
          .get(req.user.id);
        let revoked = !row;
        try {
          if (row && canvaConfiguration(c).configured) {
            const tokens = unsealCanva(c, req.user.id, row.tokens);
            await request(
              "/oauth/revoke",
              {
                method: "POST",
                headers: {
                  Authorization: basic(),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  token: tokens.refresh_token,
                }).toString(),
              },
              true,
            );
            revoked = true;
          }
        } catch {
          /* Always remove local access, including with an unavailable provider or changed key. */
        }
        db.prepare("DELETE FROM canva_connections WHERE user_id=?").run(
          req.user.id,
        );
        db.prepare("DELETE FROM canva_oauth WHERE user_id=?").run(req.user.id);
        audit(db, req.user, "canva_disconnected", { revoked });
        return { ok: true, revoked };
      }),
  );
  app.post("/api/canva/plan", { preHandler: authorized() }, async (req) => {
    const plan = presentationPlan(db, req.body);
    return {
      pages: plan.pages,
      facts: plan.facts,
      photoCount: plan.photos.length,
    };
  });
  let building = 0;
  async function build(body) {
    if (building >= 2)
      throw fail(
        "Deux présentations sont déjà en préparation. Réessayez dans quelques instants.",
        429,
      );
    building++;
    try {
      const plan = presentationPlan(db, body);
      return { plan, buffer: await presentationBuffer(c, plan) };
    } finally {
      building--;
    }
  }
  app.post(
    "/api/canva/presentation",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { plan, buffer } = await build(req.body);
      audit(db, req.user, "canva_pptx_downloaded", {
        animalId: plan.animal.id,
        photos: plan.photos.length,
      });
      return reply
        .type(pptxMime)
        .header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(plan.facts.name + "-" + plan.options.format + ".pptx")}`,
        )
        .send(buffer);
    },
  );
  app.post(
    "/api/canva/projects",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) =>
      locked(req.user.id, async () => {
        ready();
        await token(req.user.id);
        const { plan, buffer } = await build(req.body),
          project = { id: id(), remote_job: null },
          title = Array.from(plan.facts.name + " · " + plan.options.format)
            .slice(0, 50)
            .join("");
        db.prepare(
          "INSERT INTO canva_projects(id,user_id,animal_id,title,format,photo_count,state,created_at) VALUES (?,?,?,?,?,?,'sending',?)",
        ).run(
          project.id,
          req.user.id,
          plan.animal.id,
          title,
          plan.options.format,
          plan.photos.length,
          now(),
        );
        try {
          const response = await remote(req.user.id, "/imports", {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "Import-Metadata": JSON.stringify({
                title_base64: Buffer.from(title).toString("base64"),
                mime_type: pptxMime,
              }),
            },
            body: buffer,
          });
          const result = applyJob(project, response.job);
          audit(db, req.user, "canva_import_started", {
            animalId: plan.animal.id,
            projectId: project.id,
            photos: plan.photos.length,
          });
          return reply.code(201).send(result);
        } catch (e) {
          db.prepare(
            "UPDATE canva_projects SET state='interrupted',error=? WHERE id=?",
          ).run(
            "Réponse d’envoi non confirmée. Vérifiez vos créations Canva avant de recommencer.",
            project.id,
          );
          throw e;
        }
      }),
  );
  app.get("/api/canva/projects", { preHandler: authorized() }, async (req) => {
    const { animalId } = z.object({ animalId: UUID }).parse(req.query);
    return {
      items: db
        .prepare(
          "SELECT * FROM canva_projects WHERE user_id=? AND animal_id=? ORDER BY created_at DESC LIMIT 30",
        )
        .all(req.user.id, animalId)
        .map(publicProject),
    };
  });
  app.get(
    "/api/canva/projects/:id",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
    },
    async (req) =>
      locked(req.user.id, async () => {
        const row = ownProject(req);
        if (
          row.state !== "in_progress" ||
          (row.checked_at && Date.now() - Date.parse(row.checked_at) < 2400)
        )
          return publicProject(row);
        const response = await remote(
          req.user.id,
          "/imports/" + remoteId.parse(row.remote_job),
        );
        return applyJob(row, response.job);
      }),
  );
  app.post(
    "/api/canva/projects/:id/open",
    { preHandler: authorized() },
    async (req) =>
      locked(req.user.id, async () => {
        const row = ownProject(req),
          { designId } = z.object({ designId: remoteId }).parse(req.body);
        if (!JSON.parse(row.designs).some((d) => d.id === designId))
          throw fail("Création Canva introuvable.", 404);
        const response = await remote(req.user.id, "/designs/" + designId),
          url = safeCanvaUrl(response.design?.urls?.edit_url);
        if (!url || response.design?.id !== designId)
          throw fail("Lien d’édition Canva invalide.");
        return { url };
      }),
  );
  app.get(
    "/api/canva/projects/:id/edit/:designId",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) =>
      locked(req.user.id, async () => {
        const row = ownProject(req),
          designId = remoteId.parse(req.params.designId);
        if (!JSON.parse(row.designs).some((d) => d.id === designId))
          throw fail("Création Canva introuvable.", 404);
        const response = await remote(req.user.id, "/designs/" + designId),
          url = safeCanvaUrl(response.design?.urls?.edit_url);
        if (!url || response.design?.id !== designId)
          throw fail("Lien d’édition Canva invalide.");
        reply.header("Referrer-Policy", "no-referrer");
        return reply.redirect(url);
      }),
  );
}
