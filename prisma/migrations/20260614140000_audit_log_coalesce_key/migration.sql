-- AlterTable: 監査ログの集約キーを列化（メタデータJSON内からカラムへ昇格）。
-- 同一キーの行を時間窓内で一致検索するため、インデックス付きの専用カラムにする。
ALTER TABLE "AuditLog" ADD COLUMN "coalesceKey" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_coalesceKey_idx" ON "AuditLog"("coalesceKey");
