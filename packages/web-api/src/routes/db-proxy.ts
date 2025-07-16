import { Hono } from 'hono';

import { config } from '../config';

const dbProxyApp = new Hono();

// Helper to proxy requests to CouchDB
async function proxyCouchDBRequest(
  method: string,
  path: string,
  body?: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const couchdbUrl = config.getCouchDbUrl(path);
  const authHeader = config.getCouchDbAuthHeader();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authHeader) {
    requestHeaders['Authorization'] = authHeader;
  }

  try {
    const response = await fetch(couchdbUrl, {
      method,
      headers: requestHeaders,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });

    // Get response body
    const responseBody = await response.text();

    // Create response with CouchDB headers but filter out sensitive ones
    const filteredHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Filter out sensitive headers
      if (
        !key.toLowerCase().includes('authorization') &&
        !key.toLowerCase().includes('cookie') &&
        !key.toLowerCase().includes('set-cookie')
      ) {
        filteredHeaders.set(key, value);
      }
    });

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: filteredHeaders,
    });
  } catch (error) {
    console.error('CouchDB proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Database connection failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Proxy all database requests
dbProxyApp.all('/*', async (c) => {
  const path = c.req.path.replace('/api/db', '');
  const method = c.req.method;

  // Preserve query string
  const url = new URL(c.req.url);
  const queryString = url.search; // includes the '?' prefix
  const fullPath = `${path}${queryString}`;

  // Get request body for non-GET requests
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await c.req.text();
  }

  // Get relevant headers
  const headers: Record<string, string> = {};
  const contentType = c.req.header('Content-Type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  const response = await proxyCouchDBRequest(method, fullPath, body, headers);
  return response;
});

export { dbProxyApp as dbProxyRoutes };
