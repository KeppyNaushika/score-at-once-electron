/**
 * 監査ログ Preload API
 */

import type { AuditLogQueryOptions } from "../lib/prisma/auditQuery"
import { invoke } from "./invoke"

export function createAuditLogApi() {
  return {
    audit: {
      getLogs: (options?: AuditLogQueryOptions) =>
        invoke("audit:getLogs", options),

      getScopes: () => invoke("audit:getScopes"),
    },
  }
}
