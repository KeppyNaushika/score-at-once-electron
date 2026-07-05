-- Classroom.classCode 列を classroomCode へリネーム（学級実体名の統一・略語 class の解消）。
-- モデル/コード/アーカイブ境界は既に classroomCode。旧アーカイブの JSON キー classCode は
-- legacyClassroomKeys の正規化（classCode → classroomCode）で読取り時に吸収するため、
-- アーカイブ版数の更新は不要。
--
-- classCode はデータ列であり FK でも FK 参照先でもないため、列リネームで dangling は生じない。
-- migrationDeployer は非トランザクション・FK 既定 OFF で適用するが、列リネームには影響しない。
ALTER TABLE "Classroom" RENAME COLUMN "classCode" TO "classroomCode";
