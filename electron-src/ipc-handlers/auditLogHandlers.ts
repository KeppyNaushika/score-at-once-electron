/**
 * 監査ログ IPCハンドラー
 */

import {
  type AuditLogFilter,
  getAuditLogs,
  getAuditLogScopes,
} from "../lib/prisma/auditQuery"
import { type HandlerMap } from "./ipcHandlerUtils"

export const auditLogHandlers = {
  "audit:getLogs": async (
    filter: AuditLogFilter,
    limit: number,
    offset: number
  ) => {
    return await getAuditLogs(filter, limit, offset)
  },

  "audit:getScopes": async () => {
    return await getAuditLogScopes()
  },
} satisfies HandlerMap
