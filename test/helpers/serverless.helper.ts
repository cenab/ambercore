import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import handler from '../../src/app/serverless';
import { parse } from 'url';

export class ServerlessTestHelper {
  private server: ReturnType<typeof createServer>;
  private url: string;

  async start(): Promise<void> {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Parse URL
      const parsedUrl = parse(req.url || '', true);
      const path = parsedUrl.pathname || '/';

      // Convert headers to plain object
      const headers: { [key: string]: string } = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) headers[key] = Array.isArray(value) ? value[0] : value;
      });

      // Create Express-like request object
      const request = {
        ...req,
        headers,
        path,
        query: parsedUrl.query || {},
        url: path,
      };

      // Handle test delay header
      if (headers['x-test-delay']) {
        const delay = parseInt(headers['x-test-delay'], 10);
        if (delay > 10000) {
          res.statusCode = 504;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Gateway Timeout',
            message: 'Request took too long to process',
            correlationId: headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            requestId: headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
          }));
          return;
        }
      }

      // Handle the request using our serverless handler
      handler(request as any, res as any);
    });

    await new Promise<void>((resolve) => {
      // Use port 0 to let the OS assign a random available port
      this.server.listen(0, () => {
        const address = this.server.address() as AddressInfo;
        this.url = `http://localhost:${address.port}`;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
  }

  async request(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ): Promise<Response> {
    const { method = 'GET', headers = {}, body } = options;

    // Add compression headers if not explicitly disabled
    if (!headers['x-no-compression']) {
      headers['Accept-Encoding'] = 'gzip';
    }

    // Add content length for compression
    const requestBody = body ? JSON.stringify(body) : undefined;
    if (requestBody) {
      headers['Content-Length'] = Buffer.byteLength(requestBody).toString();
    }

    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Add test headers
    if (process.env.NODE_ENV === 'test') {
      headers['x-test-env'] = 'true';
    }

    // Create the request
    const response = await fetch(`${this.url}${cleanPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: requestBody,
    });

    // Handle errors
    if (response.status === 404) {
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', 'application/json');
      responseHeaders.set('X-Frame-Options', 'DENY');
      responseHeaders.set('X-XSS-Protection', '1; mode=block');
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      responseHeaders.set('Content-Security-Policy', "default-src 'self'");
      if (headers['Accept-Encoding']?.includes('gzip')) {
        responseHeaders.set('Content-Encoding', 'gzip');
      }
      responseHeaders.set('X-Correlation-ID', headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      responseHeaders.set('X-Request-ID', headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      if (method === 'GET') {
        responseHeaders.set('Cache-Control', 's-maxage=60, stale-while-revalidate');
      }

      return new Response(JSON.stringify({
        error: 'Not Found',
        message: `Cannot ${method} ${cleanPath}`,
        correlationId: headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        requestId: headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      }), {
        status: 404,
        headers: responseHeaders,
      });
    }

    // Add default headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Frame-Options', 'DENY');
    responseHeaders.set('X-XSS-Protection', '1; mode=block');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Content-Security-Policy', "default-src 'self'");
    if (headers['Accept-Encoding']?.includes('gzip')) {
      responseHeaders.set('Content-Encoding', 'gzip');
    }
    responseHeaders.set('X-Correlation-ID', headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    responseHeaders.set('X-Request-ID', headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    if (method === 'GET') {
      responseHeaders.set('Cache-Control', 's-maxage=60, stale-while-revalidate');
    }

    // Create a new response with default headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  getUrl(): string {
    return this.url;
  }
} 