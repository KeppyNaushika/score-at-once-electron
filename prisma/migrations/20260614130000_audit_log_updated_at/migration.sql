-- AlterTable: 監査ログに updatedAt を追加。
-- 連続する同種操作の「集約」時に新規行を足さず既存行を上書き更新するため、
-- 最終更新時刻を保持する。LWW同期のタイムスタンプ列としても使用する。
--
-- SQLite は ALTER TABLE ADD COLUMN で CURRENT_TIMESTAMP のような非定数デフォルトを
-- 許可しないため、定数デフォルト（ISO text のエポック）で列を追加してから、
-- 既存行を createdAt（ISO text）で初期化する。新規行の値は Prisma の @updatedAt が
-- アプリ層で設定するため、定数デフォルトはフォールバックにとどまる。
ALTER TABLE "AuditLog" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

-- 既存行は createdAt 相当で初期化する。
UPDATE "AuditLog" SET "updatedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "AuditLog_updatedAt_idx" ON "AuditLog"("updatedAt");
