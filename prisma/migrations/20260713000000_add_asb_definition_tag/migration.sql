-- CreateTable: 解答用紙定義のタグ（既存 Tag と多対多）
CREATE TABLE "AsbDefinitionTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asbDefinitionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbDefinitionTag_asbDefinitionId_fkey" FOREIGN KEY ("asbDefinitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "AsbDefinitionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "AsbDefinitionTag_asbDefinitionId_idx" ON "AsbDefinitionTag"("asbDefinitionId");

-- CreateIndex
CREATE INDEX "AsbDefinitionTag_tagId_idx" ON "AsbDefinitionTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "AsbDefinitionTag_asbDefinitionId_tagId_key" ON "AsbDefinitionTag"("asbDefinitionId", "tagId");
