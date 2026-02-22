-- CreateTable
CREATE TABLE "GradeProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItem_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeProjectClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeProjectClass_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeProjectClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeProjectStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeProjectStudent_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeDataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "examProjectId" TEXT,
    "subtotalId" TEXT,
    "cropRegionId" TEXT,
    "name" TEXT NOT NULL,
    "maxScore" DECIMAL NOT NULL,
    "weight" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "absentMethod" TEXT NOT NULL DEFAULT 'null',
    "absentRatio" DECIMAL NOT NULL DEFAULT 1.0,
    "absentOffset" DECIMAL NOT NULL DEFAULT 0,
    "treatExpectedAsMissing" BOOLEAN NOT NULL DEFAULT false,
    "estimationMode" TEXT NOT NULL DEFAULT 'all',
    "estimationSourceIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeDataSource_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_examProjectId_fkey" FOREIGN KEY ("examProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeDataSourceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualScore_gradeDataSourceId_fkey" FOREIGN KEY ("gradeDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeItemExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItemExclusion_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeItemExclusion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeBoundarySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "gradeItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBoundarySet_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeBoundarySet_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "gradeItemId" TEXT,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeOverride_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeBoundary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeBoundarySetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercentage" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBoundary_gradeBoundarySetId_fkey" FOREIGN KEY ("gradeBoundarySetId") REFERENCES "GradeBoundarySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GradeItem_gradeProjectId_idx" ON "GradeItem"("gradeProjectId");

-- CreateIndex
CREATE INDEX "GradeProjectClass_gradeProjectId_idx" ON "GradeProjectClass"("gradeProjectId");

-- CreateIndex
CREATE INDEX "GradeProjectClass_classId_idx" ON "GradeProjectClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeProjectClass_gradeProjectId_classId_key" ON "GradeProjectClass"("gradeProjectId", "classId");

-- CreateIndex
CREATE INDEX "GradeProjectStudent_gradeProjectId_idx" ON "GradeProjectStudent"("gradeProjectId");

-- CreateIndex
CREATE INDEX "GradeProjectStudent_studentId_idx" ON "GradeProjectStudent"("studentId");

-- CreateIndex
CREATE INDEX "GradeProjectStudent_gradeProjectId_customOrder_idx" ON "GradeProjectStudent"("gradeProjectId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GradeProjectStudent_gradeProjectId_studentId_key" ON "GradeProjectStudent"("gradeProjectId", "studentId");

-- CreateIndex
CREATE INDEX "GradeDataSource_gradeItemId_idx" ON "GradeDataSource"("gradeItemId");

-- CreateIndex
CREATE INDEX "GradeDataSource_examProjectId_idx" ON "GradeDataSource"("examProjectId");

-- CreateIndex
CREATE INDEX "GradeDataSource_subtotalId_idx" ON "GradeDataSource"("subtotalId");

-- CreateIndex
CREATE INDEX "GradeDataSource_cropRegionId_idx" ON "GradeDataSource"("cropRegionId");

-- CreateIndex
CREATE INDEX "ManualScore_gradeDataSourceId_idx" ON "ManualScore"("gradeDataSourceId");

-- CreateIndex
CREATE INDEX "ManualScore_studentId_idx" ON "ManualScore"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualScore_gradeDataSourceId_studentId_key" ON "ManualScore"("gradeDataSourceId", "studentId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_gradeProjectId_idx" ON "GradeItemExclusion"("gradeProjectId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_studentId_idx" ON "GradeItemExclusion"("studentId");

-- CreateIndex
CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeItemExclusion_gradeProjectId_studentId_gradeItemId_key" ON "GradeItemExclusion"("gradeProjectId", "studentId", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeBoundarySet_gradeProjectId_idx" ON "GradeBoundarySet"("gradeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBoundarySet_gradeProjectId_targetType_gradeItemId_key" ON "GradeBoundarySet"("gradeProjectId", "targetType", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeOverride_gradeProjectId_idx" ON "GradeOverride"("gradeProjectId");

-- CreateIndex
CREATE INDEX "GradeOverride_studentId_idx" ON "GradeOverride"("studentId");

-- CreateIndex
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeOverride_gradeProjectId_studentId_targetType_gradeItemId_key" ON "GradeOverride"("gradeProjectId", "studentId", "targetType", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeBoundary_gradeBoundarySetId_idx" ON "GradeBoundary"("gradeBoundarySetId");
