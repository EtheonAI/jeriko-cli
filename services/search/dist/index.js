import _ from "fastify";
import M from "typesense";
import { createLogger as J, getEnv as C } from "@repo/service-utils";
import {
  db as T,
  projects as I,
  agentSessions as O,
  messages as b,
  files as P,
  knowledgeItems as R,
  eq as q,
  and as E,
  desc as N,
  ilike as h,
  or as $,
} from "@repo/database";
var a = J({ service: "search" }),
  g = {
    FILES: "files",
    SESSIONS: "sessions",
    TASKS: "tasks",
    PROJECTS: "projects",
    ACTIONS: "actions",
  };
function D() {
  return new M.Client({
    nodes: [
      {
        host: C("TYPESENSE_HOST", "localhost"),
        port: parseInt(C("TYPESENSE_PORT", "8108"), 10),
        protocol: C("TYPESENSE_PROTOCOL", "http"),
      },
    ],
    apiKey: C("TYPESENSE_API_KEY", ""),
    connectionTimeoutSeconds: 5,
    retryIntervalSeconds: 0.1,
    numRetries: 3,
  });
}
var L = null;
function x() {
  return L || (L = D()), L;
}
async function B() {
  try {
    return (await x().health.retrieve()).ok === !0;
  } catch {
    return !1;
  }
}
async function k(w) {
  return x()
    .collections(w.collection)
    .documents()
    .search({
      q: w.query,
      query_by: w.queryBy,
      filter_by: w.filterBy,
      per_page: w.limit || 20,
      page: Math.floor((w.offset || 0) / (w.limit || 20)) + 1,
      highlight_full_fields: w.queryBy,
    });
}
function A(w, j, f, F) {
  return (w || []).map((r) => {
    let u = r.document,
      t = r.highlights?.[0]?.snippet;
    return {
      type: j,
      id: u.id,
      title: u[f] || "Untitled",
      preview: F ? u[F] : t || null,
      score: 1,
    };
  });
}
async function H() {
  let w = parseInt(C("PORT", "4013"), 10),
    j = C("HOST", "0.0.0.0"),
    f = _({ logger: !1, requestIdHeader: "x-request-id", genReqId: () => crypto.randomUUID() });
  f.get("/health", async () => ({ status: "ok", service: "search", typesense: await B() })),
    f.post("/search", async (r, u) => {
      let { query: t, types: o, userId: i, organizationId: c, limit: e, offset: n } = r.body,
        s = Math.min(e || 20, 100),
        p = n || 0,
        m = o || ["projects", "sessions", "files", "knowledge", "messages"];
      try {
        if (await B()) {
          let d = [],
            S = [];
          if (
            (m.includes("projects") &&
              S.push(
                k({
                  collection: g.PROJECTS,
                  query: t,
                  queryBy: "name,description",
                  filterBy: `userId:=${i}`,
                  limit: s,
                }).then((y) => {
                  d.push(...A(y.hits || [], "project", "name", "description"));
                })
              ),
            m.includes("sessions") &&
              S.push(
                k({
                  collection: g.SESSIONS,
                  query: t,
                  queryBy: "title",
                  filterBy: `userId:=${i}`,
                  limit: s,
                }).then((y) => {
                  d.push(...A(y.hits || [], "session", "title"));
                })
              ),
            m.includes("files") &&
              S.push(
                k({
                  collection: g.FILES,
                  query: t,
                  queryBy: "name,path",
                  filterBy: `userId:=${i}`,
                  limit: s,
                }).then((y) => {
                  d.push(...A(y.hits || [], "file", "name", "path"));
                })
              ),
            await Promise.allSettled(S),
            m.includes("messages"))
          ) {
            let y = `%${t}%`,
              l = await T.select().from(b).where(h(b.content, y)).limit(s);
            for (let v of l)
              d.push({
                type: "message",
                id: v.id,
                title: v.content.slice(0, 100),
                preview: v.content.slice(0, 200),
                score: 1,
              });
          }
          if (m.includes("knowledge")) {
            let y = `%${t}%`,
              l = await T.select()
                .from(R)
                .where(E(q(R.userId, i), $(h(R.name, y), h(R.content, y))))
                .limit(s);
            for (let v of l)
              d.push({
                type: "knowledge",
                id: v.id,
                title: v.name,
                preview: v.contentPreview,
                score: 1,
              });
          }
          return (
            a.info(
              { query: t, types: o, userId: i, resultCount: d.length, source: "typesense" },
              "Search executed"
            ),
            { query: t, results: d.slice(p, p + s), total: d.length, limit: s, offset: p }
          );
        }
      } catch (d) {
        a.warn(d, "Typesense search failed, falling back to DB");
      }
      try {
        let d = `%${t}%`,
          S = [];
        if (m.includes("projects")) {
          let y = await T.select()
            .from(I)
            .where(E(q(I.userId, i), $(h(I.name, d), h(I.description, d))))
            .limit(s);
          for (let l of y)
            S.push({ type: "project", id: l.id, title: l.name, preview: l.description, score: 1 });
        }
        if (m.includes("sessions")) {
          let y = await T.select()
            .from(O)
            .where(E(q(O.userId, i), h(O.title, d)))
            .limit(s);
          for (let l of y)
            S.push({
              type: "session",
              id: l.id,
              title: l.title || "Untitled",
              preview: null,
              score: 1,
            });
        }
        if (m.includes("messages")) {
          let y = await T.select().from(b).where(h(b.content, d)).limit(s);
          for (let l of y)
            S.push({
              type: "message",
              id: l.id,
              title: l.content.slice(0, 100),
              preview: l.content.slice(0, 200),
              score: 1,
            });
        }
        if (m.includes("files")) {
          let y = await T.select()
            .from(P)
            .where(E(q(P.userId, i), h(P.name, d)))
            .limit(s);
          for (let l of y)
            S.push({ type: "file", id: l.id, title: l.name, preview: l.path, score: 1 });
        }
        if (m.includes("knowledge")) {
          let y = await T.select()
            .from(R)
            .where(E(q(R.userId, i), $(h(R.name, d), h(R.content, d))))
            .limit(s);
          for (let l of y)
            S.push({
              type: "knowledge",
              id: l.id,
              title: l.name,
              preview: l.contentPreview,
              score: 1,
            });
        }
        return (
          a.info(
            { query: t, types: o, userId: i, resultCount: S.length, source: "db" },
            "Search executed"
          ),
          { query: t, results: S.slice(p, p + s), total: S.length, limit: s, offset: p }
        );
      } catch (d) {
        return (
          a.error(d, "Failed to execute search"),
          u.status(500).send({ error: "Failed to execute search" })
        );
      }
    }),
    f.post("/search/projects", async (r, u) => {
      let { query: t, userId: o, filters: i, limit: c } = r.body;
      try {
        if (await B()) {
          let e = await k({
            collection: g.PROJECTS,
            query: t,
            queryBy: "name,description",
            filterBy: `userId:=${o}`,
            limit: c || 20,
          });
          return { results: A(e.hits || [], "project", "name", "description"), total: e.found };
        }
      } catch (e) {
        a.warn(e, "Typesense project search failed, falling back to DB");
      }
      try {
        let e = `%${t}%`,
          n = await T.select()
            .from(I)
            .where(E(q(I.userId, o), $(h(I.name, e), h(I.description, e))))
            .orderBy(N(I.updatedAt))
            .limit(c || 20);
        return { results: n, total: n.length };
      } catch (e) {
        return (
          a.error(e, "Failed to search projects"),
          u.status(500).send({ error: "Failed to search projects" })
        );
      }
    }),
    f.post("/search/sessions", async (r, u) => {
      let { query: t, userId: o, projectId: i, limit: c } = r.body;
      try {
        if (await B()) {
          let e = await k({
            collection: g.SESSIONS,
            query: t,
            queryBy: "title",
            filterBy: `userId:=${o}`,
            limit: c || 20,
          });
          return { results: A(e.hits || [], "session", "title"), total: e.found };
        }
      } catch (e) {
        a.warn(e, "Typesense session search failed, falling back to DB");
      }
      try {
        let e = `%${t}%`,
          n = [q(O.userId, o), h(O.title, e)],
          s = await T.select()
            .from(O)
            .where(E(...n))
            .orderBy(N(O.updatedAt))
            .limit(c || 20);
        return { results: s, total: s.length };
      } catch (e) {
        return (
          a.error(e, "Failed to search sessions"),
          u.status(500).send({ error: "Failed to search sessions" })
        );
      }
    }),
    f.post("/search/messages", async (r, u) => {
      let { query: t, userId: o, sessionId: i, limit: c } = r.body;
      try {
        let e = `%${t}%`,
          n = [h(b.content, e)];
        i && n.push(q(b.sessionId, i));
        let s = await T.select()
          .from(b)
          .where(E(...n))
          .orderBy(N(b.createdAt))
          .limit(c || 20);
        return { results: s, total: s.length };
      } catch (e) {
        return (
          a.error(e, "Failed to search messages"),
          u.status(500).send({ error: "Failed to search messages" })
        );
      }
    }),
    f.post("/search/files", async (r, u) => {
      let { query: t, userId: o, projectId: i, mimeType: c, limit: e } = r.body;
      try {
        if (await B()) {
          let n = `userId:=${o}`;
          c && (n += ` && mimeType:=${c}`);
          let s = await k({
            collection: g.FILES,
            query: t,
            queryBy: "name,path",
            filterBy: n,
            limit: e || 20,
          });
          return { results: A(s.hits || [], "file", "name", "path"), total: s.found };
        }
      } catch (n) {
        a.warn(n, "Typesense file search failed, falling back to DB");
      }
      try {
        let n = `%${t}%`,
          s = [q(P.userId, o), h(P.name, n)];
        c && s.push(q(P.mimeType, c));
        let p = await T.select()
          .from(P)
          .where(E(...s))
          .orderBy(N(P.updatedAt))
          .limit(e || 20);
        return { results: p, total: p.length };
      } catch (n) {
        return (
          a.error(n, "Failed to search files"),
          u.status(500).send({ error: "Failed to search files" })
        );
      }
    }),
    f.post("/search/semantic", async (r, u) => {
      let { query: t, userId: o, scope: i, limit: c } = r.body;
      return { results: [], total: 0 };
    }),
    f.get("/suggest", async (r, u) => {
      let { q: t, types: o, userId: i, limit: c } = r.query;
      try {
        if (await B()) {
          let e = [],
            n = [];
          return (
            n.push(
              k({
                collection: g.PROJECTS,
                query: t,
                queryBy: "name",
                filterBy: `userId:=${i}`,
                limit: 5,
              }).then((s) => {
                for (let p of s.hits || []) {
                  let m = p.document;
                  e.push({ type: "project", id: m.id, title: m.name });
                }
              })
            ),
            n.push(
              k({
                collection: g.SESSIONS,
                query: t,
                queryBy: "title",
                filterBy: `userId:=${i}`,
                limit: 5,
              }).then((s) => {
                for (let p of s.hits || []) {
                  let m = p.document;
                  e.push({ type: "session", id: m.id, title: m.title || "Untitled" });
                }
              })
            ),
            n.push(
              k({
                collection: g.FILES,
                query: t,
                queryBy: "name",
                filterBy: `userId:=${i}`,
                limit: 5,
              }).then((s) => {
                for (let p of s.hits || []) {
                  let m = p.document;
                  e.push({ type: "file", id: m.id, title: m.name });
                }
              })
            ),
            await Promise.allSettled(n),
            { suggestions: e.slice(0, c || 10) }
          );
        }
      } catch (e) {
        a.warn(e, "Typesense suggest failed, falling back to DB");
      }
      try {
        let e = `%${t}%`,
          n = [],
          s = await T.select({ id: I.id, name: I.name })
            .from(I)
            .where(E(q(I.userId, i), h(I.name, e)))
            .limit(5);
        for (let p of s) n.push({ type: "project", id: p.id, title: p.name });
        return { suggestions: n.slice(0, c || 10) };
      } catch (e) {
        return (
          a.error(e, "Failed to generate suggestions"),
          u.status(500).send({ error: "Failed to generate suggestions" })
        );
      }
    }),
    f.post("/internal/index", async (r, u) => {
      let { type: t, id: o, data: i } = r.body;
      try {
        if (await B()) {
          let e = {
            project: g.PROJECTS,
            session: g.SESSIONS,
            file: g.FILES,
            task: g.TASKS,
            action: g.ACTIONS,
          }[t];
          if (e)
            return (
              await x()
                .collections(e)
                .documents()
                .upsert({ id: o, ...i }),
              a.info({ type: t, id: o }, "Entity indexed in Typesense"),
              { indexed: !0 }
            );
        }
      } catch (c) {
        a.warn({ type: t, id: o, error: c }, "Failed to index in Typesense");
      }
      return (
        a.info({ type: t, id: o }, "Entity indexed (no-op, Typesense unavailable)"), { indexed: !0 }
      );
    }),
    f.delete("/internal/index/:type/:id", async (r, u) => {
      let { type: t, id: o } = r.params;
      try {
        if (await B()) {
          let c = {
            project: g.PROJECTS,
            session: g.SESSIONS,
            file: g.FILES,
            task: g.TASKS,
            action: g.ACTIONS,
          }[t];
          if (c)
            return (
              await x().collections(c).documents(o).delete(),
              a.info({ type: t, id: o }, "Entity removed from Typesense"),
              { removed: !0 }
            );
        }
      } catch (i) {
        a.warn({ type: t, id: o, error: i }, "Failed to remove from Typesense");
      }
      return { removed: !0 };
    }),
    f.addHook("onRequest", async (r) => {
      a.info({ requestId: r.id, method: r.method, url: r.url }, "Incoming request");
    }),
    f.addHook("onResponse", async (r, u) => {
      a.info(
        { requestId: r.id, statusCode: u.statusCode, responseTime: u.elapsedTime },
        "Request completed"
      );
    });
  try {
    await f.listen({ port: w, host: j }), a.info({ port: w, host: j }, "Search service started");
  } catch (r) {
    a.error(r, "Failed to start server"), process.exit(1);
  }
  let F = ["SIGINT", "SIGTERM"];
  for (let r of F)
    process.on(r, async () => {
      a.info({ signal: r }, "Received shutdown signal"), await f.close(), process.exit(0);
    });
}
H();
