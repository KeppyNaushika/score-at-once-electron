-- v0.3.0 機能G: localStorage → DB移行
-- v0.3.0 機能H: 設問別採点記号印字設定

-- CreateTable: UserPreference
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "selectionBorderColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: UserKeyboardShortcut
CREATE TABLE "UserKeyboardShortcut" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserKeyboardShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: UserScoringPreference
CREATE TABLE "UserScoringPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "showStudentNames" BOOLEAN NOT NULL DEFAULT true,
    "autoScroll" BOOLEAN NOT NULL DEFAULT true,
    "itemsPerLine" INTEGER NOT NULL DEFAULT 5,
    "layoutDirection" TEXT NOT NULL DEFAULT 'right-down',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserScoringPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ProjectMarkingFormat
CREATE TABLE "ProjectMarkingFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "markType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "fontSize" INTEGER,
    "strokeWidth" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMarkingFormat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ProjectExportSettings
CREATE TABLE "ProjectExportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectExportSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: CropRegionMarkingOverride
CREATE TABLE "CropRegionMarkingOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "markType" TEXT NOT NULL,
    "symbol" TEXT,
    "color" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionMarkingOverride_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: UserPreference
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex: UserKeyboardShortcut
CREATE UNIQUE INDEX "UserKeyboardShortcut_userId_action_key" ON "UserKeyboardShortcut"("userId", "action");
CREATE INDEX "UserKeyboardShortcut_userId_idx" ON "UserKeyboardShortcut"("userId");

-- CreateIndex: UserScoringPreference
CREATE UNIQUE INDEX "UserScoringPreference_userId_key" ON "UserScoringPreference"("userId");

-- CreateIndex: ProjectMarkingFormat
CREATE UNIQUE INDEX "ProjectMarkingFormat_projectId_markType_key" ON "ProjectMarkingFormat"("projectId", "markType");
CREATE INDEX "ProjectMarkingFormat_projectId_idx" ON "ProjectMarkingFormat"("projectId");

-- CreateIndex: ProjectExportSettings
CREATE UNIQUE INDEX "ProjectExportSettings_projectId_key" ON "ProjectExportSettings"("projectId");

-- CreateIndex: CropRegionMarkingOverride
CREATE UNIQUE INDEX "CropRegionMarkingOverride_cropRegionId_markType_key" ON "CropRegionMarkingOverride"("cropRegionId", "markType");
CREATE INDEX "CropRegionMarkingOverride_cropRegionId_idx" ON "CropRegionMarkingOverride"("cropRegionId");
