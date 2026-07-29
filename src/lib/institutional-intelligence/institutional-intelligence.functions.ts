// Phase 49 — Public server-function surface for Institutional Intelligence.
import { createServerFn } from "@tanstack/react-start";
import { buildInstitutionalIntelligenceSnapshot } from "./snapshot.server";

export const getInstitutionalIntelligenceSnapshot = createServerFn({ method: "GET" })
  .handler(async () => {
    return buildInstitutionalIntelligenceSnapshot({});
  });