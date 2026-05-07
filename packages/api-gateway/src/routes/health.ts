import type { Router } from "express";
import { createHealthRoutes } from "@telehealth/shared";

// Gateway has no backing store of its own — readiness has no checks.
// Each upstream service owns its own /ready and is checked independently
// by the orchestrator. Pinging upstreams from the gateway would conflate
// gateway health with upstream health.
export const healthRouter: Router = createHealthRoutes({
  service: "api-gateway",
});
