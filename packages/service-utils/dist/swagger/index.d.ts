import { FastifyPluginAsync } from 'fastify';

interface SwaggerConfig {
    title: string;
    description: string;
    version: string;
    basePath?: string;
    tags?: Array<{
        name: string;
        description: string;
    }>;
    servers?: Array<{
        url: string;
        description: string;
    }>;
    securitySchemes?: Record<string, {
        type: "http" | "apiKey" | "oauth2" | "openIdConnect";
        scheme?: string;
        bearerFormat?: string;
        name?: string;
        in?: "header" | "query" | "cookie";
        description?: string;
    }>;
}
interface RouteSchema {
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
declare function swaggerPlugin(config: SwaggerConfig): FastifyPluginAsync;
/**
 * Helper to create standard response schemas
 */
declare const responseSchemas: {
    success: <T extends Record<string, unknown>>(data: T) => {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                    const: boolean;
                };
                data: T;
            };
        };
    };
    created: <T extends Record<string, unknown>>(data: T) => {
        201: {
            type: string;
            properties: {
                success: {
                    type: string;
                    const: boolean;
                };
                data: T;
            };
        };
    };
    noContent: () => {
        204: {
            type: string;
            description: string;
        };
    };
    error: (statusCode: number, description: string) => {
        [x: number]: {
            $ref: string;
            description: string;
        };
    };
    paginated: <T extends Record<string, unknown>>(itemSchema: T) => {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                    const: boolean;
                };
                data: {
                    type: string;
                    items: T;
                };
                pagination: {
                    $ref: string;
                };
            };
        };
    };
};
/**
 * Common parameter schemas
 */
declare const paramSchemas: {
    id: {
        type: string;
        properties: {
            id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    pagination: {
        type: string;
        properties: {
            page: {
                type: string;
                minimum: number;
                default: number;
            };
            limit: {
                type: string;
                minimum: number;
                maximum: number;
                default: number;
            };
        };
    };
    search: {
        type: string;
        properties: {
            q: {
                type: string;
                description: string;
            };
            sort: {
                type: string;
                description: string;
            };
            order: {
                type: string;
                enum: string[];
                default: string;
            };
        };
    };
};

export { type RouteSchema, type SwaggerConfig, paramSchemas, responseSchemas, swaggerPlugin };
