/**
 * 監査ログ IPCハンドラー
 */

import {
  type AuditLogQueryOptions,
  getAuditLogs,
  getAuditLogScopes,
} from "../lib/prisma/auditQuery"
import { registerHandler } from "./ipcHandlerUtils"

export function setupAuditLogHandlers(): void {
  registerHandler(
    "audit:getLogs",
    async (options: AuditLogQueryOptions = {}) => {
      return await getAuditLogs(options)
    }
  )

  registerHandler("audit:getScopes", async () => {
    return await getAuditLogScopes()
  })
}
