/**
 * 監査ログ IPCハンドラー
 */

import {
  type AuditLogQueryOptions,
  getAuditLogs,
  getAuditLogScopes,
} from "../lib/prisma/auditQuery"
import { type HandlerMap } from "./ipcHandlerUtils"

export const auditLogHandlers = {
  "audit:getLogs": async (options: AuditLogQueryOptions = {}) => {
    return await getAuditLogs(options)
  },

  "audit:getScopes": async () => {
    return await getAuditLogScopes()
  },
} satisfies HandlerMap
