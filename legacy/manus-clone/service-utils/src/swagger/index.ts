import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  basePath?: string;
  tags?: Array<{ name: string; description: string }>;
  servers?: Array<{ url: string; description: string }>;
  securitySchemes?: Record<
    string,
    {
      type: "http" | "apiKey" | "oauth2" | "openIdConnect";
      scheme?: string;
      bearerFormat?: string;
      name?: string;
      in?: "header" | "query" | "cookie";
      description?: string;
    }
  >;
}

export interface RouteSchema {
  summary?: string;
  description?: string;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
  body?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  response?: Record<number, Record<string, unknown>>;
}

/**
 * Create a Fastify plugin for Swagger/OpenAPI documentation
 * This is a lightweight wrapper - use @fastify/swagger for full implementation
 */
export function swaggerPlugin(config: SwaggerConfig): FastifyPluginAsync {
  return async (fastify: FastifyInstance) => {
    const openApiSpec = generateOpenApiSpec(config, fastify);

    // Serve OpenAPI JSON spec
    fastify.get("/openapi.json", async (_request, reply) => {
      return reply.send(openApiSpec);
    });

    // Serve basic Swagger UI HTML
    fastify.get("/docs", async (_request, reply) => {
      const html = generateSwaggerUI(config.title);
      return reply.type("text/html").send(html);
    });

    fastify.log.info(`API documentation available at /docs`);
  };
}

function generateOpenApiSpec(
  config: SwaggerConfig,
  _fastify: FastifyInstance
): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: config.title,
      description: config.description,
      version: config.version,
    },
    servers: config.servers || [
      { url: "http://localhost:4001", description: "Local development" },
    ],
    tags: config.tags || [],
    paths: {},
    components: {
      securitySchemes: config.securitySchemes || {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Authorization header using the Bearer scheme",
        },
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API Key for service-to-service authentication",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
            statusCode: { type: "integer" },
            message: { type: "string" },
            details: { type: "object" },
          },
          required: ["error", "message"],
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
            timestamp: { type: "string", format: "date-time" },
            uptime: { type: "number" },
            checks: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  latency: { type: "number" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function generateSwaggerUI(title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
`;
}

/**
 * Helper to create standard response schemas
 */
export const responseSchemas = {
  success: <T extends Record<string, unknown>>(data: T) => ({
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data,
      },
    },
  }),

  created: <T extends Record<string, unknown>>(data: T) => ({
    201: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data,
      },
    },
  }),

  noContent: () => ({
    204: {
      type: "null",
      description: "No content",
    },
  }),

  error: (statusCode: number, description: string) => ({
    [statusCode]: {
      $ref: "#/components/schemas/Error",
      description,
    },
  }),

  paginated: <T extends Record<string, unknown>>(itemSchema: T) => ({
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "array",
          items: itemSchema,
        },
        pagination: { $ref: "#/components/schemas/Pagination" },
      },
    },
  }),
};

/**
 * Common parameter schemas
 */
export const paramSchemas = {
  id: {
    type: "object",
    properties: {
      id: { type: "string", description: "Resource ID" },
    },
    required: ["id"],
  },

  pagination: {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
  },

  search: {
    type: "object",
    properties: {
      q: { type: "string", description: "Search query" },
      sort: { type: "string", description: "Sort field" },
      order: { type: "string", enum: ["asc", "desc"], default: "asc" },
    },
  },
};
