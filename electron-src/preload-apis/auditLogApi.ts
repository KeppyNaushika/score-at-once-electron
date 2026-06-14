/**
 * 監査ログ Preload API
 */

import { ipcRenderer } from "electron"

import type {
  AuditLogPage,
  AuditLogQueryOptions,
  AuditScopeFacet,
} from "../lib/prisma/auditQuery"

export function createAuditLogApi() {
  return {
    audit: {
      getLogs: (options?: AuditLogQueryOptions): Promise<AuditLogPage> =>
        ipcRenderer.invoke("audit:getLogs", options),

      getScopes: (): Promise<AuditScopeFacet[]> =>
        ipcRenderer.invoke("audit:getScopes"),
    },
  }
}
