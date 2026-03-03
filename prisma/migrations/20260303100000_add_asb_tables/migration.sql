-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '新しい解答用紙',
    "renderMode" TEXT NOT NULL DEFAULT 'answer-sheet',
    "labelPresetMajor" TEXT,
    "labelPresetSub" TEXT,
    "labelPresetBranch" TEXT,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "baseRowHeight" REAL NOT NULL DEFAULT 12,
    "numberDisplayMode" TEXT NOT NULL DEFAULT 'multirow',
    "marginTop" REAL NOT NULL DEFAULT 15,
    "marginBottom" REAL NOT NULL DEFAULT 15,
    "marginLeft" REAL NOT NULL DEFAULT 10,
    "marginRight" REAL NOT NULL DEFAULT 10,
    "colWidthMajorNumber" REAL NOT NULL DEFAULT 10,
    "colWidthSubNumber" REAL NOT NULL DEFAULT 10,
    "colWidthBranchNumber" REAL NOT NULL DEFAULT 10,
    "majorQuestionSpacing" REAL NOT NULL DEFAULT 5,
    "headerHeight" REAL NOT NULL DEFAULT 0,
    "borderOuterBorder" TEXT NOT NULL DEFAULT 'solid',
    "borderMajorDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchDivider" TEXT NOT NULL DEFAULT 'dashed',
    "borderMajorNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderOuterBorderWidth" REAL DEFAULT 0.7,
    "borderMajorDividerWidth" REAL DEFAULT 0.5,
    "borderSubDividerWidth" REAL DEFAULT 0.4,
    "borderBranchDividerWidth" REAL DEFAULT 0.3,
    "borderMajorNumberDividerWidth" REAL DEFAULT 0.4,
    "borderSubNumberDividerWidth" REAL DEFAULT 0.4,
    "borderBranchNumberDividerWidth" REAL DEFAULT 0.3,
    "omrMarkersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "omrMarkersSizeMm" REAL NOT NULL DEFAULT 5,
    "omrMarkersOffsetMm" REAL NOT NULL DEFAULT 3,
    "fontFamily" TEXT NOT NULL DEFAULT 'Noto Sans JP',
    "fontDefaultSize" REAL NOT NULL DEFAULT 6,
    "fontMajorNumberSize" REAL NOT NULL DEFAULT 6,
    "fontSubNumberSize" REAL NOT NULL DEFAULT 6,
    "fontBranchNumberSize" REAL NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AsbDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbMajorQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbMajorQuestion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbSubQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "majorQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "heightMultiplier" REAL NOT NULL DEFAULT 1,
    "points" REAL NOT NULL DEFAULT 1,
    "usesBranchPoints" BOOLEAN,
    "layoutWidth" TEXT,
    "nextPlacement" TEXT,
    "goUp" INTEGER,
    "manuscriptEnabled" BOOLEAN NOT NULL DEFAULT false,
    "manuscriptColumns" INTEGER NOT NULL DEFAULT 20,
    "manuscriptRows" INTEGER NOT NULL DEFAULT 10,
    "manuscriptCellSizeMm" REAL NOT NULL DEFAULT 8,
    "borderStyleTop" TEXT,
    "borderStyleBottom" TEXT,
    "borderStyleLeft" TEXT,
    "borderStyleRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbSubQuestion_majorQuestionId_fkey" FOREIGN KEY ("majorQuestionId") REFERENCES "AsbMajorQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbBranchQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "heightMultiplier" REAL NOT NULL DEFAULT 1,
    "points" REAL NOT NULL DEFAULT 1,
    "layoutWidth" TEXT,
    "nextPlacement" TEXT,
    "goUp" INTEGER,
    "borderStyleTop" TEXT,
    "borderStyleBottom" TEXT,
    "borderStyleLeft" TEXT,
    "borderStyleRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbBranchQuestion_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbTextElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "text" TEXT NOT NULL,
    "fontSize" REAL NOT NULL,
    "horizontalAlign" TEXT NOT NULL DEFAULT 'left',
    "verticalAlign" TEXT NOT NULL DEFAULT 'top',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbTextElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbTextElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "numDigits" INTEGER,
    "correctAnswer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AsbOmrChoiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "AsbOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AsbDefinition_userId_idx" ON "AsbDefinition"("userId");
CREATE INDEX IF NOT EXISTS "AsbMajorQuestion_definitionId_idx" ON "AsbMajorQuestion"("definitionId");
CREATE INDEX IF NOT EXISTS "AsbSubQuestion_majorQuestionId_idx" ON "AsbSubQuestion"("majorQuestionId");
CREATE INDEX IF NOT EXISTS "AsbBranchQuestion_subQuestionId_idx" ON "AsbBranchQuestion"("subQuestionId");
CREATE INDEX IF NOT EXISTS "AsbTextElement_subQuestionId_idx" ON "AsbTextElement"("subQuestionId");
CREATE INDEX IF NOT EXISTS "AsbTextElement_branchQuestionId_idx" ON "AsbTextElement"("branchQuestionId");
CREATE INDEX IF NOT EXISTS "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId");
CREATE INDEX IF NOT EXISTS "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId");
CREATE INDEX IF NOT EXISTS "AsbOmrChoiceOption_omrConfigId_idx" ON "AsbOmrChoiceOption"("omrConfigId");
CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AsbOmrChoiceOption_omrConfigId_choiceIndex_key" ON "AsbOmrChoiceOption"("omrConfigId", "choiceIndex");
