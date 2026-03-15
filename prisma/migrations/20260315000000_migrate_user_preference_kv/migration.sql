-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- Migrate existing data from UserScoringPreference to UserPreference
INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'showStudentNames',
    CASE WHEN "showStudentNames" = 1 THEN 'true' ELSE 'false' END,
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference";

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'autoScroll',
    CASE WHEN "autoScroll" = 1 THEN 'true' ELSE 'false' END,
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference";

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'itemsPerLine',
    CAST("itemsPerLine" AS TEXT),
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference";

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'layoutDirection',
    '"' || "layoutDirection" || '"',
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference";

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'expandMargin',
    CAST("expandMargin" AS TEXT),
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference";

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'selectionBorderColor',
    CASE WHEN "selectionBorderColor" IS NULL THEN 'null' ELSE '"' || "selectionBorderColor" || '"' END,
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference"
WHERE "selectionBorderColor" IS NOT NULL;

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'scoringStatusColors',
    "scoringStatusColors",
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference"
WHERE "scoringStatusColors" IS NOT NULL;

INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "userId",
    'scoringColorPresetId',
    '"' || "scoringColorPresetId" || '"',
    "createdAt",
    "updatedAt"
FROM "UserScoringPreference"
WHERE "scoringColorPresetId" IS NOT NULL;

-- DropTable
DROP TABLE "UserScoringPreference";
