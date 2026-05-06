import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { IncomingMessage } from "node:http";

interface BuildProxyOpts {
  prefix: string;
  target: string;
}

export function buildProxy({ prefix, target }: BuildProxyOpts): RequestHandler {
  // http-proxy-middleware v3's handler is typed as Promise-returning, but
  // Express accepts it directly. Tsc agrees; ESLint's typed lint doesn't.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: (path) => path === prefix || path.startsWith(`${prefix}/`),
    on: {
      proxyReq: (proxyReq, req: IncomingMessage) => {
        const id = (req as IncomingMessage & { requestId?: string }).requestId;
        if (id) proxyReq.setHeader("x-request-id", id);
      },
    },
  });
}
