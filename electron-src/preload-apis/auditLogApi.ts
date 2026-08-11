/**
 * 監査ログ Preload API
 */

import { bind } from "./invoke"

export function createAuditLogApi() {
  return {
    audit: {
      getLogs: bind("audit:getLogs"),

      getScopes: bind("audit:getScopes"),
    },
  }
}
