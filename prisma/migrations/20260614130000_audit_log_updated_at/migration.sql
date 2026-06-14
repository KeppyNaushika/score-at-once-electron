-- AlterTable: 監査ログに updatedAt を追加。
-- 連続する同種操作の「集約」時に新規行を足さず既存行を上書き更新するため、
-- 最終更新時刻を保持する。LWW同期のタイムスタンプ列としても使用する。
-- 既存行は createdAt 相当（= 現在時刻のデフォルト）で初期化される。
ALTER TABLE "AuditLog" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuditLog_updatedAt_idx" ON "AuditLog"("updatedAt");
