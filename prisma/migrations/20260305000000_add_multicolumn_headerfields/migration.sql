-- AlterTable
ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnCount" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnGapMm" REAL NOT NULL DEFAULT 5;
ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnDividerLine" TEXT;
ALTER TABLE "AsbDefinition" ADD COLUMN "multiColumnDividerLineWidth" REAL NOT NULL DEFAULT 0.3;

-- CreateTable
CREATE TABLE "AsbHeaderField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "widthMm" REAL NOT NULL DEFAULT 30,
    "heightMm" REAL NOT NULL DEFAULT 8,
    "gridCount" INTEGER NOT NULL DEFAULT 0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "lineWidth" REAL NOT NULL DEFAULT 0.4,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId");
