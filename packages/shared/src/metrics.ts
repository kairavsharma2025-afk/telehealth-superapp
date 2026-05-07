import { Router, type Request, type RequestHandler, type Response } from "express";
import client from "prom-client";

// Per-service Prometheus metrics:
//   - default Node metrics (event loop lag, GC, memory, CPU…)
//   - http_requests_total       counter,   labels: method, route, status_code
//   - http_request_duration_seconds histogram, same labels
//
// Cardinality:
//   `route` is the matched Express route pattern (e.g. /users/:id), NEVER
//   the raw URL — using the full path with IDs would explode the label
//   space. Unmatched paths (404s, proxy passthroughs in the gateway) are
//   bucketed as "unmatched" so they don't leak per-request labels either.

export interface MetricsOptions {
  service: string;
}

export interface MetricsBundle {
  middleware: RequestHandler;
  router: Router;
}

export function createMetrics(opts: MetricsOptions): MetricsBundle {
  const register = new client.Registry();
  register.setDefaultLabels({ service: opts.service });
  client.collectDefaultMetrics({ register });

  const requestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests handled",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  const requestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  const middleware: RequestHandler = (req, res, next) => {
    // Don't record the scrape endpoint itself — Prometheus polls it every
    // 15s and recording would just be self-noise.
    if (req.path === "/metrics") return next();

    const startNs = process.hrtime.bigint();
    res.on("finish", () => {
      const seconds = Number(process.hrtime.bigint() - startNs) / 1e9;
      const labels = {
        method: req.method,
        route: routeLabel(req),
        status_code: String(res.statusCode),
      };
      requestsTotal.inc(labels);
      requestDuration.observe(labels, seconds);
    });
    next();
  };

  const router = Router();
  router.get("/metrics", (_req: Request, res: Response, next) => {
    register
      .metrics()
      .then((body) => {
        res.set("Content-Type", register.contentType);
        res.send(body);
      })
      .catch(next);
  });

  return { middleware, router };
}

function routeLabel(req: Request): string {
  // req.route is set by Express only when a regular route handler matched.
  // baseUrl is the prefix at which that router was mounted (e.g. "/users").
  // Combined, they reconstruct the registered pattern (e.g. "/users/:id"),
  // which is bounded — exactly what we want for a metric label.
  // @types/express types req.route as `any`, so narrow explicitly.
  const route = req.route as { path?: unknown } | undefined;
  if (route && typeof route.path === "string") {
    const base = req.baseUrl || "";
    const path = route.path === "/" ? "" : route.path;
    return `${base}${path}` || "/";
  }
  // No route matched — could be a 404, or a gateway proxy passthrough
  // (http-proxy-middleware doesn't set req.route). Fall back to the first
  // segment of the URL so we still distinguish upstream prefixes
  // ("/auth/*", "/users/*", ...) without exploding cardinality on IDs.
  const url = req.originalUrl || req.url;
  const queryIdx = url.indexOf("?");
  const path = queryIdx >= 0 ? url.slice(0, queryIdx) : url;
  const segments = path.split("/").filter(Boolean);
  return segments[0] ? `/${segments[0]}/*` : "/";
}
