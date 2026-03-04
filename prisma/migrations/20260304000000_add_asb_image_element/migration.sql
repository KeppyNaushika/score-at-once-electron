-- CreateTable
CREATE TABLE "AsbImageElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "imagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "objectFit" TEXT NOT NULL DEFAULT 'contain',
    "horizontalAlign" TEXT NOT NULL DEFAULT 'center',
    "verticalAlign" TEXT NOT NULL DEFAULT 'middle',
    "opacity" REAL NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbImageElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbImageElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AsbImageElement_subQuestionId_idx" ON "AsbImageElement"("subQuestionId");

-- CreateIndex
CREATE INDEX "AsbImageElement_branchQuestionId_idx" ON "AsbImageElement"("branchQuestionId");
