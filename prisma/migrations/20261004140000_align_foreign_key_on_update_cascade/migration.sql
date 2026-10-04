-- 外部キーの ON UPDATE を schema.prisma（Prisma の既定 CASCADE）に揃える。
--
-- 次の23表は、schema.prisma で onUpdate を書いていない（既定の CASCADE）のに、手書きの
-- migration が外部キーを `ON UPDATE NO ACTION` で書いてきたため、migration で作った DB（本番）
-- だけ NO ACTION で、`prisma db push` で作るテスト用の DB は CASCADE になっていた。今のアプリは
-- 行の id を書き換えないので動きは変わらないが、親の id を書き換えると本番だけ外部キー違反で
-- 失敗する（統合アーカイブの取り込みで、一意制約の衝突時に採用する id を付け替える。
-- docs/unified-archive-design.md §7.3）。テストが通っても本番で落ちる差を残さない。
-- freshInstallChain.test.ts が外部キーの一致を検査する。
--
-- schema.prisma で onUpdate: NoAction を明示した表（採点・確定・担当・小計など）は、本番も
-- schema どおりなので触らない。
--
-- 既存の表の外部キーは書き換えられないので、表を作り直す。定義は ON UPDATE 以外そのまま。
-- 行の値は変えない（同期のトリガーは元の表と一緒に消え、次の setupSync が作り直す）。
--
-- 対象: AsbDefinitionTag, AsbOmrConfig, CourseworkClassroom, CourseworkItem, CourseworkLetterScale, CourseworkScore, CourseworkStudent, CourseworkTag, CropRegionOmrConfig, ExamAnswerOverlayStyle, ExamAnswerOverlayVisibility, ExamIndividualReportGraphSettings, ExamIndividualReportSettings, ExamIndividualReportStatisticVisibility, ExamIndividualReportTableSection, GradeFrozenScore, GradeIndividualReportSettings, GradeItemExclusion, GradeOverride, GradeTag, UserClickScoringAction, UserScoringStatusColor, UserSidePanelSection

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- AsbDefinitionTag
CREATE TABLE "new_AsbDefinitionTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asbDefinitionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbDefinitionTag_asbDefinitionId_fkey" FOREIGN KEY ("asbDefinitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbDefinitionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AsbDefinitionTag" ("id", "asbDefinitionId", "tagId", "createdAt", "updatedAt") SELECT "id", "asbDefinitionId", "tagId", "createdAt", "updatedAt" FROM "AsbDefinitionTag";
DROP TABLE "AsbDefinitionTag";
ALTER TABLE "new_AsbDefinitionTag" RENAME TO "AsbDefinitionTag";
CREATE INDEX "AsbDefinitionTag_asbDefinitionId_idx" ON "AsbDefinitionTag"("asbDefinitionId");
CREATE UNIQUE INDEX "AsbDefinitionTag_asbDefinitionId_tagId_key" ON "AsbDefinitionTag"("asbDefinitionId", "tagId");
CREATE INDEX "AsbDefinitionTag_tagId_idx" ON "AsbDefinitionTag"("tagId");

-- AsbOmrConfig
CREATE TABLE "new_AsbOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AsbOmrConfig" ("id", "subQuestionId", "branchQuestionId", "type", "numChoices", "choiceLayout", "createdAt", "updatedAt") SELECT "id", "subQuestionId", "branchQuestionId", "type", "numChoices", "choiceLayout", "createdAt", "updatedAt" FROM "AsbOmrConfig";
DROP TABLE "AsbOmrConfig";
ALTER TABLE "new_AsbOmrConfig" RENAME TO "AsbOmrConfig";
CREATE INDEX "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId");
CREATE UNIQUE INDEX "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId");
CREATE INDEX "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId");
CREATE UNIQUE INDEX "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId");

-- CourseworkClassroom
CREATE TABLE "new_CourseworkClassroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkClass_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseworkClass_classId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkClassroom" ("id", "courseworkId", "classroomId", "order", "createdAt", "updatedAt") SELECT "id", "courseworkId", "classroomId", "order", "createdAt", "updatedAt" FROM "CourseworkClassroom";
DROP TABLE "CourseworkClassroom";
ALTER TABLE "new_CourseworkClassroom" RENAME TO "CourseworkClassroom";
CREATE INDEX "CourseworkClassroom_classroomId_idx" ON "CourseworkClassroom"("classroomId");
CREATE UNIQUE INDEX "CourseworkClassroom_courseworkId_classroomId_key" ON "CourseworkClassroom"("courseworkId", "classroomId");
CREATE INDEX "CourseworkClassroom_courseworkId_idx" ON "CourseworkClassroom"("courseworkId");

-- CourseworkItem
CREATE TABLE "new_CourseworkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxScore" DECIMAL NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'numeric',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkItem_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkItem" ("id", "courseworkId", "name", "order", "maxScore", "inputMode", "createdAt", "updatedAt") SELECT "id", "courseworkId", "name", "order", "maxScore", "inputMode", "createdAt", "updatedAt" FROM "CourseworkItem";
DROP TABLE "CourseworkItem";
ALTER TABLE "new_CourseworkItem" RENAME TO "CourseworkItem";
CREATE INDEX "CourseworkItem_courseworkId_idx" ON "CourseworkItem"("courseworkId");

-- CourseworkLetterScale
CREATE TABLE "new_CourseworkLetterScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkLetterScale_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkLetterScale" ("id", "courseworkItemId", "label", "score", "order", "createdAt", "updatedAt") SELECT "id", "courseworkItemId", "label", "score", "order", "createdAt", "updatedAt" FROM "CourseworkLetterScale";
DROP TABLE "CourseworkLetterScale";
ALTER TABLE "new_CourseworkLetterScale" RENAME TO "CourseworkLetterScale";
CREATE INDEX "CourseworkLetterScale_courseworkItemId_idx" ON "CourseworkLetterScale"("courseworkItemId");

-- CourseworkScore
CREATE TABLE "new_CourseworkScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkItemId" TEXT NOT NULL,
    "courseworkStudentId" TEXT NOT NULL,
    "score" DECIMAL,
    "letterValue" TEXT,
    "adjustment" DECIMAL DEFAULT 0,
    "adjustmentReason" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkScore_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseworkScore_courseworkStudentId_fkey" FOREIGN KEY ("courseworkStudentId") REFERENCES "CourseworkStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkScore" ("id", "courseworkItemId", "courseworkStudentId", "score", "letterValue", "adjustment", "adjustmentReason", "comment", "createdAt", "updatedAt") SELECT "id", "courseworkItemId", "courseworkStudentId", "score", "letterValue", "adjustment", "adjustmentReason", "comment", "createdAt", "updatedAt" FROM "CourseworkScore";
DROP TABLE "CourseworkScore";
ALTER TABLE "new_CourseworkScore" RENAME TO "CourseworkScore";
CREATE UNIQUE INDEX "CourseworkScore_courseworkItemId_courseworkStudentId_key" ON "CourseworkScore"("courseworkItemId", "courseworkStudentId");
CREATE INDEX "CourseworkScore_courseworkItemId_idx" ON "CourseworkScore"("courseworkItemId");
CREATE INDEX "CourseworkScore_courseworkStudentId_idx" ON "CourseworkScore"("courseworkStudentId");

-- CourseworkStudent
CREATE TABLE "new_CourseworkStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkStudent_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseworkStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkStudent" ("id", "courseworkId", "studentId", "customOrder", "createdAt", "updatedAt") SELECT "id", "courseworkId", "studentId", "customOrder", "createdAt", "updatedAt" FROM "CourseworkStudent";
DROP TABLE "CourseworkStudent";
ALTER TABLE "new_CourseworkStudent" RENAME TO "CourseworkStudent";
CREATE INDEX "CourseworkStudent_courseworkId_customOrder_idx" ON "CourseworkStudent"("courseworkId", "customOrder");
CREATE INDEX "CourseworkStudent_courseworkId_idx" ON "CourseworkStudent"("courseworkId");
CREATE UNIQUE INDEX "CourseworkStudent_courseworkId_studentId_key" ON "CourseworkStudent"("courseworkId", "studentId");
CREATE INDEX "CourseworkStudent_studentId_idx" ON "CourseworkStudent"("studentId");

-- CourseworkTag
CREATE TABLE "new_CourseworkTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkTag_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseworkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseworkTag" ("id", "courseworkId", "tagId", "createdAt", "updatedAt") SELECT "id", "courseworkId", "tagId", "createdAt", "updatedAt" FROM "CourseworkTag";
DROP TABLE "CourseworkTag";
ALTER TABLE "new_CourseworkTag" RENAME TO "CourseworkTag";
CREATE INDEX "CourseworkTag_courseworkId_idx" ON "CourseworkTag"("courseworkId");
CREATE UNIQUE INDEX "CourseworkTag_courseworkId_tagId_key" ON "CourseworkTag"("courseworkId", "tagId");
CREATE INDEX "CourseworkTag_tagId_idx" ON "CourseworkTag"("tagId");

-- CropRegionOmrConfig
CREATE TABLE "new_CropRegionOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "colorThreshold" INTEGER,
    "areaThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CropRegionOmrConfig" ("id", "cropRegionId", "type", "numChoices", "choiceLayout", "colorThreshold", "areaThreshold", "createdAt", "updatedAt") SELECT "id", "cropRegionId", "type", "numChoices", "choiceLayout", "colorThreshold", "areaThreshold", "createdAt", "updatedAt" FROM "CropRegionOmrConfig";
DROP TABLE "CropRegionOmrConfig";
ALTER TABLE "new_CropRegionOmrConfig" RENAME TO "CropRegionOmrConfig";
CREATE INDEX "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId");
CREATE UNIQUE INDEX "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId");

-- ExamAnswerOverlayStyle
CREATE TABLE "new_ExamAnswerOverlayStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "overlayKind" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "offsetX" INTEGER NOT NULL,
    "offsetY" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "opacity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayStyle_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamAnswerOverlayStyle" ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity", "createdAt", "updatedAt") SELECT "id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity", "createdAt", "updatedAt" FROM "ExamAnswerOverlayStyle";
DROP TABLE "ExamAnswerOverlayStyle";
ALTER TABLE "new_ExamAnswerOverlayStyle" RENAME TO "ExamAnswerOverlayStyle";
CREATE INDEX "ExamAnswerOverlayStyle_examId_idx" ON "ExamAnswerOverlayStyle"("examId");
CREATE UNIQUE INDEX "ExamAnswerOverlayStyle_examId_overlayKind_key" ON "ExamAnswerOverlayStyle"("examId", "overlayKind");

-- ExamAnswerOverlayVisibility
CREATE TABLE "new_ExamAnswerOverlayVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "showMark" BOOLEAN NOT NULL,
    "showScore" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamAnswerOverlayVisibility" ("id", "examId", "status", "showMark", "showScore", "createdAt", "updatedAt") SELECT "id", "examId", "status", "showMark", "showScore", "createdAt", "updatedAt" FROM "ExamAnswerOverlayVisibility";
DROP TABLE "ExamAnswerOverlayVisibility";
ALTER TABLE "new_ExamAnswerOverlayVisibility" RENAME TO "ExamAnswerOverlayVisibility";
CREATE INDEX "ExamAnswerOverlayVisibility_examId_idx" ON "ExamAnswerOverlayVisibility"("examId");
CREATE UNIQUE INDEX "ExamAnswerOverlayVisibility_examId_status_key" ON "ExamAnswerOverlayVisibility"("examId", "status");

-- ExamIndividualReportGraphSettings
CREATE TABLE "new_ExamIndividualReportGraphSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "showBarChart" BOOLEAN NOT NULL,
    "showRadarChart" BOOLEAN NOT NULL,
    "showTotalScoreBoxPlot" BOOLEAN NOT NULL,
    "boxPlotGroupSelectionEnabled" BOOLEAN NOT NULL,
    "showBoxPlotMin" BOOLEAN NOT NULL,
    "showBoxPlotQ1" BOOLEAN NOT NULL,
    "showBoxPlotMedian" BOOLEAN NOT NULL,
    "showBoxPlotQ3" BOOLEAN NOT NULL,
    "showBoxPlotMax" BOOLEAN NOT NULL,
    "showAverageLine" BOOLEAN NOT NULL,
    "showStudentMarker" BOOLEAN NOT NULL,
    "boxPlotFontSize" INTEGER NOT NULL,
    "boxPlotItemHeight" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportGraphSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamIndividualReportGraphSettings" ("id", "examId", "showBarChart", "showRadarChart", "showTotalScoreBoxPlot", "boxPlotGroupSelectionEnabled", "showBoxPlotMin", "showBoxPlotQ1", "showBoxPlotMedian", "showBoxPlotQ3", "showBoxPlotMax", "showAverageLine", "showStudentMarker", "boxPlotFontSize", "boxPlotItemHeight", "createdAt", "updatedAt") SELECT "id", "examId", "showBarChart", "showRadarChart", "showTotalScoreBoxPlot", "boxPlotGroupSelectionEnabled", "showBoxPlotMin", "showBoxPlotQ1", "showBoxPlotMedian", "showBoxPlotQ3", "showBoxPlotMax", "showAverageLine", "showStudentMarker", "boxPlotFontSize", "boxPlotItemHeight", "createdAt", "updatedAt" FROM "ExamIndividualReportGraphSettings";
DROP TABLE "ExamIndividualReportGraphSettings";
ALTER TABLE "new_ExamIndividualReportGraphSettings" RENAME TO "ExamIndividualReportGraphSettings";
CREATE UNIQUE INDEX "ExamIndividualReportGraphSettings_examId_key" ON "ExamIndividualReportGraphSettings"("examId");

-- ExamIndividualReportSettings
CREATE TABLE "new_ExamIndividualReportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "displayMode" TEXT NOT NULL,
    "showScore" BOOLEAN NOT NULL,
    "showMarks" BOOLEAN NOT NULL,
    "hideUnassignedSubtotals" BOOLEAN NOT NULL,
    "showGroupSubtotals" BOOLEAN NOT NULL,
    "showCorrectRate" BOOLEAN NOT NULL,
    "showScoreRate" BOOLEAN NOT NULL,
    "showLearningAdvice" BOOLEAN NOT NULL,
    "adviceReviewRateMin" REAL,
    "adviceReviewRateMax" REAL,
    "adviceReviewQuestionCount" INTEGER,
    "showComment" BOOLEAN NOT NULL,
    "showSignature" BOOLEAN NOT NULL,
    "pageLayout" TEXT NOT NULL,
    "pageOrientation" TEXT NOT NULL,
    "tableGroupSelectionEnabled" BOOLEAN NOT NULL,
    "statisticsIncludesParticipating" BOOLEAN NOT NULL,
    "statisticsIncludesExpected" BOOLEAN NOT NULL,
    "statisticsIncludesAbsent" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamIndividualReportSettings" ("id", "examId", "displayMode", "showScore", "showMarks", "hideUnassignedSubtotals", "showGroupSubtotals", "showCorrectRate", "showScoreRate", "showLearningAdvice", "adviceReviewRateMin", "adviceReviewRateMax", "adviceReviewQuestionCount", "showComment", "showSignature", "pageLayout", "pageOrientation", "tableGroupSelectionEnabled", "statisticsIncludesParticipating", "statisticsIncludesExpected", "statisticsIncludesAbsent", "createdAt", "updatedAt") SELECT "id", "examId", "displayMode", "showScore", "showMarks", "hideUnassignedSubtotals", "showGroupSubtotals", "showCorrectRate", "showScoreRate", "showLearningAdvice", "adviceReviewRateMin", "adviceReviewRateMax", "adviceReviewQuestionCount", "showComment", "showSignature", "pageLayout", "pageOrientation", "tableGroupSelectionEnabled", "statisticsIncludesParticipating", "statisticsIncludesExpected", "statisticsIncludesAbsent", "createdAt", "updatedAt" FROM "ExamIndividualReportSettings";
DROP TABLE "ExamIndividualReportSettings";
ALTER TABLE "new_ExamIndividualReportSettings" RENAME TO "ExamIndividualReportSettings";
CREATE UNIQUE INDEX "ExamIndividualReportSettings_examId_key" ON "ExamIndividualReportSettings"("examId");

-- ExamIndividualReportStatisticVisibility
CREATE TABLE "new_ExamIndividualReportStatisticVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "statisticKind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "shown" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportStatisticVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamIndividualReportStatisticVisibility" ("id", "examId", "statisticKind", "scope", "shown", "createdAt", "updatedAt") SELECT "id", "examId", "statisticKind", "scope", "shown", "createdAt", "updatedAt" FROM "ExamIndividualReportStatisticVisibility";
DROP TABLE "ExamIndividualReportStatisticVisibility";
ALTER TABLE "new_ExamIndividualReportStatisticVisibility" RENAME TO "ExamIndividualReportStatisticVisibility";
CREATE INDEX "ExamIndividualReportStatisticVisibility_examId_idx" ON "ExamIndividualReportStatisticVisibility"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportStatisticVisibility_examId_statisticKind_scope_key" ON "ExamIndividualReportStatisticVisibility"("examId", "statisticKind", "scope");

-- ExamIndividualReportTableSection
CREATE TABLE "new_ExamIndividualReportTableSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "tableKind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "columns" INTEGER NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportTableSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamIndividualReportTableSection" ("id", "examId", "tableKind", "enabled", "columns", "fontSize", "createdAt", "updatedAt") SELECT "id", "examId", "tableKind", "enabled", "columns", "fontSize", "createdAt", "updatedAt" FROM "ExamIndividualReportTableSection";
DROP TABLE "ExamIndividualReportTableSection";
ALTER TABLE "new_ExamIndividualReportTableSection" RENAME TO "ExamIndividualReportTableSection";
CREATE INDEX "ExamIndividualReportTableSection_examId_idx" ON "ExamIndividualReportTableSection"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportTableSection_examId_tableKind_key" ON "ExamIndividualReportTableSection"("examId", "tableKind");

-- GradeFrozenScore
CREATE TABLE "new_GradeFrozenScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "weightedScore" DECIMAL,
    "weightedMaxScore" DECIMAL NOT NULL,
    "percentage" DECIMAL,
    "gradeLabel" TEXT,
    "frozenByUserId" TEXT,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeFrozenScore_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeFrozenScore_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeFrozenScore_frozenByUserId_fkey" FOREIGN KEY ("frozenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GradeFrozenScore" ("id", "gradeStudentId", "gradeItemId", "weightedScore", "weightedMaxScore", "percentage", "gradeLabel", "frozenByUserId", "frozenAt", "createdAt", "updatedAt") SELECT "id", "gradeStudentId", "gradeItemId", "weightedScore", "weightedMaxScore", "percentage", "gradeLabel", "frozenByUserId", "frozenAt", "createdAt", "updatedAt" FROM "GradeFrozenScore";
DROP TABLE "GradeFrozenScore";
ALTER TABLE "new_GradeFrozenScore" RENAME TO "GradeFrozenScore";
CREATE INDEX "GradeFrozenScore_gradeItemId_idx" ON "GradeFrozenScore"("gradeItemId");
CREATE UNIQUE INDEX "GradeFrozenScore_gradeStudentId_gradeItemId_key" ON "GradeFrozenScore"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeFrozenScore_gradeStudentId_idx" ON "GradeFrozenScore"("gradeStudentId");

-- GradeIndividualReportSettings
CREATE TABLE "new_GradeIndividualReportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '個人成績通知書',
    "showItemGrades" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnScore" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnPercentage" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnGradeLabel" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeFontSize" INTEGER NOT NULL DEFAULT 11,
    "itemGradeTableColumns" INTEGER NOT NULL DEFAULT 1,
    "showSourceBreakdown" BOOLEAN NOT NULL DEFAULT false,
    "sourceBreakdownColumnScore" BOOLEAN NOT NULL DEFAULT true,
    "sourceBreakdownColumnWeight" BOOLEAN NOT NULL DEFAULT true,
    "sourceBreakdownColumnComment" BOOLEAN NOT NULL DEFAULT false,
    "sourceBreakdownFontSize" INTEGER NOT NULL DEFAULT 11,
    "sourceBreakdownTableColumns" INTEGER NOT NULL DEFAULT 1,
    "dataSourceLabel" TEXT NOT NULL DEFAULT '',
    "showCommentSection" BOOLEAN NOT NULL DEFAULT false,
    "showSignatureSection" BOOLEAN NOT NULL DEFAULT false,
    "footerLeft" TEXT NOT NULL DEFAULT '',
    "footerCenter" TEXT NOT NULL DEFAULT '',
    "footerRight" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeIndividualReportSettings_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeIndividualReportSettings" ("id", "gradeId", "title", "showItemGrades", "itemGradeColumnScore", "itemGradeColumnPercentage", "itemGradeColumnGradeLabel", "itemGradeFontSize", "itemGradeTableColumns", "showSourceBreakdown", "sourceBreakdownColumnScore", "sourceBreakdownColumnWeight", "sourceBreakdownColumnComment", "sourceBreakdownFontSize", "sourceBreakdownTableColumns", "dataSourceLabel", "showCommentSection", "showSignatureSection", "footerLeft", "footerCenter", "footerRight", "createdAt", "updatedAt") SELECT "id", "gradeId", "title", "showItemGrades", "itemGradeColumnScore", "itemGradeColumnPercentage", "itemGradeColumnGradeLabel", "itemGradeFontSize", "itemGradeTableColumns", "showSourceBreakdown", "sourceBreakdownColumnScore", "sourceBreakdownColumnWeight", "sourceBreakdownColumnComment", "sourceBreakdownFontSize", "sourceBreakdownTableColumns", "dataSourceLabel", "showCommentSection", "showSignatureSection", "footerLeft", "footerCenter", "footerRight", "createdAt", "updatedAt" FROM "GradeIndividualReportSettings";
DROP TABLE "GradeIndividualReportSettings";
ALTER TABLE "new_GradeIndividualReportSettings" RENAME TO "GradeIndividualReportSettings";
CREATE UNIQUE INDEX "GradeIndividualReportSettings_gradeId_key" ON "GradeIndividualReportSettings"("gradeId");

-- GradeItemExclusion
CREATE TABLE "new_GradeItemExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeItemExclusion_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeItemExclusion" ("id", "gradeStudentId", "gradeItemId", "createdAt", "updatedAt") SELECT "id", "gradeStudentId", "gradeItemId", "createdAt", "updatedAt" FROM "GradeItemExclusion";
DROP TABLE "GradeItemExclusion";
ALTER TABLE "new_GradeItemExclusion" RENAME TO "GradeItemExclusion";
CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId");
CREATE UNIQUE INDEX "GradeItemExclusion_gradeStudentId_gradeItemId_key" ON "GradeItemExclusion"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeItemExclusion_gradeStudentId_idx" ON "GradeItemExclusion"("gradeStudentId");

-- GradeOverride
CREATE TABLE "new_GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeOverride_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeOverride" ("id", "gradeStudentId", "gradeItemId", "overrideLabel", "createdAt", "updatedAt") SELECT "id", "gradeStudentId", "gradeItemId", "overrideLabel", "createdAt", "updatedAt" FROM "GradeOverride";
DROP TABLE "GradeOverride";
ALTER TABLE "new_GradeOverride" RENAME TO "GradeOverride";
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");
CREATE UNIQUE INDEX "GradeOverride_gradeStudentId_gradeItemId_key" ON "GradeOverride"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeOverride_gradeStudentId_idx" ON "GradeOverride"("gradeStudentId");

-- GradeTag
CREATE TABLE "new_GradeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeTag_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeTag" ("id", "gradeId", "tagId", "createdAt", "updatedAt") SELECT "id", "gradeId", "tagId", "createdAt", "updatedAt" FROM "GradeTag";
DROP TABLE "GradeTag";
ALTER TABLE "new_GradeTag" RENAME TO "GradeTag";
CREATE INDEX "GradeTag_gradeId_idx" ON "GradeTag"("gradeId");
CREATE UNIQUE INDEX "GradeTag_gradeId_tagId_key" ON "GradeTag"("gradeId", "tagId");
CREATE INDEX "GradeTag_tagId_idx" ON "GradeTag"("tagId");

-- UserClickScoringAction
CREATE TABLE "new_UserClickScoringAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserClickScoringAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserClickScoringAction" ("id", "userId", "clickCount", "action", "createdAt", "updatedAt") SELECT "id", "userId", "clickCount", "action", "createdAt", "updatedAt" FROM "UserClickScoringAction";
DROP TABLE "UserClickScoringAction";
ALTER TABLE "new_UserClickScoringAction" RENAME TO "UserClickScoringAction";
CREATE UNIQUE INDEX "UserClickScoringAction_userId_clickCount_key" ON "UserClickScoringAction"("userId", "clickCount");
CREATE INDEX "UserClickScoringAction_userId_idx" ON "UserClickScoringAction"("userId");

-- UserScoringStatusColor
CREATE TABLE "new_UserScoringStatusColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "iconColor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserScoringStatusColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserScoringStatusColor" ("id", "userId", "status", "backgroundColor", "textColor", "iconColor", "createdAt", "updatedAt") SELECT "id", "userId", "status", "backgroundColor", "textColor", "iconColor", "createdAt", "updatedAt" FROM "UserScoringStatusColor";
DROP TABLE "UserScoringStatusColor";
ALTER TABLE "new_UserScoringStatusColor" RENAME TO "UserScoringStatusColor";
CREATE INDEX "UserScoringStatusColor_userId_idx" ON "UserScoringStatusColor"("userId");
CREATE UNIQUE INDEX "UserScoringStatusColor_userId_status_key" ON "UserScoringStatusColor"("userId", "status");

-- UserSidePanelSection
CREATE TABLE "new_UserSidePanelSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "collapsed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSidePanelSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSidePanelSection" ("id", "userId", "sectionId", "collapsed", "createdAt", "updatedAt") SELECT "id", "userId", "sectionId", "collapsed", "createdAt", "updatedAt" FROM "UserSidePanelSection";
DROP TABLE "UserSidePanelSection";
ALTER TABLE "new_UserSidePanelSection" RENAME TO "UserSidePanelSection";
CREATE INDEX "UserSidePanelSection_userId_idx" ON "UserSidePanelSection"("userId");
CREATE UNIQUE INDEX "UserSidePanelSection_userId_sectionId_key" ON "UserSidePanelSection"("userId", "sectionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
