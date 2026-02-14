/**
 * API Proxy route — Manus parity.
 *
 * POST /apiproxy.v1.ApiProxyService/CallApi
 *
 * Receives calls from inside the sandbox (via data_api.py / rubic-mcp-cli),
 * validates the x-sandbox-token, resolves the userId, and routes to
 * Composio SDK via the connector service.
 *
 * This is the exact same endpoint path that Manus uses.
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { validateProxyToken } from '../lib/e2b-manager.js';

const callApiSchema = z.object({
  apiId: z.string(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  query: z.record(z.string(), z.unknown()).nullable().optional(),
  path_params: z.record(z.string(), z.unknown()).nullable().optional(),
  multipart_form_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const apiProxyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/apiproxy.v1.ApiProxyService/CallApi', async (request, reply) => {
    // Validate sandbox token and resolve to userId
    const token = request.headers['x-sandbox-token'] as string;
    if (!token) {
      return reply.status(401).send({ error: 'Missing x-sandbox-token header' });
    }

    // Resolve sandbox token → userId via the proxy token map
    const tokenInfo = validateProxyToken(token);
    if (!tokenInfo) {
      return reply.status(401).send({ error: 'Invalid sandbox token' });
    }

    // Parse body
    const parsed = callApiSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.issues,
      });
    }

    const { apiId, body, query, path_params } = parsed.data;

    // Route to connector service (Composio SDK)
    const connectorServiceUrl = process.env.CONNECTOR_SERVICE_URL || 'http://localhost:4009';

    try {
      // Connector service expects: POST /tools/execute with {toolName, arguments} and x-user-id header
      const response = await fetch(`${connectorServiceUrl}/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': tokenInfo.userId,
        },
        body: JSON.stringify({
          toolName: apiId,
          arguments: {
            ...(body || {}),
            ...(query ? { _query: query } : {}),
            ...(path_params ? { _pathParams: path_params } : {}),
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        return reply.status(response.status).send({
          error: `Connector service error: ${text}`,
        });
      }

      const result = await response.json();

      // Wrap in jsonData format (Manus compatibility)
      return {
        jsonData: JSON.stringify(result),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({
        error: `API proxy error: ${message}`,
      });
    }
  });
};
