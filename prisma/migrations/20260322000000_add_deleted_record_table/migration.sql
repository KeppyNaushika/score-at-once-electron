-- CreateTable
CREATE TABLE "DeletedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "examId" TEXT
);

-- CreateIndex
CREATE INDEX "DeletedRecord_examId_idx" ON "DeletedRecord"("examId");

-- CreateIndex
CREATE INDEX "DeletedRecord_deletedAt_idx" ON "DeletedRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeletedRecord_tableName_recordId_key" ON "DeletedRecord"("tableName", "recordId");
