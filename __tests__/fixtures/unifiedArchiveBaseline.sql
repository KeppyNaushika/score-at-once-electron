PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "AppPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AsbBranchQuestion" (
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
CREATE TABLE "AsbCharGuide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manuscriptPaperId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "atChar" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "boundary" TEXT,
    "boundaryWidth" REAL,
    "boundaryDashRatio" REAL,
    "boundaryGapRatio" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbCharGuide_manuscriptPaperId_fkey" FOREIGN KEY ("manuscriptPaperId") REFERENCES "AsbManuscriptPaper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '新しい解答用紙',
    "labelPresetMajor" TEXT,
    "labelPresetSub" TEXT,
    "labelPresetBranch" TEXT,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "verticalLayout" BOOLEAN NOT NULL DEFAULT false,
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
    "borderManuscriptCharDivider" TEXT NOT NULL DEFAULT 'dashed',
    "borderManuscriptLineDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderManuscriptCharDividerWidth" REAL DEFAULT 0.2,
    "borderManuscriptLineDividerWidth" REAL DEFAULT 0.2,
    "omrMarkersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "omrMarkersSizeMm" REAL NOT NULL DEFAULT 5,
    "omrMarkersOffsetMm" REAL NOT NULL DEFAULT 3,
    "fontFamily" TEXT NOT NULL DEFAULT 'Noto Sans JP',
    "fontDefaultSize" REAL NOT NULL DEFAULT 6,
    "fontMajorNumberSize" REAL NOT NULL DEFAULT 6,
    "fontSubNumberSize" REAL NOT NULL DEFAULT 6,
    "fontBranchNumberSize" REAL NOT NULL DEFAULT 5,
    "multiColumnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiColumnCount" INTEGER NOT NULL DEFAULT 2,
    "multiColumnGapMm" REAL NOT NULL DEFAULT 5,
    "multiColumnDividerLine" TEXT,
    "multiColumnDividerLineWidth" REAL NOT NULL DEFAULT 0.3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL, "borderOuterBorderDashRatio" REAL, "borderOuterBorderGapRatio" REAL, "borderMajorDividerDashRatio" REAL, "borderMajorDividerGapRatio" REAL, "borderSubDividerDashRatio" REAL, "borderSubDividerGapRatio" REAL, "borderBranchDividerDashRatio" REAL, "borderBranchDividerGapRatio" REAL, "borderMajorNumberDividerDashRatio" REAL, "borderMajorNumberDividerGapRatio" REAL, "borderSubNumberDividerDashRatio" REAL, "borderSubNumberDividerGapRatio" REAL, "borderBranchNumberDividerDashRatio" REAL, "borderBranchNumberDividerGapRatio" REAL, "borderManuscriptCharDividerDashRatio" REAL, "borderManuscriptCharDividerGapRatio" REAL, "borderManuscriptLineDividerDashRatio" REAL, "borderManuscriptLineDividerGapRatio" REAL, "referenceDate" DATETIME, "description" TEXT,
    CONSTRAINT "AsbDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbDefinitionTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asbDefinitionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbDefinitionTag_asbDefinitionId_fkey" FOREIGN KEY ("asbDefinitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "AsbDefinitionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "AsbHeaderField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'field',
    "label" TEXT NOT NULL,
    "widthMm" REAL NOT NULL DEFAULT 30,
    "heightMm" REAL NOT NULL DEFAULT 8,
    "gridCount" INTEGER NOT NULL DEFAULT 0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "lineWidth" REAL NOT NULL DEFAULT 0.4,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fontSize" REAL,
    "linkedRegionType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
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
    "visibility" TEXT NOT NULL DEFAULT 'both',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbImageElement_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbImageElement_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbMajorQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbMajorQuestion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbManuscriptPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "columns" INTEGER NOT NULL DEFAULT 20,
    "rows" INTEGER NOT NULL DEFAULT 10,
    "guideFontSize" REAL,
    "guidePosition" TEXT,
    "guidePadding" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbManuscriptPaper_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbManuscriptPaper_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbOmrChoiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "AsbOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "AsbSubQuestion" (
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
    "borderStyleTop" TEXT,
    "borderStyleBottom" TEXT,
    "borderStyleLeft" TEXT,
    "borderStyleRight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbSubQuestion_majorQuestionId_fkey" FOREIGN KEY ("majorQuestionId") REFERENCES "AsbMajorQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AsbTextElement" (
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
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeId" TEXT,
    "scopeLabel" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" TEXT
, "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z', "coalesceKey" TEXT);
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "classroomCode" TEXT,
    "grade" INTEGER,
    "description" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "CompoundAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "answerFormat" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER,
    "alternativeAnswers" TEXT,
    "requireReduced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswer_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CompoundAnswerMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAnswerId" TEXT NOT NULL,
    "cropRegionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "roleLabel" TEXT,
    "separator" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswerMember_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundAnswerMember_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CompoundAnswerScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAnswerId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recognizedAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "partialScore" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswerScore_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundAnswerScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE TABLE "Coursework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CourseworkClassroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkClass_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkClass_classId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CourseworkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxScore" DECIMAL NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'numeric',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkItem_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CourseworkLetterScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkLetterScale_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CourseworkScore" (
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
    CONSTRAINT "CourseworkScore_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkScore_courseworkStudentId_fkey" FOREIGN KEY ("courseworkStudentId") REFERENCES "CourseworkStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CourseworkStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkStudent_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CourseworkTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkTag_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CropRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegion_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CropRegionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegionAssignment_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropRegionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropRegionAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE TABLE "CropRegionOmrChoiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "normalizedCx" REAL, "normalizedCy" REAL, "normalizedHeight" REAL, "normalizedWidth" REAL, "shape" TEXT DEFAULT 'ellipse',
    CONSTRAINT "CropRegionOmrChoiceOption_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CropRegionOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "colorThreshold" INTEGER,
    "areaThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "CropSubtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "subtotalId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropSubtotal_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropSubtotal_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "DrawingAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionScoreId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "strokeWidth" REAL NOT NULL DEFAULT 0.5,
    "width" REAL NOT NULL DEFAULT 0.0,
    "height" REAL NOT NULL DEFAULT 0.0,
    "endX" REAL NOT NULL DEFAULT 0.0,
    "endY" REAL NOT NULL DEFAULT 0.0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "text" TEXT NOT NULL DEFAULT '',
    "fontSize" REAL NOT NULL DEFAULT 4.0,
    "textBoxWidth" REAL NOT NULL DEFAULT 0.0,
    "textBoxHeight" REAL NOT NULL DEFAULT 0.0,
    "horizontalAlign" TEXT NOT NULL DEFAULT 'left',
    "verticalAlign" TEXT NOT NULL DEFAULT 'top',
    "anchorDirection" TEXT NOT NULL DEFAULT 'top-left',
    "displayX" REAL NOT NULL DEFAULT 0.0,
    "displayY" REAL NOT NULL DEFAULT 0.0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "referenceDate" DATETIME,
    "description" TEXT,
    "markerCorrectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ExamAnswerOverlayStyle" (
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
    CONSTRAINT "ExamAnswerOverlayStyle_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamAnswerOverlayVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "showMark" BOOLEAN NOT NULL,
    "showScore" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamClassroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "administered" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "teacherStatistics" BOOLEAN NOT NULL DEFAULT false, "studentReport" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamClass_classId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ExamIndividualReportGraphSettings" (
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
    CONSTRAINT "ExamIndividualReportGraphSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamIndividualReportSettings" (
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
    CONSTRAINT "ExamIndividualReportSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamIndividualReportStatisticVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "statisticKind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "shown" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportStatisticVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamIndividualReportTableSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "tableKind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "columns" INTEGER NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportTableSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imagePath" TEXT,
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARTICIPATING',
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamStudent_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ExamSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "selectedForTable" BOOLEAN NOT NULL DEFAULT false,
    "selectedForBoxPlot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSubtotalGroup_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ExamSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ExamTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamTag_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "GradeClassroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeClass_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeClass_classId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "comparedGradeItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeComparison_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeComparison_comparedGradeItemId_fkey" FOREIGN KEY ("comparedGradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expression" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "message" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "targetGradeItemId" TEXT REFERENCES "GradeItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE, "aggregate" TEXT NOT NULL DEFAULT 'average', "tolerance" DECIMAL NOT NULL DEFAULT 1, "disabledReason" TEXT,
    CONSTRAINT "GradeConstraint_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeConstraintExclusionLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintExclusionLabel_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeConstraintLabelValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintLabelValue_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeConstraintViewpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintViewpoint_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeConstraintViewpoint_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeDataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "examId" TEXT,
    "subtotalId" TEXT,
    "cropRegionId" TEXT,
    "name" TEXT NOT NULL,
    "weight" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "absentMethod" TEXT NOT NULL DEFAULT 'null',
    "absentRatio" DECIMAL NOT NULL DEFAULT 1.0,
    "absentOffset" DECIMAL NOT NULL DEFAULT 0,
    "treatExpectedAsMissing" BOOLEAN NOT NULL DEFAULT false,
    "estimationMode" TEXT NOT NULL DEFAULT 'all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "courseworkItemId" TEXT, "courseworkId" TEXT,
    CONSTRAINT "GradeDataSource_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeDataSourceEstimationSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "sourceDataSourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeDataSourceEstimationSource_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSourceEstimationSource_sourceDataSourceId_fkey" FOREIGN KEY ("sourceDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeFrozenScore" (
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
    CONSTRAINT "GradeFrozenScore_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeFrozenScore_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeFrozenScore_frozenByUserId_fkey" FOREIGN KEY ("frozenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE TABLE "GradeIndividualReportSettings" (
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
    CONSTRAINT "GradeIndividualReportSettings_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItem_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeItemBoundary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercentage" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItemBoundary_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeItemExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeItemExclusion_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeOverride_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "GradeStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeStudent_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GradeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeTag_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "comment" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE TABLE "ReturnSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examStudentId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "totalScore" DECIMAL,
    "capturedByUserId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnSnapshot_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ReturnSnapshot_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "ScoreDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentNumber" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastNameKana" TEXT NOT NULL,
    "firstNameKana" TEXT NOT NULL,
    "enrollmentYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "StudentAnswerImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAnswerImage_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "StudentAnswerImage_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "StudentClassroomMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "attendanceNumber" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Subtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subtotal_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "SubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "TagSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TagSubtotalGroup_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passcode" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "passcodeType" TEXT DEFAULT 'none'
);
CREATE TABLE "UserClickScoringAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserClickScoringAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "UserExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GRADER',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE TABLE "UserKeyboardShortcut" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserKeyboardShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "UserScoringStatusColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "iconColor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserScoringStatusColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "UserSidePanelSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "collapsed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSidePanelSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
CREATE UNIQUE INDEX "AppPreference_key_key" ON "AppPreference"("key");
CREATE INDEX "AsbBranchQuestion_subQuestionId_idx" ON "AsbBranchQuestion"("subQuestionId");
CREATE INDEX "AsbCharGuide_manuscriptPaperId_idx" ON "AsbCharGuide"("manuscriptPaperId");
CREATE INDEX "AsbDefinitionTag_asbDefinitionId_idx" ON "AsbDefinitionTag"("asbDefinitionId");
CREATE UNIQUE INDEX "AsbDefinitionTag_asbDefinitionId_tagId_key" ON "AsbDefinitionTag"("asbDefinitionId", "tagId");
CREATE INDEX "AsbDefinitionTag_tagId_idx" ON "AsbDefinitionTag"("tagId");
CREATE INDEX "AsbDefinition_userId_idx" ON "AsbDefinition"("userId");
CREATE INDEX "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId");
CREATE INDEX "AsbImageElement_branchQuestionId_idx" ON "AsbImageElement"("branchQuestionId");
CREATE INDEX "AsbImageElement_subQuestionId_idx" ON "AsbImageElement"("subQuestionId");
CREATE INDEX "AsbMajorQuestion_definitionId_idx" ON "AsbMajorQuestion"("definitionId");
CREATE INDEX "AsbManuscriptPaper_branchQuestionId_idx" ON "AsbManuscriptPaper"("branchQuestionId");
CREATE UNIQUE INDEX "AsbManuscriptPaper_branchQuestionId_key" ON "AsbManuscriptPaper"("branchQuestionId");
CREATE INDEX "AsbManuscriptPaper_subQuestionId_idx" ON "AsbManuscriptPaper"("subQuestionId");
CREATE UNIQUE INDEX "AsbManuscriptPaper_subQuestionId_key" ON "AsbManuscriptPaper"("subQuestionId");
CREATE UNIQUE INDEX "AsbOmrChoiceOption_omrConfigId_choiceIndex_key" ON "AsbOmrChoiceOption"("omrConfigId", "choiceIndex");
CREATE INDEX "AsbOmrChoiceOption_omrConfigId_idx" ON "AsbOmrChoiceOption"("omrConfigId");
CREATE INDEX "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId");
CREATE UNIQUE INDEX "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId");
CREATE INDEX "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId");
CREATE UNIQUE INDEX "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId");
CREATE INDEX "AsbSubQuestion_majorQuestionId_idx" ON "AsbSubQuestion"("majorQuestionId");
CREATE INDEX "AsbTextElement_branchQuestionId_idx" ON "AsbTextElement"("branchQuestionId");
CREATE INDEX "AsbTextElement_subQuestionId_idx" ON "AsbTextElement"("subQuestionId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");
CREATE INDEX "AuditLog_coalesceKey_idx" ON "AuditLog"("coalesceKey");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_scopeId_idx" ON "AuditLog"("scopeId");
CREATE INDEX "AuditLog_updatedAt_idx" ON "AuditLog"("updatedAt");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "CompoundAnswerMember_compoundAnswerId_idx" ON "CompoundAnswerMember"("compoundAnswerId");
CREATE UNIQUE INDEX "CompoundAnswerMember_cropRegionId_key" ON "CompoundAnswerMember"("cropRegionId");
CREATE UNIQUE INDEX "CompoundAnswerScore_compoundAnswerId_examStudentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "examStudentId");
CREATE INDEX "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId");
CREATE INDEX "CompoundAnswerScore_examStudentId_idx" ON "CompoundAnswerScore"("examStudentId");
CREATE INDEX "CompoundAnswer_examPageId_idx" ON "CompoundAnswer"("examPageId");
CREATE INDEX "CourseworkClassroom_classroomId_idx" ON "CourseworkClassroom"("classroomId");
CREATE UNIQUE INDEX "CourseworkClassroom_courseworkId_classroomId_key" ON "CourseworkClassroom"("courseworkId", "classroomId");
CREATE INDEX "CourseworkClassroom_courseworkId_idx" ON "CourseworkClassroom"("courseworkId");
CREATE INDEX "CourseworkItem_courseworkId_idx" ON "CourseworkItem"("courseworkId");
CREATE INDEX "CourseworkLetterScale_courseworkItemId_idx" ON "CourseworkLetterScale"("courseworkItemId");
CREATE UNIQUE INDEX "CourseworkScore_courseworkItemId_courseworkStudentId_key" ON "CourseworkScore"("courseworkItemId", "courseworkStudentId");
CREATE INDEX "CourseworkScore_courseworkItemId_idx" ON "CourseworkScore"("courseworkItemId");
CREATE INDEX "CourseworkScore_courseworkStudentId_idx" ON "CourseworkScore"("courseworkStudentId");
CREATE INDEX "CourseworkStudent_courseworkId_customOrder_idx" ON "CourseworkStudent"("courseworkId", "customOrder");
CREATE INDEX "CourseworkStudent_courseworkId_idx" ON "CourseworkStudent"("courseworkId");
CREATE UNIQUE INDEX "CourseworkStudent_courseworkId_studentId_key" ON "CourseworkStudent"("courseworkId", "studentId");
CREATE INDEX "CourseworkStudent_studentId_idx" ON "CourseworkStudent"("studentId");
CREATE INDEX "CourseworkTag_courseworkId_idx" ON "CourseworkTag"("courseworkId");
CREATE UNIQUE INDEX "CourseworkTag_courseworkId_tagId_key" ON "CourseworkTag"("courseworkId", "tagId");
CREATE INDEX "CourseworkTag_tagId_idx" ON "CourseworkTag"("tagId");
CREATE UNIQUE INDEX "CropRegionAssignment_cropRegionId_userId_key" ON "CropRegionAssignment"("cropRegionId", "userId");
CREATE INDEX "CropRegionAssignment_userId_idx" ON "CropRegionAssignment"("userId");
CREATE UNIQUE INDEX "CropRegionOmrChoiceOption_omrConfigId_choiceIndex_key" ON "CropRegionOmrChoiceOption"("omrConfigId", "choiceIndex");
CREATE INDEX "CropRegionOmrChoiceOption_omrConfigId_idx" ON "CropRegionOmrChoiceOption"("omrConfigId");
CREATE INDEX "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId");
CREATE UNIQUE INDEX "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId");
CREATE UNIQUE INDEX "CropSubtotal_cropRegionId_subtotalId_assignmentType_key" ON "CropSubtotal"("cropRegionId", "subtotalId", "assignmentType");
CREATE INDEX "DrawingAnnotation_createdAt_idx" ON "DrawingAnnotation"("createdAt");
CREATE INDEX "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite");
CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId");
CREATE INDEX "DrawingAnnotation_type_idx" ON "DrawingAnnotation"("type");
CREATE INDEX "ExamAnswerOverlayStyle_examId_idx" ON "ExamAnswerOverlayStyle"("examId");
CREATE UNIQUE INDEX "ExamAnswerOverlayStyle_examId_overlayKind_key" ON "ExamAnswerOverlayStyle"("examId", "overlayKind");
CREATE INDEX "ExamAnswerOverlayVisibility_examId_idx" ON "ExamAnswerOverlayVisibility"("examId");
CREATE UNIQUE INDEX "ExamAnswerOverlayVisibility_examId_status_key" ON "ExamAnswerOverlayVisibility"("examId", "status");
CREATE INDEX "ExamClassroom_classroomId_idx" ON "ExamClassroom"("classroomId");
CREATE UNIQUE INDEX "ExamClassroom_examId_classroomId_key" ON "ExamClassroom"("examId", "classroomId");
CREATE INDEX "ExamClassroom_examId_idx" ON "ExamClassroom"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportGraphSettings_examId_key" ON "ExamIndividualReportGraphSettings"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportSettings_examId_key" ON "ExamIndividualReportSettings"("examId");
CREATE INDEX "ExamIndividualReportStatisticVisibility_examId_idx" ON "ExamIndividualReportStatisticVisibility"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportStatisticVisibility_examId_statisticKind_scope_key" ON "ExamIndividualReportStatisticVisibility"("examId", "statisticKind", "scope");
CREATE INDEX "ExamIndividualReportTableSection_examId_idx" ON "ExamIndividualReportTableSection"("examId");
CREATE UNIQUE INDEX "ExamIndividualReportTableSection_examId_tableKind_key" ON "ExamIndividualReportTableSection"("examId", "tableKind");
CREATE INDEX "ExamStudent_examId_customOrder_idx" ON "ExamStudent"("examId", "customOrder");
CREATE INDEX "ExamStudent_examId_idx" ON "ExamStudent"("examId");
CREATE UNIQUE INDEX "ExamStudent_examId_studentId_key" ON "ExamStudent"("examId", "studentId");
CREATE INDEX "ExamStudent_studentId_idx" ON "ExamStudent"("studentId");
CREATE INDEX "ExamSubtotalGroup_examId_idx" ON "ExamSubtotalGroup"("examId");
CREATE UNIQUE INDEX "ExamSubtotalGroup_examId_subtotalGroupId_key" ON "ExamSubtotalGroup"("examId", "subtotalGroupId");
CREATE INDEX "ExamSubtotalGroup_subtotalGroupId_idx" ON "ExamSubtotalGroup"("subtotalGroupId");
CREATE INDEX "ExamTag_examId_idx" ON "ExamTag"("examId");
CREATE UNIQUE INDEX "ExamTag_examId_tagId_key" ON "ExamTag"("examId", "tagId");
CREATE INDEX "ExamTag_tagId_idx" ON "ExamTag"("tagId");
CREATE INDEX "GradeClassroom_classroomId_idx" ON "GradeClassroom"("classroomId");
CREATE UNIQUE INDEX "GradeClassroom_gradeId_classroomId_key" ON "GradeClassroom"("gradeId", "classroomId");
CREATE INDEX "GradeClassroom_gradeId_idx" ON "GradeClassroom"("gradeId");
CREATE INDEX "GradeComparison_comparedGradeItemId_idx" ON "GradeComparison"("comparedGradeItemId");
CREATE UNIQUE INDEX "GradeComparison_gradeItemId_comparedGradeItemId_key" ON "GradeComparison"("gradeItemId", "comparedGradeItemId");
CREATE INDEX "GradeComparison_gradeItemId_idx" ON "GradeComparison"("gradeItemId");
CREATE INDEX "GradeConstraintExclusionLabel_constraintId_idx" ON "GradeConstraintExclusionLabel"("constraintId");
CREATE UNIQUE INDEX "GradeConstraintExclusionLabel_constraintId_label_key" ON "GradeConstraintExclusionLabel"("constraintId", "label");
CREATE INDEX "GradeConstraintLabelValue_constraintId_idx" ON "GradeConstraintLabelValue"("constraintId");
CREATE UNIQUE INDEX "GradeConstraintLabelValue_constraintId_label_key" ON "GradeConstraintLabelValue"("constraintId", "label");
CREATE UNIQUE INDEX "GradeConstraintViewpoint_constraintId_gradeItemId_key" ON "GradeConstraintViewpoint"("constraintId", "gradeItemId");
CREATE INDEX "GradeConstraintViewpoint_constraintId_idx" ON "GradeConstraintViewpoint"("constraintId");
CREATE INDEX "GradeConstraintViewpoint_gradeItemId_idx" ON "GradeConstraintViewpoint"("gradeItemId");
CREATE INDEX "GradeConstraint_gradeId_idx" ON "GradeConstraint"("gradeId");
CREATE INDEX "GradeConstraint_targetGradeItemId_idx" ON "GradeConstraint"("targetGradeItemId");
CREATE INDEX "GradeDataSourceEstimationSource_dataSourceId_idx" ON "GradeDataSourceEstimationSource"("dataSourceId");
CREATE UNIQUE INDEX "GradeDataSourceEstimationSource_dataSourceId_sourceDataSourceId_key" ON "GradeDataSourceEstimationSource"("dataSourceId", "sourceDataSourceId");
CREATE INDEX "GradeDataSourceEstimationSource_sourceDataSourceId_idx" ON "GradeDataSourceEstimationSource"("sourceDataSourceId");
CREATE INDEX "GradeDataSource_courseworkId_idx" ON "GradeDataSource"("courseworkId");
CREATE INDEX "GradeDataSource_courseworkItemId_idx" ON "GradeDataSource"("courseworkItemId");
CREATE INDEX "GradeDataSource_cropRegionId_idx" ON "GradeDataSource"("cropRegionId");
CREATE INDEX "GradeDataSource_examId_idx" ON "GradeDataSource"("examId");
CREATE INDEX "GradeDataSource_gradeItemId_idx" ON "GradeDataSource"("gradeItemId");
CREATE INDEX "GradeDataSource_subtotalId_idx" ON "GradeDataSource"("subtotalId");
CREATE INDEX "GradeFrozenScore_gradeItemId_idx" ON "GradeFrozenScore"("gradeItemId");
CREATE UNIQUE INDEX "GradeFrozenScore_gradeStudentId_gradeItemId_key" ON "GradeFrozenScore"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeFrozenScore_gradeStudentId_idx" ON "GradeFrozenScore"("gradeStudentId");
CREATE UNIQUE INDEX "GradeIndividualReportSettings_gradeId_key" ON "GradeIndividualReportSettings"("gradeId");
CREATE INDEX "GradeItemBoundary_gradeItemId_idx" ON "GradeItemBoundary"("gradeItemId");
CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId");
CREATE UNIQUE INDEX "GradeItemExclusion_gradeStudentId_gradeItemId_key" ON "GradeItemExclusion"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeItemExclusion_gradeStudentId_idx" ON "GradeItemExclusion"("gradeStudentId");
CREATE INDEX "GradeItem_gradeId_idx" ON "GradeItem"("gradeId");
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");
CREATE UNIQUE INDEX "GradeOverride_gradeStudentId_gradeItemId_key" ON "GradeOverride"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeOverride_gradeStudentId_idx" ON "GradeOverride"("gradeStudentId");
CREATE INDEX "GradeStudent_gradeId_customOrder_idx" ON "GradeStudent"("gradeId", "customOrder");
CREATE INDEX "GradeStudent_gradeId_idx" ON "GradeStudent"("gradeId");
CREATE UNIQUE INDEX "GradeStudent_gradeId_studentId_key" ON "GradeStudent"("gradeId", "studentId");
CREATE INDEX "GradeStudent_studentId_idx" ON "GradeStudent"("studentId");
CREATE INDEX "GradeTag_gradeId_idx" ON "GradeTag"("gradeId");
CREATE UNIQUE INDEX "GradeTag_gradeId_tagId_key" ON "GradeTag"("gradeId", "tagId");
CREATE INDEX "GradeTag_tagId_idx" ON "GradeTag"("tagId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_examStudentId_idx" ON "QuestionScore"("examStudentId");
CREATE UNIQUE INDEX "ReturnSnapshot_examStudentId_key" ON "ReturnSnapshot"("examStudentId");
CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_examStudentId_key" ON "ScoreDecision"("cropRegionId", "examStudentId");
CREATE INDEX "ScoreDecision_examStudentId_idx" ON "ScoreDecision"("examStudentId");
CREATE UNIQUE INDEX "StudentAnswerImage_examPageId_examStudentId_key" ON "StudentAnswerImage"("examPageId", "examStudentId");
CREATE INDEX "StudentAnswerImage_examPageId_idx" ON "StudentAnswerImage"("examPageId");
CREATE INDEX "StudentAnswerImage_examStudentId_idx" ON "StudentAnswerImage"("examStudentId");
CREATE INDEX "StudentClassroomMembership_classroomId_attendanceNumber_idx" ON "StudentClassroomMembership"("classroomId", "attendanceNumber");
CREATE INDEX "StudentClassroomMembership_classroomId_idx" ON "StudentClassroomMembership"("classroomId");
CREATE INDEX "StudentClassroomMembership_startDate_endDate_idx" ON "StudentClassroomMembership"("startDate", "endDate");
CREATE INDEX "StudentClassroomMembership_studentId_idx" ON "StudentClassroomMembership"("studentId");
CREATE INDEX "Student_studentNumber_idx" ON "Student"("studentNumber");
CREATE INDEX "TagSubtotalGroup_subtotalGroupId_idx" ON "TagSubtotalGroup"("subtotalGroupId");
CREATE INDEX "TagSubtotalGroup_tagId_idx" ON "TagSubtotalGroup"("tagId");
CREATE UNIQUE INDEX "TagSubtotalGroup_tagId_subtotalGroupId_key" ON "TagSubtotalGroup"("tagId", "subtotalGroupId");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX "UserClickScoringAction_userId_clickCount_key" ON "UserClickScoringAction"("userId", "clickCount");
CREATE INDEX "UserClickScoringAction_userId_idx" ON "UserClickScoringAction"("userId");
CREATE INDEX "UserExam_examId_idx" ON "UserExam"("examId");
CREATE UNIQUE INDEX "UserExam_userId_examId_key" ON "UserExam"("userId", "examId");
CREATE UNIQUE INDEX "UserKeyboardShortcut_userId_action_key" ON "UserKeyboardShortcut"("userId", "action");
CREATE INDEX "UserKeyboardShortcut_userId_idx" ON "UserKeyboardShortcut"("userId");
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");
CREATE INDEX "UserScoringStatusColor_userId_idx" ON "UserScoringStatusColor"("userId");
CREATE UNIQUE INDEX "UserScoringStatusColor_userId_status_key" ON "UserScoringStatusColor"("userId", "status");
CREATE INDEX "UserSidePanelSection_userId_idx" ON "UserSidePanelSection"("userId");
CREATE UNIQUE INDEX "UserSidePanelSection_userId_sectionId_key" ON "UserSidePanelSection"("userId", "sectionId");
INSERT INTO "Classroom" ("id", "name", "classroomCode", "grade", "description", "isVisible", "createdAt", "updatedAt") VALUES ('9f7bc75f-27d1-4359-a0ab-556833d89c90', 'テストクラス_1791078907895_moq1', NULL, NULL, NULL, 1, '2026-10-04T01:55:07.896+00:00', '2026-10-04T01:55:07.896+00:00');
INSERT INTO "Classroom" ("id", "name", "classroomCode", "grade", "description", "isVisible", "createdAt", "updatedAt") VALUES ('6833c57d-b326-4757-827a-fd9ef4405502', 'テストクラス_1791078908353_7tbb', NULL, NULL, NULL, 1, '2026-10-04T01:55:08.353+00:00', '2026-10-04T01:55:08.353+00:00');
INSERT INTO "Classroom" ("id", "name", "classroomCode", "grade", "description", "isVisible", "createdAt", "updatedAt") VALUES ('7f02db95-f28b-418d-8488-ab5337043cff', '前年度の学級', NULL, NULL, NULL, 1, '2026-10-04T01:55:08.708+00:00', '2026-10-04T01:55:08.708+00:00');
INSERT INTO "Coursework" ("id", "name", "description", "referenceDate", "createdAt", "updatedAt") VALUES ('cb2e59b2-b151-45ce-8005-954acb537b50', '提出物', NULL, NULL, '2026-10-04T01:55:08.715+00:00', '2026-10-04T01:55:08.715+00:00');
INSERT INTO "CourseworkItem" ("id", "courseworkId", "name", "order", "maxScore", "inputMode", "createdAt", "updatedAt") VALUES ('d246581e-dc57-4601-a11e-c98a320a9283', 'cb2e59b2-b151-45ce-8005-954acb537b50', 'レポート', 0, 10, 'numeric', '2026-10-04T01:55:08.880+00:00', '2026-10-04T01:55:08.880+00:00');
INSERT INTO "CourseworkStudent" ("id", "courseworkId", "studentId", "customOrder", "createdAt", "updatedAt") VALUES ('e89c9e35-74f3-490b-b48a-9aa4aa8534f5', 'cb2e59b2-b151-45ce-8005-954acb537b50', 'd10353eb-778f-43be-a349-b3852040f919', NULL, '2026-10-04T01:55:08.884+00:00', '2026-10-04T01:55:08.884+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('513eb1af-2932-40ef-9a4e-b3d246232d4b', 'e7756059-4b08-4899-bf01-7c2211ad51e1', '問1', 'QUESTION_ANSWER', 0, 0, 200, 80, 10, 0, '2026-10-04T01:55:07.836+00:00', '2026-10-04T01:55:07.836+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('962590e8-bd23-4afd-8a51-73891ef52c36', 'e7756059-4b08-4899-bf01-7c2211ad51e1', '問2', 'QUESTION_ANSWER', 0, 100, 200, 80, 10, 1, '2026-10-04T01:55:07.843+00:00', '2026-10-04T01:55:07.843+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('daa72509-2f1d-4080-b0f4-da049387b56e', 'd42bb185-1a15-4eec-bd6d-aa4d2bf4d2a1', '問3', 'QUESTION_ANSWER', 0, 0, 200, 80, 10, 2, '2026-10-04T01:55:07.848+00:00', '2026-10-04T01:55:07.848+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('8ca9ffac-ff9e-43e2-b127-bb96dd6772dd', 'd42bb185-1a15-4eec-bd6d-aa4d2bf4d2a1', '問4', 'QUESTION_ANSWER', 0, 100, 200, 80, 10, 3, '2026-10-04T01:55:07.855+00:00', '2026-10-04T01:55:07.855+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('ba7ba1db-071b-4086-9d5b-c6983b27b195', 'd4b1275d-8be2-4f82-8ce5-66bcbc7d4cbd', '問1', 'QUESTION_ANSWER', 0, 0, 200, 80, 10, 0, '2026-10-04T01:55:08.306+00:00', '2026-10-04T01:55:08.306+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('a05d4d8f-de7b-4ad3-954b-5f367e036609', 'd4b1275d-8be2-4f82-8ce5-66bcbc7d4cbd', '問2', 'QUESTION_ANSWER', 0, 100, 200, 80, 10, 1, '2026-10-04T01:55:08.330+00:00', '2026-10-04T01:55:08.330+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('a9c3994b-861f-4033-9d36-4657486d8e90', 'c3ed5979-b1f5-4979-b9a0-0a8909b86cd2', '問3', 'QUESTION_ANSWER', 0, 0, 200, 80, 10, 2, '2026-10-04T01:55:08.337+00:00', '2026-10-04T01:55:08.337+00:00');
INSERT INTO "CropRegion" ("id", "examPageId", "label", "type", "x", "y", "width", "height", "points", "orderIndex", "createdAt", "updatedAt") VALUES ('5fb146d6-bc98-4741-a9b8-398efdf6cd29', 'c3ed5979-b1f5-4979-b9a0-0a8909b86cd2', '問4', 'QUESTION_ANSWER', 0, 100, 200, 80, 10, 3, '2026-10-04T01:55:08.345+00:00', '2026-10-04T01:55:08.345+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('7a432235-72d6-49ae-bbc7-a4385ed0e9fb', '513eb1af-2932-40ef-9a4e-b3d246232d4b', 'd9f0b4ce-0cb5-4ce8-8999-fc08fdb2e541', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.025+00:00', '2026-10-04T01:55:08.025+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('1ee1682d-a7da-4fcf-ac87-cb54ec7fe512', '962590e8-bd23-4afd-8a51-73891ef52c36', 'd17f8b80-fa86-4614-9e5e-80622113de75', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.029+00:00', '2026-10-04T01:55:08.029+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('d5dbbbe3-4fe6-4437-9ea8-1c4a18ee9edd', 'daa72509-2f1d-4080-b0f4-da049387b56e', 'd9f0b4ce-0cb5-4ce8-8999-fc08fdb2e541', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.033+00:00', '2026-10-04T01:55:08.033+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('7e4ccbbd-9b01-41a2-97bc-2da9cef1985d', '8ca9ffac-ff9e-43e2-b127-bb96dd6772dd', 'd17f8b80-fa86-4614-9e5e-80622113de75', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.038+00:00', '2026-10-04T01:55:08.038+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('de9d731a-cc98-4d2a-bb21-0af999f20924', 'ba7ba1db-071b-4086-9d5b-c6983b27b195', 'e24e217f-7bde-456e-9da3-c9cc569953e8', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.512+00:00', '2026-10-04T01:55:08.512+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('d527d947-f811-4374-a202-ff1f501692ff', 'a05d4d8f-de7b-4ad3-954b-5f367e036609', 'fd816607-7947-479c-a33b-cab197e0db81', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.526+00:00', '2026-10-04T01:55:08.526+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('3e95fd51-e477-4417-a400-95632a2b6cce', 'a9c3994b-861f-4033-9d36-4657486d8e90', 'e24e217f-7bde-456e-9da3-c9cc569953e8', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.530+00:00', '2026-10-04T01:55:08.530+00:00');
INSERT INTO "CropSubtotal" ("id", "cropRegionId", "subtotalId", "assignmentType", "createdAt", "updatedAt") VALUES ('fa825d01-70b2-4085-9967-dfa88320f583', '5fb146d6-bc98-4741-a9b8-398efdf6cd29', 'fd816607-7947-479c-a33b-cab197e0db81', 'QUESTION_ASSIGNMENT', '2026-10-04T01:55:08.534+00:00', '2026-10-04T01:55:08.534+00:00');
INSERT INTO "DrawingAnnotation" ("id", "questionScoreId", "type", "x", "y", "color", "strokeWidth", "width", "height", "endX", "endY", "lineStyle", "text", "fontSize", "textBoxWidth", "textBoxHeight", "horizontalAlign", "verticalAlign", "anchorDirection", "displayX", "displayY", "isFavorite", "createdAt", "updatedAt") VALUES ('d6ff19ec-ad93-4555-abf7-a5c927aaeead', 'b672bf23-66fd-49ae-893b-73e94a75a4c4', 'line', 10, 10, '#ef4444', 0.5, 0, 0, 0, 0, 'solid', '', 4, 0, 0, 'left', 'top', 'top-left', 0, 0, 0, '2026-10-04T01:55:08.197+00:00', '2026-10-04T01:55:08.197+00:00');
INSERT INTO "Exam" ("id", "examName", "referenceDate", "description", "markerCorrectionEnabled", "createdAt", "updatedAt") VALUES ('15b436a6-08e6-48ea-b37f-3e19255132ba', '試験A', '2025-07-01T00:00:00.000+00:00', NULL, 0, '2026-10-04T01:55:07.807+00:00', '2026-10-04T01:55:07.807+00:00');
INSERT INTO "Exam" ("id", "examName", "referenceDate", "description", "markerCorrectionEnabled", "createdAt", "updatedAt") VALUES ('64811060-8402-4d1a-8ede-aef5a272199f', '試験B', '2025-07-01T00:00:00.000+00:00', NULL, 0, '2026-10-04T01:55:08.207+00:00', '2026-10-04T01:55:08.207+00:00');
INSERT INTO "ExamClassroom" ("id", "examId", "classroomId", "administered", "order", "createdAt", "updatedAt", "teacherStatistics", "studentReport") VALUES ('da05d98e-c82f-43b6-b8f8-aa73fdcb9060', '15b436a6-08e6-48ea-b37f-3e19255132ba', '9f7bc75f-27d1-4359-a0ab-556833d89c90', 1, 0, '2026-10-04T01:55:07.997+00:00', '2026-10-04T01:55:07.997+00:00', 1, 1);
INSERT INTO "ExamClassroom" ("id", "examId", "classroomId", "administered", "order", "createdAt", "updatedAt", "teacherStatistics", "studentReport") VALUES ('725e277e-22a4-4622-85aa-ca339d575bc7', '64811060-8402-4d1a-8ede-aef5a272199f', '6833c57d-b326-4757-827a-fd9ef4405502', 1, 0, '2026-10-04T01:55:08.414+00:00', '2026-10-04T01:55:08.414+00:00', 1, 1);
INSERT INTO "ExamPage" ("id", "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt") VALUES ('e7756059-4b08-4899-bf01-7c2211ad51e1', '15b436a6-08e6-48ea-b37f-3e19255132ba', 1, '', 'A4', '2026-10-04T01:55:07.828+00:00', '2026-10-04T01:55:07.828+00:00');
INSERT INTO "ExamPage" ("id", "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt") VALUES ('d42bb185-1a15-4eec-bd6d-aa4d2bf4d2a1', '15b436a6-08e6-48ea-b37f-3e19255132ba', 2, '', 'A4', '2026-10-04T01:55:07.831+00:00', '2026-10-04T01:55:07.831+00:00');
INSERT INTO "ExamPage" ("id", "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt") VALUES ('d4b1275d-8be2-4f82-8ce5-66bcbc7d4cbd', '64811060-8402-4d1a-8ede-aef5a272199f', 1, '', 'A4', '2026-10-04T01:55:08.215+00:00', '2026-10-04T01:55:08.215+00:00');
INSERT INTO "ExamPage" ("id", "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt") VALUES ('c3ed5979-b1f5-4979-b9a0-0a8909b86cd2', '64811060-8402-4d1a-8ede-aef5a272199f', 2, '', 'A4', '2026-10-04T01:55:08.218+00:00', '2026-10-04T01:55:08.218+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', '15b436a6-08e6-48ea-b37f-3e19255132ba', 'd10353eb-778f-43be-a349-b3852040f919', 'PARTICIPATING', NULL, '2026-10-04T01:55:07.959+00:00', '2026-10-04T01:55:07.959+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('90f12c82-e9e6-48cb-9fda-71b90917b08b', '15b436a6-08e6-48ea-b37f-3e19255132ba', 'd19db965-b040-4734-9944-c4999a52a84b', 'PARTICIPATING', NULL, '2026-10-04T01:55:07.972+00:00', '2026-10-04T01:55:07.972+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('e1caaf3d-6dc5-4f66-8aa1-46e6247ebda9', '15b436a6-08e6-48ea-b37f-3e19255132ba', 'f84852c2-465c-40c9-90b9-cbfd8cf677a5', 'PARTICIPATING', NULL, '2026-10-04T01:55:07.995+00:00', '2026-10-04T01:55:07.995+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('bb725cc6-40e2-4594-b7fa-91e570f492b0', '64811060-8402-4d1a-8ede-aef5a272199f', 'ef344e71-581e-4399-9ba3-036b1b948d49', 'PARTICIPATING', NULL, '2026-10-04T01:55:08.380+00:00', '2026-10-04T01:55:08.380+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('71c2eb7d-0ba5-444e-ab43-8cfd138cb4b9', '64811060-8402-4d1a-8ede-aef5a272199f', '39a96b44-ac12-4db3-a570-0efc07702fee', 'PARTICIPATING', NULL, '2026-10-04T01:55:08.394+00:00', '2026-10-04T01:55:08.394+00:00');
INSERT INTO "ExamStudent" ("id", "examId", "studentId", "status", "customOrder", "createdAt", "updatedAt") VALUES ('a419ed89-1b40-4d21-a1a2-1eba336fe99c', '64811060-8402-4d1a-8ede-aef5a272199f', 'fa8f4a8f-c3a3-4bf7-86fc-0368ac09d9fc', 'PARTICIPATING', NULL, '2026-10-04T01:55:08.411+00:00', '2026-10-04T01:55:08.411+00:00');
INSERT INTO "ExamSubtotalGroup" ("id", "examId", "subtotalGroupId", "selectedForTable", "selectedForBoxPlot", "createdAt", "updatedAt") VALUES ('bae4d773-2a65-442b-af23-0cc7cef926ae', '15b436a6-08e6-48ea-b37f-3e19255132ba', '52ff9092-ed3b-4f4e-a694-e10f215d6d4c', 0, 0, '2026-10-04T01:55:08.012+00:00', '2026-10-04T01:55:08.012+00:00');
INSERT INTO "ExamSubtotalGroup" ("id", "examId", "subtotalGroupId", "selectedForTable", "selectedForBoxPlot", "createdAt", "updatedAt") VALUES ('325ff169-62a5-4eb7-9b9f-0d71bcefa27c', '64811060-8402-4d1a-8ede-aef5a272199f', 'd2949e2b-a70e-412b-97fa-e692f278b77d', 0, 0, '2026-10-04T01:55:08.503+00:00', '2026-10-04T01:55:08.503+00:00');
INSERT INTO "Grade" ("id", "name", "description", "referenceDate", "createdAt", "updatedAt") VALUES ('ff9982fd-da49-4484-bbf8-86b9fc36422d', '前学期', NULL, NULL, '2026-10-04T01:55:08.889+00:00', '2026-10-04T01:55:08.889+00:00');
INSERT INTO "Grade" ("id", "name", "description", "referenceDate", "createdAt", "updatedAt") VALUES ('17964586-9529-4c33-92b7-e2d3a47209f1', '後学期', NULL, NULL, '2026-10-04T01:55:08.907+00:00', '2026-10-04T01:55:08.907+00:00');
INSERT INTO "GradeComparison" ("id", "gradeItemId", "comparedGradeItemId", "order", "createdAt", "updatedAt") VALUES ('cd5e129b-f08a-4961-9438-1274bac3269c', '70e86e4a-4681-4648-98cf-b437465969f1', '30e84ab0-e4fb-4759-8103-9480306bb0e7', 0, '2026-10-04T01:55:08.938+00:00', '2026-10-04T01:55:08.938+00:00');
INSERT INTO "GradeDataSource" ("id", "gradeItemId", "type", "examId", "subtotalId", "cropRegionId", "name", "weight", "order", "absentMethod", "absentRatio", "absentOffset", "treatExpectedAsMissing", "estimationMode", "createdAt", "updatedAt", "courseworkItemId", "courseworkId") VALUES ('430673b0-573c-4eea-902e-0b214a3c4295', '70e86e4a-4681-4648-98cf-b437465969f1', 'exam_total', '15b436a6-08e6-48ea-b37f-3e19255132ba', NULL, NULL, '試験A', 1, 0, 'null', 1, 0, 0, 'all', '2026-10-04T01:55:08.918+00:00', '2026-10-04T01:55:08.918+00:00', NULL, NULL);
INSERT INTO "GradeDataSource" ("id", "gradeItemId", "type", "examId", "subtotalId", "cropRegionId", "name", "weight", "order", "absentMethod", "absentRatio", "absentOffset", "treatExpectedAsMissing", "estimationMode", "createdAt", "updatedAt", "courseworkItemId", "courseworkId") VALUES ('667ff2fa-dfb6-4b73-8ebb-b3b3a041a1ee', '70e86e4a-4681-4648-98cf-b437465969f1', 'coursework', NULL, NULL, NULL, 'レポート', 1, 0, 'null', 1, 0, 0, 'all', '2026-10-04T01:55:08.928+00:00', '2026-10-04T01:55:08.928+00:00', 'd246581e-dc57-4601-a11e-c98a320a9283', 'cb2e59b2-b151-45ce-8005-954acb537b50');
INSERT INTO "GradeItem" ("id", "gradeId", "name", "order", "createdAt", "updatedAt") VALUES ('30e84ab0-e4fb-4759-8103-9480306bb0e7', 'ff9982fd-da49-4484-bbf8-86b9fc36422d', '知識', 0, '2026-10-04T01:55:08.902+00:00', '2026-10-04T01:55:08.902+00:00');
INSERT INTO "GradeItem" ("id", "gradeId", "name", "order", "createdAt", "updatedAt") VALUES ('70e86e4a-4681-4648-98cf-b437465969f1', '17964586-9529-4c33-92b7-e2d3a47209f1', '知識', 0, '2026-10-04T01:55:08.909+00:00', '2026-10-04T01:55:08.909+00:00');
INSERT INTO "GradeStudent" ("id", "gradeId", "studentId", "customOrder", "createdAt", "updatedAt") VALUES ('b568dd0c-c631-4985-9d15-2f7410446b42', '17964586-9529-4c33-92b7-e2d3a47209f1', 'd10353eb-778f-43be-a349-b3852040f919', NULL, '2026-10-04T01:55:08.933+00:00', '2026-10-04T01:55:08.933+00:00');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('b672bf23-66fd-49ae-893b-73e94a75a4c4', '513eb1af-2932-40ef-9a4e-b3d246232d4b', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.052+00:00', '2026-10-04T01:55:08.052+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('7676ec31-0f8a-4e03-9c02-6f0ebc3a665a', '513eb1af-2932-40ef-9a4e-b3d246232d4b', '90f12c82-e9e6-48cb-9fda-71b90917b08b', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.056+00:00', '2026-10-04T01:55:08.056+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('cac035f2-967e-4d2e-8d08-10443aea062e', '513eb1af-2932-40ef-9a4e-b3d246232d4b', 'e1caaf3d-6dc5-4f66-8aa1-46e6247ebda9', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.151+00:00', '2026-10-04T01:55:08.151+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('aef0e68f-2be3-445c-89ae-457990546da9', '962590e8-bd23-4afd-8a51-73891ef52c36', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.155+00:00', '2026-10-04T01:55:08.155+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('99ec64df-1064-4035-85fe-619c3f2f6bb0', '962590e8-bd23-4afd-8a51-73891ef52c36', '90f12c82-e9e6-48cb-9fda-71b90917b08b', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.158+00:00', '2026-10-04T01:55:08.158+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('c6cba527-f43e-47d9-98cf-d848a3007530', '962590e8-bd23-4afd-8a51-73891ef52c36', 'e1caaf3d-6dc5-4f66-8aa1-46e6247ebda9', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.161+00:00', '2026-10-04T01:55:08.161+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('dbdcfdb9-4da0-4b02-acbb-17a98e772d8d', 'daa72509-2f1d-4080-b0f4-da049387b56e', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.167+00:00', '2026-10-04T01:55:08.167+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('cf2ad1f0-9c37-4d41-882c-2b9afcca3c4b', 'daa72509-2f1d-4080-b0f4-da049387b56e', '90f12c82-e9e6-48cb-9fda-71b90917b08b', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.177+00:00', '2026-10-04T01:55:08.177+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('d03d1c40-902d-4033-8b70-86afde0a2322', 'daa72509-2f1d-4080-b0f4-da049387b56e', 'e1caaf3d-6dc5-4f66-8aa1-46e6247ebda9', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.179+00:00', '2026-10-04T01:55:08.179+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('8ec2a578-f9ce-4650-b9b9-1fb2d5cb3359', '8ca9ffac-ff9e-43e2-b127-bb96dd6772dd', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.181+00:00', '2026-10-04T01:55:08.181+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('e037d5a0-212b-41b3-ad1d-8902922b6da3', '8ca9ffac-ff9e-43e2-b127-bb96dd6772dd', '90f12c82-e9e6-48cb-9fda-71b90917b08b', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.185+00:00', '2026-10-04T01:55:08.185+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('e7f34019-b284-4ffe-9c53-6cbd4d20ca16', '8ca9ffac-ff9e-43e2-b127-bb96dd6772dd', 'e1caaf3d-6dc5-4f66-8aa1-46e6247ebda9', 10, 'correct', '2945a070-5b91-46d5-8103-07d80a14561e', '2026-10-04T01:55:08.189+00:00', '2026-10-04T01:55:08.189+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('46bcc9f3-3b27-4264-a1a6-cad27632fef2', 'ba7ba1db-071b-4086-9d5b-c6983b27b195', 'bb725cc6-40e2-4594-b7fa-91e570f492b0', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.544+00:00', '2026-10-04T01:55:08.544+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('09b7ed2e-0a49-4f73-a9c7-7afbe276fd80', 'ba7ba1db-071b-4086-9d5b-c6983b27b195', '71c2eb7d-0ba5-444e-ab43-8cfd138cb4b9', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.570+00:00', '2026-10-04T01:55:08.570+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('4778b470-c583-4396-b615-620d158075f4', 'ba7ba1db-071b-4086-9d5b-c6983b27b195', 'a419ed89-1b40-4d21-a1a2-1eba336fe99c', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.588+00:00', '2026-10-04T01:55:08.588+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('fb18df4c-c8f8-4d53-8d35-dc49f059be38', 'a05d4d8f-de7b-4ad3-954b-5f367e036609', 'bb725cc6-40e2-4594-b7fa-91e570f492b0', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.630+00:00', '2026-10-04T01:55:08.630+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('3afb2a18-6735-4da2-81e2-38d14ea032ea', 'a05d4d8f-de7b-4ad3-954b-5f367e036609', '71c2eb7d-0ba5-444e-ab43-8cfd138cb4b9', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.653+00:00', '2026-10-04T01:55:08.653+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('48dbd2e1-9abe-47f6-8eec-d69257ad73fc', 'a05d4d8f-de7b-4ad3-954b-5f367e036609', 'a419ed89-1b40-4d21-a1a2-1eba336fe99c', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.656+00:00', '2026-10-04T01:55:08.656+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('8adb6913-afb3-4480-908b-5d324e9f8485', 'a9c3994b-861f-4033-9d36-4657486d8e90', 'bb725cc6-40e2-4594-b7fa-91e570f492b0', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.658+00:00', '2026-10-04T01:55:08.658+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('8c388801-34dc-499b-83bc-e747af85d2e2', 'a9c3994b-861f-4033-9d36-4657486d8e90', '71c2eb7d-0ba5-444e-ab43-8cfd138cb4b9', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.661+00:00', '2026-10-04T01:55:08.661+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('7de5d87c-229b-42c1-b89c-7952c97ee7d3', 'a9c3994b-861f-4033-9d36-4657486d8e90', 'a419ed89-1b40-4d21-a1a2-1eba336fe99c', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.664+00:00', '2026-10-04T01:55:08.664+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('7c76f918-27e7-49fc-83fa-f5dd912d4d20', '5fb146d6-bc98-4741-a9b8-398efdf6cd29', 'bb725cc6-40e2-4594-b7fa-91e570f492b0', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.670+00:00', '2026-10-04T01:55:08.670+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('c5951034-93ab-4ebb-b0ad-f65145c80a6d', '5fb146d6-bc98-4741-a9b8-398efdf6cd29', '71c2eb7d-0ba5-444e-ab43-8cfd138cb4b9', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.679+00:00', '2026-10-04T01:55:08.679+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('859bcdb4-2f90-402d-89f4-4e7ad3a5c1d0', '5fb146d6-bc98-4741-a9b8-398efdf6cd29', 'a419ed89-1b40-4d21-a1a2-1eba336fe99c', 10, 'correct', '0319f777-28be-4f8f-a783-d12b118867a9', '2026-10-04T01:55:08.685+00:00', '2026-10-04T01:55:08.685+00:00', '');
INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") VALUES ('f7525da0-eef6-4e7f-b676-8071979f0324', '513eb1af-2932-40ef-9a4e-b3d246232d4b', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', NULL, 'correct', '0a5276d8-f3d2-47d1-ab7a-4e95359c298a', '2026-10-04T01:55:08.695+00:00', '2026-10-04T01:55:08.695+00:00', '');
INSERT INTO "ScoreDecision" ("id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt") VALUES ('0a56f243-0a99-438d-8f3a-35b1fb463fb9', '513eb1af-2932-40ef-9a4e-b3d246232d4b', 'ffb02282-6a2b-4e89-be06-db5a6dc0dbe7', 'correct', NULL, NULL, '0a5276d8-f3d2-47d1-ab7a-4e95359c298a', '2026-10-04T01:55:08.703+00:00', '2026-10-04T01:55:08.703+00:00', '2026-10-04T01:55:08.703+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('d10353eb-778f-43be-a349-b3852040f919', 'S001_1791078907921_7nb6', '姓1', '名1', 'セイ1', 'メイ1', 2024, '2026-10-04T01:55:07.930+00:00', '2026-10-04T01:55:07.930+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('d19db965-b040-4734-9944-c4999a52a84b', 'S002_1791078907961_g5tz', '姓2', '名2', 'セイ2', 'メイ2', 2024, '2026-10-04T01:55:07.961+00:00', '2026-10-04T01:55:07.961+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('f84852c2-465c-40c9-90b9-cbfd8cf677a5', 'S003_1791078907980_dmnm', '姓3', '名3', 'セイ3', 'メイ3', 2024, '2026-10-04T01:55:07.981+00:00', '2026-10-04T01:55:07.981+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('ef344e71-581e-4399-9ba3-036b1b948d49', 'S001_1791078908360_w93i', '姓1', '名1', 'セイ1', 'メイ1', 2024, '2026-10-04T01:55:08.360+00:00', '2026-10-04T01:55:08.360+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('39a96b44-ac12-4db3-a570-0efc07702fee', 'S002_1791078908384_g9rw', '姓2', '名2', 'セイ2', 'メイ2', 2024, '2026-10-04T01:55:08.384+00:00', '2026-10-04T01:55:08.384+00:00');
INSERT INTO "Student" ("id", "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "enrollmentYear", "createdAt", "updatedAt") VALUES ('fa8f4a8f-c3a3-4bf7-86fc-0368ac09d9fc', 'S003_1791078908405_ld3d', '姓3', '名3', 'セイ3', 'メイ3', 2024, '2026-10-04T01:55:08.405+00:00', '2026-10-04T01:55:08.405+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('2b2a2a2e-485a-4903-bf62-4dad969233ba', 'd10353eb-778f-43be-a349-b3852040f919', '9f7bc75f-27d1-4359-a0ab-556833d89c90', '2025-04-01T00:00:00.000+00:00', NULL, 1, NULL, '2026-10-04T01:55:07.935+00:00', '2026-10-04T01:55:07.935+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('e2d13978-0915-42df-a0a7-151d0098ea76', 'd19db965-b040-4734-9944-c4999a52a84b', '9f7bc75f-27d1-4359-a0ab-556833d89c90', '2025-04-01T00:00:00.000+00:00', NULL, 2, NULL, '2026-10-04T01:55:07.963+00:00', '2026-10-04T01:55:07.963+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('f568f28c-773a-4516-9dce-6a9772d43aa0', 'f84852c2-465c-40c9-90b9-cbfd8cf677a5', '9f7bc75f-27d1-4359-a0ab-556833d89c90', '2025-04-01T00:00:00.000+00:00', NULL, 3, NULL, '2026-10-04T01:55:07.986+00:00', '2026-10-04T01:55:07.986+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('107f8f2e-6cce-4f46-9baf-40806e08c8fd', 'ef344e71-581e-4399-9ba3-036b1b948d49', '6833c57d-b326-4757-827a-fd9ef4405502', '2025-04-01T00:00:00.000+00:00', NULL, 1, NULL, '2026-10-04T01:55:08.372+00:00', '2026-10-04T01:55:08.372+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('ebf802c0-4460-4ecb-967e-d247b6a388cb', '39a96b44-ac12-4db3-a570-0efc07702fee', '6833c57d-b326-4757-827a-fd9ef4405502', '2025-04-01T00:00:00.000+00:00', NULL, 2, NULL, '2026-10-04T01:55:08.385+00:00', '2026-10-04T01:55:08.385+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('b88adb4b-153d-4996-97ff-9bf286977889', 'fa8f4a8f-c3a3-4bf7-86fc-0368ac09d9fc', '6833c57d-b326-4757-827a-fd9ef4405502', '2025-04-01T00:00:00.000+00:00', NULL, 3, NULL, '2026-10-04T01:55:08.409+00:00', '2026-10-04T01:55:08.409+00:00');
INSERT INTO "StudentClassroomMembership" ("id", "studentId", "classroomId", "startDate", "endDate", "attendanceNumber", "notes", "createdAt", "updatedAt") VALUES ('c3b35b12-4385-4337-b6e5-5efa47f493cb', 'd10353eb-778f-43be-a349-b3852040f919', '7f02db95-f28b-418d-8488-ab5337043cff', '2026-10-04T01:55:08.710+00:00', NULL, NULL, NULL, '2026-10-04T01:55:08.710+00:00', '2026-10-04T01:55:08.710+00:00');
INSERT INTO "Subtotal" ("id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt") VALUES ('d9f0b4ce-0cb5-4ce8-8999-fc08fdb2e541', '前半', '52ff9092-ed3b-4f4e-a694-e10f215d6d4c', 0, '2026-10-04T01:55:08.003+00:00', '2026-10-04T01:55:08.003+00:00');
INSERT INTO "Subtotal" ("id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt") VALUES ('d17f8b80-fa86-4614-9e5e-80622113de75', '後半', '52ff9092-ed3b-4f4e-a694-e10f215d6d4c', 1, '2026-10-04T01:55:08.004+00:00', '2026-10-04T01:55:08.004+00:00');
INSERT INTO "Subtotal" ("id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt") VALUES ('e24e217f-7bde-456e-9da3-c9cc569953e8', '前半', 'd2949e2b-a70e-412b-97fa-e692f278b77d', 0, '2026-10-04T01:55:08.421+00:00', '2026-10-04T01:55:08.421+00:00');
INSERT INTO "Subtotal" ("id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt") VALUES ('fd816607-7947-479c-a33b-cab197e0db81', '後半', 'd2949e2b-a70e-412b-97fa-e692f278b77d', 1, '2026-10-04T01:55:08.491+00:00', '2026-10-04T01:55:08.491+00:00');
INSERT INTO "SubtotalGroup" ("id", "name", "createdAt", "updatedAt") VALUES ('52ff9092-ed3b-4f4e-a694-e10f215d6d4c', '小計G_1791078907998_cekg', '2026-10-04T01:55:08.001+00:00', '2026-10-04T01:55:08.001+00:00');
INSERT INTO "SubtotalGroup" ("id", "name", "createdAt", "updatedAt") VALUES ('d2949e2b-a70e-412b-97fa-e692f278b77d', '小計G_1791078908415_wnjo', '2026-10-04T01:55:08.416+00:00', '2026-10-04T01:55:08.416+00:00');
INSERT INTO "User" ("id", "username", "passcode", "name", "role", "createdAt", "updatedAt", "passcodeType") VALUES ('2945a070-5b91-46d5-8103-07d80a14561e', 'testuser_1791078907700_h265', NULL, 'テストユーザー', 'teacher', '2026-10-04T01:55:07.790+00:00', '2026-10-04T01:55:07.790+00:00', 'none');
INSERT INTO "User" ("id", "username", "passcode", "name", "role", "createdAt", "updatedAt", "passcodeType") VALUES ('0319f777-28be-4f8f-a783-d12b118867a9', 'testuser_1791078908204_ltyc', NULL, 'テストユーザー', 'teacher', '2026-10-04T01:55:08.204+00:00', '2026-10-04T01:55:08.204+00:00', 'none');
INSERT INTO "User" ("id", "username", "passcode", "name", "role", "createdAt", "updatedAt", "passcodeType") VALUES ('0a5276d8-f3d2-47d1-ab7a-4e95359c298a', 'scorer_72d1f3ca-fe3b-4bee-aa64-d1d122c0fc70', NULL, '採点者2', 'teacher', '2026-10-04T01:55:08.692+00:00', '2026-10-04T01:55:08.692+00:00', 'none');
INSERT INTO "UserExam" ("id", "userId", "examId", "role", "invitedAt", "invitedBy", "createdAt", "updatedAt") VALUES ('1acec78c-32cc-4545-83cb-8dd8bbf6b533', '2945a070-5b91-46d5-8103-07d80a14561e', '15b436a6-08e6-48ea-b37f-3e19255132ba', 'OWNER', '2026-10-04T01:55:07.819+00:00', NULL, '2026-10-04T01:55:07.819+00:00', '2026-10-04T01:55:07.819+00:00');
INSERT INTO "UserExam" ("id", "userId", "examId", "role", "invitedAt", "invitedBy", "createdAt", "updatedAt") VALUES ('7f4a1ae4-fd0e-44e8-8eb1-d586f6b9f244', '0319f777-28be-4f8f-a783-d12b118867a9', '64811060-8402-4d1a-8ede-aef5a272199f', 'OWNER', '2026-10-04T01:55:08.210+00:00', NULL, '2026-10-04T01:55:08.210+00:00', '2026-10-04T01:55:08.210+00:00');
INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt") VALUES ('6d0d3613-30ff-41df-a699-40ce20415f80', '2945a070-5b91-46d5-8103-07d80a14561e', 'theme', 'dark', '2026-10-04T01:55:08.955+00:00', '2026-10-04T01:55:08.955+00:00');
INSERT INTO "UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt") VALUES ('cf2650fb-2352-479c-881e-61b3473144a7', '0319f777-28be-4f8f-a783-d12b118867a9', 'theme', 'light', '2026-10-04T01:55:08.957+00:00', '2026-10-04T01:55:08.957+00:00');
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('af3bc245-5003-48ff-8d9f-3043c9d1d4be', '27f171863cf6ec6f3b74b48035a1db39f7e46cffc0927420b78ec1d1b905abc5', '2026-10-04T01:55:04.607Z', '20260322232329_init', NULL, NULL, '2026-10-04T01:55:04.607Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('92defa1c-11cc-4408-8970-0f976576075a', '4b4c9ee32a7214bdc5bfa482faf1c30ad0b6b8276dcf26908c413aa7002de759', '2026-10-04T01:55:04.802Z', '20260322234436_rename_subject_to_tag_and_add_exam_tag', NULL, NULL, '2026-10-04T01:55:04.695Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0b7ec729-72dd-4b72-ac51-c8b6e03d5f3c', 'e9d35836504829d99e506c77a41db836ad1909b5d736c61b1a27bccb6885b34a', '2026-10-04T01:55:04.833Z', '20260323010447_add_tag_order_and_color', NULL, NULL, '2026-10-04T01:55:04.809Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('887c748d-128f-4f6a-919c-57e62b6ca38c', '4a95c440e04cb2f4539f870b461ce6cf4bdce3b7056f33d4794ab654cd3f92d7', '2026-10-04T01:55:04.982Z', '20260323115636_add_omr_bubble_compound_answer', NULL, NULL, '2026-10-04T01:55:04.849Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('69f3a293-fad2-4c0d-8f9b-bbf569084bcb', '2c256d8b7f8bd342d185e585e2639d8a8fdd6229a87ef5754c0f12a00ddd1b29', '2026-10-04T01:55:05.163Z', '20260527134558_add_marker_correction_enabled_to_exam', NULL, NULL, '2026-10-04T01:55:04.987Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e54a77d4-92cc-4e51-981f-8a2f759d68b1', '082ed7db0464c961d1b2888f5e6e2adcdf7a7f1912017fbcb94e11d6c4691b87', '2026-10-04T01:55:05.167Z', '20260611135650_add_score_decision', NULL, NULL, '2026-10-04T01:55:05.164Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('5df2ce2c-b8d4-40a3-88ea-50cd67616497', '2189be25c7908b6dd4636b5a56e16b426689f79ba91d774ea54cf59ca4d5d87b', '2026-10-04T01:55:05.199Z', '20260613124323_asb_manuscript_grid_lines_and_char_guides', NULL, NULL, '2026-10-04T01:55:05.168Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0340c713-624b-409c-bd61-abb86bce0cb0', '799717e38e9238f1feea7132a95a691085beb22005a1eb41fef33f33bed057df', '2026-10-04T01:55:05.210Z', '20260613144726_normalize_datetime_to_text', NULL, NULL, '2026-10-04T01:55:05.201Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('a91b8ee1-72b3-4a3d-a3ef-b565d9ba1ff6', '7170ea8ba356aa3e2f6d121eea577aa14c57d129dc2999e625e4c2d73d4c01d6', '2026-10-04T01:55:05.223Z', '20260613160451_asb_definition_vertical_layout', NULL, NULL, '2026-10-04T01:55:05.212Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d5143081-942c-4654-876b-b060bf89ffa3', 'ff5ff5ce9bfbad012ec58ced28b7efbd15fd16182204c224bd05abddff97f84b', '2026-10-04T01:55:05.229Z', '20260613170000_asb_manuscript_guide_padding', NULL, NULL, '2026-10-04T01:55:05.227Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('3fe1fd51-23f8-4796-b982-ed8713a40007', '171a965bec1fe0faa970f159f9842f60a8a908b1566cba1eed4da7bdd5bebb59', '2026-10-04T01:55:05.326Z', '20260613180000_asb_border_dash_ratios', NULL, NULL, '2026-10-04T01:55:05.230Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('1e1f0dc5-7d36-46ca-9ef6-3905722d6124', '3dbc21d5bb482c0ec739dc8150bc7dbe53bb84edd83e1672918ee0bcc3058028', '2026-10-04T01:55:05.346Z', '20260614120000_add_audit_log', NULL, NULL, '2026-10-04T01:55:05.329Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('69daf9f5-db28-440f-a112-dd589668a2b3', '33c194aae4bc7d85c634e7986b391752d5b01d493f5bfbae4ec85209a7b6f36f', '2026-10-04T01:55:05.385Z', '20260614130000_audit_log_updated_at', NULL, NULL, '2026-10-04T01:55:05.381Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('cf008197-d966-4c5c-9e85-02c07c014636', 'a8ffbdf4303332f094fc4d72b5f2ce6c7bdf381f18ca46f67081b60a840bb670', '2026-10-04T01:55:05.391Z', '20260614140000_audit_log_coalesce_key', NULL, NULL, '2026-10-04T01:55:05.387Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e39c128a-8016-478b-b5bf-3ec3875b81d4', '4b45eb9d6e80ea34d1bf2a66e15fdac69bd3988f3e294f3cc5144e859223642d', '2026-10-04T01:55:05.417Z', '20260615000000_add_return_snapshot', NULL, NULL, '2026-10-04T01:55:05.414Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('dcf1da40-de15-4d0a-b813-af0deb3b8b71', 'c99b8a72b4299e2b765b8378d358adff58d6dc16248386316bb3f00a03914ff1', '2026-10-04T01:55:05.455Z', '20260623000000_add_grade_letter_and_comment', NULL, NULL, '2026-10-04T01:55:05.423Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('3ba8c375-b5b0-4ebc-a5d0-8bf37bb3c424', '370af8c9732654f7e2c9ee6f57ce1ae0c7647a09ee1640ba461488e40d316d68', '2026-10-04T01:55:05.544Z', '20260623100000_promote_coursework', NULL, NULL, '2026-10-04T01:55:05.459Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e55f7a2c-704d-4bac-b6c5-eecb91d8b9dc', '9d58670aef4ae70a3a6038ecdc6612add7532749d1c45411a5abf78cdf1de333', '2026-10-04T01:55:05.558Z', '20260629120000_class_output_flags', NULL, NULL, '2026-10-04T01:55:05.548Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d3988431-d8fe-4b02-8c99-53455a0f07f7', '7170c561f2bbac303d9c3f44685721585deaaec012e92ab8185ef9b570ec2f01', '2026-10-04T01:55:05.565Z', '20260629130000_drop_examclass_statistics', NULL, NULL, '2026-10-04T01:55:05.559Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('5c244808-cbef-4e3e-8500-2146b525a40d', '48e58e9b823edfda7c2596dad1221808dffc9a61b7fe10f56851a6fe492b2ec3', '2026-10-04T01:55:05.568Z', '20260629140000_backfill_subtotal_selection_flags', NULL, NULL, '2026-10-04T01:55:05.567Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e8ff8479-0ecd-48ad-8633-d4f420919161', 'cf5442aa6cff6d6cc8eeafd38bf7eb480d5fec9d56a24a76a109fd82dfd8e871', '2026-10-04T01:55:05.569Z', '20260630010000_rebackfill_subtotal_selection_flags', NULL, NULL, '2026-10-04T01:55:05.569Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('ab4647e7-8b70-4a23-946d-c061e7228db4', '37c4830470959f2d070bbe9d910bd605d84adf94b4377a08ef03e96ccdaee4d0', '2026-10-04T01:55:05.588Z', '20260630120000_drop_gradedatasource_maxscore', NULL, NULL, '2026-10-04T01:55:05.575Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('da3054ad-e34b-47e9-a79e-b9497e4d35b0', 'f5bad41b3a3c2d5326de258fe7a245e14a03c26982372515dae2eab1a1b13b69', '2026-10-04T01:55:05.599Z', '20260701000000_add_grade_constraint', NULL, NULL, '2026-10-04T01:55:05.591Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0acdbb88-8c18-4c30-9303-ec15f1b14934', '7f1c64740cca2f13d613ff24d790d03f3058afca0f1437bb20d0015105f74d2b', '2026-10-04T01:55:05.615Z', '20260702000000_add_coursework_id_to_grade_data_source', NULL, NULL, '2026-10-04T01:55:05.604Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('5495c1de-eef7-43a8-a3b3-68ce9eabcda2', 'b0c43f28ee6f03326b1bc2687730073fb080efda1d49028e5357a9ee6020e0db', '2026-10-04T01:55:05.794Z', '20260702010000_rename_class_to_classroom', NULL, NULL, '2026-10-04T01:55:05.622Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d7c88d44-a085-4da3-bcd8-2de6a2d13883', '9d388399e2288eae4fdc3ba15a20449bf32917f7ca5efa46199986d8e6f2229a', '2026-10-04T01:55:05.838Z', '20260704000000_add_asb_char_guide', NULL, NULL, '2026-10-04T01:55:05.797Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('9f591867-481b-4dd3-bbeb-4a94831e777d', 'a1e695337977da1577b38f37fdd916cbb38adbc0cf9ec970b2ceb292484a7afa', '2026-10-04T01:55:06.017Z', '20260704010000_rename_class_tables_to_classroom', NULL, NULL, '2026-10-04T01:55:05.844Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0792c268-910e-4613-875c-ca044cf8141b', '197f38cde5af099162baf141e5092bdf39951e5bf5851368a6ac50d2d80a1ba6', '2026-10-04T01:55:06.021Z', '20260705000000_lowercase_examstudent_status', NULL, NULL, '2026-10-04T01:55:06.021Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('26323b0f-109d-4625-974f-1893a4588c2c', '51b931271e00e6abebf187893d6bbd05a6f6f2514e2bf3f5d7cbda6cf99ffbdd', '2026-10-04T01:55:06.040Z', '20260705010000_rename_classroom_classcode', NULL, NULL, '2026-10-04T01:55:06.028Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('1b4e37a3-99ff-4e35-80ec-d9cde313da7e', 'b42111a7a43b19f6bbe444c9686898e72cb319775ed05195bca07cc76afb8555', '2026-10-04T01:55:06.049Z', '20260713000000_add_asb_definition_tag', NULL, NULL, '2026-10-04T01:55:06.043Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d9d4e98d-359b-4f6b-9232-f9b7a3caadfa', '246b34c81cf05398d61f33989e3282a936cdd37f9c537f2bfcfa6bee1f9793c8', '2026-10-04T01:55:06.065Z', '20260725000000_restore_asb_manuscript_divider_columns', NULL, NULL, '2026-10-04T01:55:06.051Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('88ba0ab3-d36d-45ec-afee-20aefe2cd41e', 'cdd0f3627524082e007ad1b7bbc07192848ff0f646945e2e38c150d36b883ec0', '2026-10-04T01:55:06.082Z', '20260725150000_add_grade_frozen_score', NULL, NULL, '2026-10-04T01:55:06.070Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('042e9ece-595c-4d53-afb9-10a6e301134a', '0b9d830afc1260501241b562c880072d7c83bdecfac84e345b2d836b9993f251', '2026-10-04T01:55:06.100Z', '20260725160000_drop_crop_region_marking_override', NULL, NULL, '2026-10-04T01:55:06.096Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('9d843c5c-e674-436b-b06f-7c4abf0a70d3', '397f941a83da3bef07c24898d2bf1823b3f50a04087281ac1a4141825568da58', '2026-10-04T01:55:06.169Z', '20260725170000_drop_grade_overall_target', NULL, NULL, '2026-10-04T01:55:06.101Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('bfecc949-c4d7-4e7b-80ac-7ad4c9525585', '8940858d4658aeea6af8e5e6c32e0580840d5497711fc49d118a42dc4fdfee84', '2026-10-04T01:55:06.177Z', '20260726090000_drop_deleted_record', NULL, NULL, '2026-10-04T01:55:06.171Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('849204df-8a41-41c3-b5f2-eeca1b570f7d', '51f35acba6cb74914927cb975a0d73cf346bff0a8dde000ff01187e3d2ee21f6', '2026-10-04T01:55:06.201Z', '20260726100000_add_crop_region_assignment', NULL, NULL, '2026-10-04T01:55:06.190Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('3ec84c6d-da76-4127-8bf7-aa0ceb2a6b9f', 'c73a79085e027a1744c2cca55597fd486b8847163ca735cfd26d0503070ff732', '2026-10-04T01:55:06.289Z', '20260726110000_normalize_grade_constraint_config', NULL, NULL, '2026-10-04T01:55:06.229Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('7e8cad9a-00c4-47a9-b650-c41f0b7d1ccc', '879a2cc0e80fced4f58a153fe25587df938fe43f33e91c4a185d2aa2a9e5b3e2', '2026-10-04T01:55:06.670Z', '20260728000000_rewire_scoring_to_exam_student', NULL, NULL, '2026-10-04T01:55:06.291Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('374392bd-9c38-445f-9a68-2dde89a7013a', '7d89a7790106d464a60235758c68929ef63d27aa62a45796098f9e08011cba66', '2026-10-04T01:55:06.696Z', '20260729000000_rewire_coursework_score_to_coursework_student', NULL, NULL, '2026-10-04T01:55:06.673Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('8255152c-2c52-4cee-8aa5-6d2e73769c66', '933681025bcbbfced87ce32be9c4225be7b023d04d38235fb0e2a4799645db4a', '2026-10-04T01:55:06.756Z', '20260730000000_rewire_grade_cells_to_grade_student', NULL, NULL, '2026-10-04T01:55:06.697Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('49520563-32be-4a16-a0f0-547907977b71', '4671cf8e7b5750a2c02be670da8d5c413e46bc52a29989633956ce590ee231c0', '2026-10-04T01:55:06.792Z', '20260731000000_drop_omr_digit_support', NULL, NULL, '2026-10-04T01:55:06.759Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0c9ad979-6c80-4fd8-89a3-c96f3aa9169b', '0e054f34a4502b738cde298341215903757eeacef745e705408b4672cf919d35', '2026-10-04T01:55:06.802Z', '20260731000100_drop_exam_marking_format', NULL, NULL, '2026-10-04T01:55:06.798Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('7b2aff89-8fbc-463c-a914-9f3fb01bd743', '4f2e80728112671bc99463cc871834929183f5f7f95970558c45be72d32038ff', '2026-10-04T01:55:06.896Z', '20260731000200_normalize_exam_export_settings', NULL, NULL, '2026-10-04T01:55:06.805Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('31518d9e-8008-4293-ab77-9982916b83ed', 'd53e750228d2466dedfc3b1dc56ed9f14738842977da065f67359d6a5141afd8', '2026-10-04T01:55:06.932Z', '20260801000000_fold_grade_boundary_set_into_grade_item_boundary', NULL, NULL, '2026-10-04T01:55:06.898Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('ccbeae5c-e8e8-4df5-a037-90587d5201a9', 'aa41f92a5bc04d18b3c28092f788c607267c67030d9f0b2f027d0153556a921f', '2026-10-04T01:55:06.950Z', '20260801120000_fold_master_image_into_exam_page', NULL, NULL, '2026-10-04T01:55:06.934Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e7d15428-32ec-4ca2-94bd-2a0985b31606', 'f8040764fbece976bc65316d76feb6804e4915be4862a10c3a5524d14d9d050c', '2026-10-04T01:55:06.967Z', '20260802030000_asb_header_field_timestamps', NULL, NULL, '2026-10-04T01:55:06.953Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('40fa6d11-25f8-45de-9a7b-7673fc3a78cb', '88b7f726925482e5935b304dca9e621c64907d13a3441cab4df27d847ee7c9bd', '2026-10-04T01:55:06.998Z', '20260802040000_exam_subtotal_group_deterministic_id', NULL, NULL, '2026-10-04T01:55:06.970Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('8265ae4a-df4a-4c76-99a0-4d78444d5cd5', '6de24705e3dedaafa344fe76d2cd63158a55f4a20876491b851844b18f6b82ed', '2026-10-04T01:55:07.036Z', '20260802120000_drop_drawing_annotation_user_id', NULL, NULL, '2026-10-04T01:55:07.004Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('c911fadd-57fc-40cc-b365-c2889878aab9', 'b88db667423c8d1b9c1deb66395030724a885dd80bfce34fae287abbb4d0ee5d', '2026-10-04T01:55:07.041Z', '20260803110000_unify_ids_to_uuidv4', NULL, NULL, '2026-10-04T01:55:07.040Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('8a5738ab-213f-4590-b28a-e41b867f4bc9', 'cbb7039f791544f2701d5babdd319b0d21b0219a0110ffbe7e6f07fa6f42061b', '2026-10-04T01:55:07.052Z', '20260819120000_drop_asb_definition_render_mode', NULL, NULL, '2026-10-04T01:55:07.043Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('4130a863-7de9-41fc-99de-54c4f81f8982', 'f1e1033ffbdb8daa320ee0bb60d06663972a9f2b9b8632b0df867ca04d4d86aa', '2026-10-04T01:55:07.116Z', '20260819140000_split_user_preference_json_into_rows', NULL, NULL, '2026-10-04T01:55:07.056Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('80253873-3cf0-428b-93d8-ebce8a176ee9', '5e534bc6bfa9b3b9e15c119aeef0fef6ab0dc339f187c6537ac7548b60faedcc', '2026-10-04T01:55:07.143Z', '20260819160000_normalize_grade_export_settings', NULL, NULL, '2026-10-04T01:55:07.118Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('705ee5a3-ac5b-45a1-9ec9-308fb4b6d1f7', '4d91bb1c3279c5183f97b59b8d033cf0acf68f7f53866bd9ac2756e1a72131e1', '2026-10-04T01:55:07.321Z', '20260821000000_move_asb_manuscript_paper_to_table', NULL, NULL, '2026-10-04T01:55:07.147Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('8d4330fb-4ece-4700-b63d-90f2bb2129fc', '482b4117b86fd46b5577720acee820aeef92863b0a2f0d4193bbddf2112037d8', '2026-10-04T01:55:07.484Z', '20260822000000_drop_score_decision_source_and_link_return_snapshot_user', NULL, NULL, '2026-10-04T01:55:07.327Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d100ef45-521d-4ec7-8e16-e1b1cc29579b', 'ccc8a51fd9e5d92db9d0e15271550126437573aa262790dcd92f4fdf2a5a011f', '2026-10-04T01:55:07.496Z', '20260822120000_add_question_score_comment', NULL, NULL, '2026-10-04T01:55:07.494Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('79f8ffff-eaf2-42e3-b32f-0fc6557385f7', 'b8d7c5a7f55bf9f4b152425a353dcab516c545af315b5976de75076b11938117', '2026-10-04T01:55:07.519Z', '20260822140000_drop_human_name_uniques', NULL, NULL, '2026-10-04T01:55:07.501Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('00bdeda2-49cc-49ba-84bb-698011398a79', '3e877310239b71f9c918402260f708cbcea402186f8a36f365dfada417a7004b', '2026-10-04T01:55:07.561Z', '20260823000000_unify_reference_date_and_add_grade_tag', NULL, NULL, '2026-10-04T01:55:07.521Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('233b0052-0fe6-435e-b3f0-da8061af6008', '2d1856d0259db7fc8f8d065867a4bdfe3f61289c84d3d7d7587cb5f508a2f7d1', '2026-10-04T01:55:07.571Z', '20260823050000_add_asb_definition_description', NULL, NULL, '2026-10-04T01:55:07.565Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('a0e30a46-ba6c-423e-8622-deddf7cc6fcd', 'e81e83ba9120a6c2ff5f5c32950edd777bc0ce85452a37aa23900f3caca89662', '2026-10-04T01:55:07.593Z', '20260823120000_subtotal_uniques_by_uuid', NULL, NULL, '2026-10-04T01:55:07.574Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('cf4dd8ee-c836-4517-9d0d-54a67b6abbe3', '33f95cebf62cd8dd571c64554c35a75811ac1d3ea3f28f3f900e1a5e50db4897', '2026-10-04T01:55:07.603Z', '20260823140000_index_question_score_crop_region', NULL, NULL, '2026-10-04T01:55:07.599Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('fd19a76c-18b8-4605-8732-1a7e01a2d0ff', '7cc27f1833d031544543f2309c25884c7a6379a79b914a1d20e16e4c71342866', '2026-10-04T01:55:07.652Z', '20260824120000_add_app_preference', NULL, NULL, '2026-10-04T01:55:07.606Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d2c179c3-cb32-402c-b720-521caa43a632', 'a601ac52ecb8ed2330bc12e5f89ba590f2eaa2799c053bf98e1bc7eb0ca2d2ac', '2026-10-04T01:55:07.682Z', '20260929120000_add_grade_comparison', NULL, NULL, '2026-10-04T01:55:07.674Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('8e4155d4-13d6-4cec-a39d-6eb4598b6558', '053c0847c7525b34631f2b60d85e6283311935a41fdf206fe68fa5f2edd80678', '2026-10-04T01:55:07.684Z', '20261002120000_drop_superseded_and_default_keyboard_shortcuts', NULL, NULL, '2026-10-04T01:55:07.684Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('5862ae64-755e-480c-8797-7f1e45723bb7', '78445050aca2218b2a20b1ea5997d6d8c191bd94d7bb03799b96e18f9e6a78dc', '2026-10-04T01:55:07.691Z', '20261004120000_unique_grade_comparison_pair', NULL, NULL, '2026-10-04T01:55:07.686Z', 1);
COMMIT;
