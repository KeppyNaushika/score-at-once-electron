-- 監査ログの「何に対する操作か」を子テーブルで持つ（docs/audit-log-redesign.md）。
--
-- 1行のログが複数の対象を持つ（採点は「生徒 × 採点領域」）ので、AuditLog の列ではなく
-- 子テーブルにする。対象側（targetId）には FK を張らない（対象が削除されてもログは残す）。
-- ログの側（auditLogId）には張り、保持期間を過ぎたログの整理で一緒に消えるようにする。
--
-- createdAt / updatedAt は sqlite-nas-sync が同期対象を検出するのに要る（id と updatedAt を
-- 持つ表が同期される）。
--
-- 既存のログへの対象の補完はしない。この移行は各端末が手元の DB へ別々に当てるので、
-- 乱数の id で埋めると同じログに端末の数だけ対象が付いて重なり、id をログから組み立てる
-- 形は id の方針（uuidv4）に反する。過去のログは記録時の metadata.target を表示に使う。
CREATE TABLE "AuditLogTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditLogId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditLogTarget_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AuditLogTarget_targetType_targetId_idx" ON "AuditLogTarget"("targetType", "targetId");

CREATE INDEX "AuditLogTarget_auditLogId_idx" ON "AuditLogTarget"("auditLogId");
