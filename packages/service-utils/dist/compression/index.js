// src/compression/index.ts
var DEFAULT_MIME_TYPES = [
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/x-www-form-urlencoded",
  "image/svg+xml"
];
function compressionPlugin(config = {}) {
  const {
    threshold = 1024,
    mimeTypes = DEFAULT_MIME_TYPES,
    excludeRoutes = []
  } = config;
  return async (fastify) => {
    fastify.addHook("onSend", async (request, reply, payload) => {
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return payload;
      }
      if (!payload || reply.hasHeader("content-encoding")) {
        return payload;
      }
      const contentType = reply.getHeader("content-type");
      if (contentType && !mimeTypes.some((mt) => contentType.includes(mt))) {
        return payload;
      }
      const payloadSize = typeof payload === "string" ? Buffer.byteLength(payload) : payload instanceof Buffer ? payload.length : 0;
      if (payloadSize < threshold) {
        return payload;
      }
      const existingVary = reply.getHeader("vary");
      if (existingVary) {
        if (!existingVary.toLowerCase().includes("accept-encoding")) {
          reply.header("vary", `${existingVary}, Accept-Encoding`);
        }
      } else {
        reply.header("vary", "Accept-Encoding");
      }
      return payload;
    });
    fastify.log.info("Compression awareness plugin registered");
  };
}
function clientAcceptsCompression(acceptEncoding) {
  if (!acceptEncoding) {
    return { gzip: false, brotli: false, deflate: false };
  }
  const lower = acceptEncoding.toLowerCase();
  return {
    gzip: lower.includes("gzip"),
    brotli: lower.includes("br"),
    deflate: lower.includes("deflate")
  };
}
function getBestCompression(acceptEncoding) {
  const accepts = clientAcceptsCompression(acceptEncoding);
  if (accepts.brotli) return "br";
  if (accepts.gzip) return "gzip";
  if (accepts.deflate) return "deflate";
  return null;
}
var responseSize = {
  /**
   * Format bytes to human-readable string
   */
  format(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },
  /**
   * Calculate compression ratio
   */
  compressionRatio(original, compressed) {
    if (original === 0) return 0;
    return Number(((original - compressed) / original * 100).toFixed(2));
  }
};
export {
  clientAcceptsCompression,
  compressionPlugin,
  getBestCompression,
  responseSize
};
//# sourceMappingURL=index.js.map