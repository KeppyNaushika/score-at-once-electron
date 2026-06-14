-- CreateTable: 監査ログ（Discord風の操作履歴）。追記専用・不変。
-- 状態を変える全操作とエクスポートを記録する（閲覧は対象外）。
-- userIdはFKを張らず素の文字列とし、ユーザー削除後もログが残るようにする。
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeId" TEXT,
    "scopeLabel" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" TEXT
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- CreateIndex
CREATE INDEX "AuditLog_scopeId_idx" ON "AuditLog"("scopeId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
