// src/cors/index.ts
var DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];
var DEFAULT_ALLOWED_HEADERS = [
  "Origin",
  "X-Requested-With",
  "Content-Type",
  "Accept",
  "Authorization",
  "X-API-Key",
  "X-Request-ID"
];
var DEFAULT_EXPOSED_HEADERS = [
  "X-Request-ID",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset"
];
function corsPlugin(config = {}) {
  const {
    origin = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    exposedHeaders = DEFAULT_EXPOSED_HEADERS,
    credentials = false,
    maxAge = 86400,
    preflightContinue = false,
    optionsSuccessStatus = 204
  } = config;
  return async (fastify) => {
    const isOriginAllowed = (requestOrigin) => {
      if (!requestOrigin) return false;
      if (origin === "*") {
        return credentials ? requestOrigin : "*";
      }
      if (typeof origin === "string") {
        return origin === requestOrigin ? requestOrigin : false;
      }
      if (Array.isArray(origin)) {
        return origin.includes(requestOrigin) ? requestOrigin : false;
      }
      if (typeof origin === "function") {
        return origin(requestOrigin) ? requestOrigin : false;
      }
      return false;
    };
    fastify.addHook("onRequest", async (request, reply) => {
      const requestOrigin = request.headers.origin;
      const allowedOrigin = isOriginAllowed(requestOrigin);
      if (allowedOrigin) {
        reply.header("Access-Control-Allow-Origin", allowedOrigin);
      }
      if (credentials) {
        reply.header("Access-Control-Allow-Credentials", "true");
      }
      if (exposedHeaders.length > 0) {
        reply.header("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      }
      const existingVary = reply.getHeader("Vary");
      if (existingVary) {
        if (!existingVary.toLowerCase().includes("origin")) {
          reply.header("Vary", `${existingVary}, Origin`);
        }
      } else {
        reply.header("Vary", "Origin");
      }
    });
    fastify.options("*", async (request, reply) => {
      const requestOrigin = request.headers.origin;
      const allowedOrigin = isOriginAllowed(requestOrigin);
      if (!allowedOrigin) {
        return reply.status(403).send({ error: "CORS not allowed" });
      }
      reply.header("Access-Control-Allow-Origin", allowedOrigin);
      reply.header("Access-Control-Allow-Methods", methods.join(", "));
      reply.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      reply.header("Access-Control-Max-Age", maxAge.toString());
      if (credentials) {
        reply.header("Access-Control-Allow-Credentials", "true");
      }
      if (preflightContinue) {
        return;
      }
      return reply.status(optionsSuccessStatus).send();
    });
    fastify.log.info("CORS plugin registered");
  };
}
var corsPresets = {
  /**
   * Allow all origins (development)
   */
  development: {
    origin: "*",
    credentials: false
  },
  /**
   * Strict same-origin (production default)
   */
  strict: {
    origin: (origin) => false,
    // Deny all cross-origin
    credentials: true
  },
  /**
   * Allow specific origins (production)
   */
  production: (allowedOrigins) => ({
    origin: allowedOrigins,
    credentials: true,
    methods: DEFAULT_METHODS
  }),
  /**
   * Allow subdomains of a domain
   */
  subdomains: (domain) => ({
    origin: (origin) => {
      const url = new URL(origin);
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    },
    credentials: true
  })
};
function createOriginValidator(patterns) {
  return (origin) => {
    return patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return origin === pattern;
      }
      return pattern.test(origin);
    });
  };
}
function parseOriginsFromEnv(envValue) {
  if (!envValue) return [];
  return envValue.split(",").map((o) => o.trim()).filter(Boolean);
}
export {
  corsPlugin,
  corsPresets,
  createOriginValidator,
  parseOriginsFromEnv
};
//# sourceMappingURL=index.js.map