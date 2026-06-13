/*
  Normalize legacy integer (Unix epoch millisecond) DateTime values to ISO 8601 text.

  Background: Prisma v7 への driver adapter (@prisma/adapter-better-sqlite3) 移行で
  DateTime の保存形式が integer(ms) から ISO 8601 text へ変わったが、既存データは
  integer のまま残り混在した。SQLite の型優先順位 (integer < text) により
  integer の値と driver adapter が渡す text の基準日が比較できず、範囲フィルタ
  (例: 成績の学級在籍判定)・orderBy ソート・sqlite-nas-sync の LWW 競合解決が壊れていた。

  本マイグレーションは全 DateTime カラムの integer 行のみを driver adapter と同一形式
  (YYYY-MM-DDTHH:MM:SS.mmm+00:00) の text へ変換し、形式を統一する。
  WHERE typeof(col)='integer' ガードにより冪等 (text/null 行は不変、再実行・途中失敗後の
  再適用も安全)。注: migrationDeployer は SQL をセミコロン区切りで分割して逐次実行し各文を
  トランザクション外で適用するため、PRAGMA / BEGIN / COMMIT は記述しない。
  またコメント内にセミコロンを含めてはならない (分割が壊れるため)。
*/


-- User
UPDATE "User" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "User" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- classes
UPDATE "classes" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "classes" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- Student
UPDATE "Student" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "Student" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- StudentClassMembership
UPDATE "StudentClassMembership" SET "startDate" = strftime('%Y-%m-%dT%H:%M:%f', "startDate"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("startDate") = 'integer';
UPDATE "StudentClassMembership" SET "endDate" = strftime('%Y-%m-%dT%H:%M:%f', "endDate"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("endDate") = 'integer';
UPDATE "StudentClassMembership" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "StudentClassMembership" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- Exam
UPDATE "Exam" SET "examDate" = strftime('%Y-%m-%dT%H:%M:%f', "examDate"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("examDate") = 'integer';
UPDATE "Exam" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "Exam" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamStudent
UPDATE "ExamStudent" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamStudent" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamPage
UPDATE "ExamPage" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamPage" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- MasterImage
UPDATE "MasterImage" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "MasterImage" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- StudentAnswerImage
UPDATE "StudentAnswerImage" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "StudentAnswerImage" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropRegion
UPDATE "CropRegion" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropRegion" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- SubtotalGroup
UPDATE "SubtotalGroup" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "SubtotalGroup" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- Subtotal
UPDATE "Subtotal" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "Subtotal" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropSubtotal
UPDATE "CropSubtotal" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropSubtotal" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- UserExam
UPDATE "UserExam" SET "invitedAt" = strftime('%Y-%m-%dT%H:%M:%f', "invitedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("invitedAt") = 'integer';
UPDATE "UserExam" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "UserExam" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamSubtotalGroup
UPDATE "ExamSubtotalGroup" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamSubtotalGroup" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- QuestionScore
UPDATE "QuestionScore" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "QuestionScore" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ScoreDecision
UPDATE "ScoreDecision" SET "decidedAt" = strftime('%Y-%m-%dT%H:%M:%f', "decidedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("decidedAt") = 'integer';
UPDATE "ScoreDecision" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ScoreDecision" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- DrawingAnnotation
UPDATE "DrawingAnnotation" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "DrawingAnnotation" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- DeletedRecord
UPDATE "DeletedRecord" SET "deletedAt" = strftime('%Y-%m-%dT%H:%M:%f', "deletedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("deletedAt") = 'integer';

-- ExamClass
UPDATE "ExamClass" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamClass" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- Tag
UPDATE "Tag" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "Tag" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- TagSubtotalGroup
UPDATE "TagSubtotalGroup" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "TagSubtotalGroup" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamTag
UPDATE "ExamTag" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamTag" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- UserKeyboardShortcut
UPDATE "UserKeyboardShortcut" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "UserKeyboardShortcut" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- UserPreference
UPDATE "UserPreference" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "UserPreference" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamMarkingFormat
UPDATE "ExamMarkingFormat" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamMarkingFormat" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ExamExportSettings
UPDATE "ExamExportSettings" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ExamExportSettings" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropRegionMarkingOverride
UPDATE "CropRegionMarkingOverride" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropRegionMarkingOverride" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropRegionOmrConfig
UPDATE "CropRegionOmrConfig" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropRegionOmrConfig" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropRegionOmrChoiceOption
UPDATE "CropRegionOmrChoiceOption" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropRegionOmrChoiceOption" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CropRegionOmrDigitBox
UPDATE "CropRegionOmrDigitBox" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CropRegionOmrDigitBox" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CompoundAnswer
UPDATE "CompoundAnswer" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CompoundAnswer" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CompoundAnswerMember
UPDATE "CompoundAnswerMember" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CompoundAnswerMember" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- CompoundAnswerScore
UPDATE "CompoundAnswerScore" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "CompoundAnswerScore" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- Grade
UPDATE "Grade" SET "referenceDate" = strftime('%Y-%m-%dT%H:%M:%f', "referenceDate"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("referenceDate") = 'integer';
UPDATE "Grade" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "Grade" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeItem
UPDATE "GradeItem" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeItem" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeClass
UPDATE "GradeClass" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeClass" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeStudent
UPDATE "GradeStudent" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeStudent" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeDataSource
UPDATE "GradeDataSource" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeDataSource" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- ManualScore
UPDATE "ManualScore" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "ManualScore" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeItemExclusion
UPDATE "GradeItemExclusion" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeItemExclusion" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeBoundarySet
UPDATE "GradeBoundarySet" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeBoundarySet" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeOverride
UPDATE "GradeOverride" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeOverride" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeBoundary
UPDATE "GradeBoundary" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeBoundary" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- GradeExportSettings
UPDATE "GradeExportSettings" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "GradeExportSettings" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbDefinition
UPDATE "AsbDefinition" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbDefinition" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbMajorQuestion
UPDATE "AsbMajorQuestion" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbMajorQuestion" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbSubQuestion
UPDATE "AsbSubQuestion" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbSubQuestion" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbBranchQuestion
UPDATE "AsbBranchQuestion" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbBranchQuestion" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbTextElement
UPDATE "AsbTextElement" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbTextElement" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbImageElement
UPDATE "AsbImageElement" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbImageElement" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbOmrConfig
UPDATE "AsbOmrConfig" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbOmrConfig" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';

-- AsbOmrChoiceOption
UPDATE "AsbOmrChoiceOption" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f', "createdAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("createdAt") = 'integer';
UPDATE "AsbOmrChoiceOption" SET "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', "updatedAt"/1000.0, 'unixepoch') || '+00:00' WHERE typeof("updatedAt") = 'integer';
