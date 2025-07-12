-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "classCode" TEXT,
    "grade" INTEGER,
    "description" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastNameKana" TEXT NOT NULL,
    "firstNameKana" TEXT NOT NULL,
    "enrollmentYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentClassMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "attendanceNumber" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARTICIPATING',
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStudent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradingAssignment" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "userId"),
    CONSTRAINT "GradingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradingAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LayoutRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "masterImageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroupItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroupItem_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtotalDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubtotalDefinition_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubtotalDefinition_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionSubtotalAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionLayoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionSubtotalAssignment_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionSubtotalAssignment_questionLayoutRegionId_fkey" FOREIGN KEY ("questionLayoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "originalImagePath" TEXT NOT NULL,
    "processedImagePath" TEXT,
    "scoredPdfPath" TEXT,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" REAL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnswerSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partLabel" TEXT NOT NULL DEFAULT '',
    "partScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionPart_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPart_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPartScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionPartId" TEXT NOT NULL,
    "answerSheetId" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionPartScore_questionPartId_fkey" FOREIGN KEY ("questionPartId") REFERENCES "QuestionPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "excelOutputPath" TEXT,
    "pdfOutputPath" TEXT,
    "finalizedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoreRecord_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineIdentifier" TEXT,
    "sessionStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEndedAt" DATETIME,
    CONSTRAINT "ProjectSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "locks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lockedResourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "locks_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ClassTeachers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ClassTeachers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClassTeachers_A_fkey" FOREIGN KEY ("A") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classId_attendanceNumber_idx" ON "StudentClassMembership"("classId", "attendanceNumber");

-- CreateIndex
CREATE INDEX "MasterImage_projectId_idx" ON "MasterImage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterImage_projectId_pageNumber_key" ON "MasterImage"("projectId", "pageNumber");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");

-- CreateIndex
CREATE INDEX "GradingAssignment_userId_idx" ON "GradingAssignment"("userId");

-- CreateIndex
CREATE INDEX "LayoutRegion_projectId_idx" ON "LayoutRegion"("projectId");

-- CreateIndex
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");

-- CreateIndex
CREATE INDEX "QuestionGroup_projectId_idx" ON "QuestionGroup"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroup_projectId_name_key" ON "QuestionGroup"("projectId", "name");

-- CreateIndex
CREATE INDEX "QuestionGroupItem_questionGroupId_idx" ON "QuestionGroupItem"("questionGroupId");

-- CreateIndex
CREATE INDEX "QuestionGroupItem_questionGroupId_order_idx" ON "QuestionGroupItem"("questionGroupId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroupItem_questionGroupId_name_key" ON "QuestionGroupItem"("questionGroupId", "name");

-- CreateIndex
CREATE INDEX "SubtotalDefinition_layoutRegionId_idx" ON "SubtotalDefinition"("layoutRegionId");

-- CreateIndex
CREATE INDEX "SubtotalDefinition_questionGroupItemId_idx" ON "SubtotalDefinition"("questionGroupItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SubtotalDefinition_layoutRegionId_questionGroupItemId_key" ON "SubtotalDefinition"("layoutRegionId", "questionGroupItemId");

-- CreateIndex
CREATE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_idx" ON "QuestionSubtotalAssignment"("questionLayoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionSubtotalAssignment_questionGroupItemId_idx" ON "QuestionSubtotalAssignment"("questionGroupItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_questionGroupItemId_key" ON "QuestionSubtotalAssignment"("questionLayoutRegionId", "questionGroupItemId");

-- CreateIndex
CREATE INDEX "AnswerSheet_projectId_idx" ON "AnswerSheet"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheet_projectId_studentId_pageNumber_key" ON "AnswerSheet"("projectId", "studentId", "pageNumber");

-- CreateIndex
CREATE INDEX "Question_projectId_idx" ON "Question"("projectId");

-- CreateIndex
CREATE INDEX "Question_projectId_orderIndex_idx" ON "Question"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "QuestionPart_questionId_idx" ON "QuestionPart"("questionId");

-- CreateIndex
CREATE INDEX "QuestionPart_layoutRegionId_idx" ON "QuestionPart"("layoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionPart_questionId_orderIndex_idx" ON "QuestionPart"("questionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPart_questionId_layoutRegionId_key" ON "QuestionPart"("questionId", "layoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_questionPartId_idx" ON "QuestionPartScore"("questionPartId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_answerSheetId_idx" ON "QuestionPartScore"("answerSheetId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_scoredByUserId_idx" ON "QuestionPartScore"("scoredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPartScore_questionPartId_answerSheetId_scoredByUserId_key" ON "QuestionPartScore"("questionPartId", "answerSheetId", "scoredByUserId");

-- CreateIndex
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");

-- CreateIndex
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionScore_questionId_idx" ON "QuestionScore"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");

-- CreateIndex
CREATE INDEX "ScoreRecord_projectId_idx" ON "ScoreRecord"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRecord_studentId_projectId_key" ON "ScoreRecord"("studentId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectSession_projectId_idx" ON "ProjectSession"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSession_userId_idx" ON "ProjectSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "locks_lockedResourceId_key" ON "locks"("lockedResourceId");

-- CreateIndex
CREATE INDEX "locks_lockedResourceId_resourceType_idx" ON "locks"("lockedResourceId", "resourceType");

-- CreateIndex
CREATE INDEX "_ClassTeachers_B_index" ON "_ClassTeachers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ClassTeachers_AB_unique" ON "_ClassTeachers"("A", "B");
