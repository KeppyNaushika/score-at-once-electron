-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuestionGroupItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroupItem_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuestionGroupItem" ("createdAt", "id", "name", "questionGroupId", "updatedAt") SELECT "createdAt", "id", "name", "questionGroupId", "updatedAt" FROM "QuestionGroupItem";
DROP TABLE "QuestionGroupItem";
ALTER TABLE "new_QuestionGroupItem" RENAME TO "QuestionGroupItem";
CREATE INDEX "QuestionGroupItem_questionGroupId_idx" ON "QuestionGroupItem"("questionGroupId");
CREATE INDEX "QuestionGroupItem_questionGroupId_order_idx" ON "QuestionGroupItem"("questionGroupId", "order");
CREATE UNIQUE INDEX "QuestionGroupItem_questionGroupId_name_key" ON "QuestionGroupItem"("questionGroupId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
