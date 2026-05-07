import { Router, type Response } from "express";

// Liveness vs readiness:
//   /health  → process is up. No dependency checks. Cheap, always 200.
//             Used by orchestrators to decide "should I kill this pod?".
//   /ready   → process is up AND can serve traffic. Pings every dependency
//             passed in `ready`. Returns 503 if any check throws — the
//             orchestrator stops routing traffic here until it recovers.

export type ReadinessCheck = () => Promise<unknown>;

export interface HealthRoutesOptions {
  service: string;
  ready?: Record<string, ReadinessCheck>;
}

export function createHealthRoutes(opts: HealthRoutesOptions): Router {
  const router = Router();
  const startedAt = Date.now();
  const checks = opts.ready ?? {};
  const checkNames = Object.keys(checks);

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: opts.service,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  router.get("/ready", (_req, res, next) => {
    runReady(opts.service, checks, checkNames, res).catch(next);
  });

  return router;
}

async function runReady(
  service: string,
  checks: Record<string, ReadinessCheck>,
  checkNames: string[],
  res: Response,
): Promise<void> {
  const results: Record<string, "ok" | { error: string }> = {};
  let allOk = true;

  await Promise.all(
    checkNames.map(async (name) => {
      const check = checks[name];
      if (!check) return;
      try {
        await check();
        results[name] = "ok";
      } catch (err: unknown) {
        allOk = false;
        results[name] = {
          error: err instanceof Error ? err.message : "check failed",
        };
      }
    }),
  );

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "not_ready",
    service,
    checks: results,
  });
}
