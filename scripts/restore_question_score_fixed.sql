-- バックアップデータベースから正しいQuestionScoreデータを復元（修正版）

-- 1. 現在のダミーデータを削除
DELETE FROM QuestionScore;

-- 2. バックアップデータベースをアタッチ
ATTACH DATABASE 'data/database_backup_before_sql_changes_20250729_202430.db' AS backup;

-- 3. バックアップからデータを復元
INSERT INTO QuestionScore (
    "id",
    "cropRegionId",
    "studentId",
    "score",
    "isCorrect",
    "partialScore", 
    "status",
    "scoredByUserId",
    "createdAt",
    "updatedAt"
)
SELECT 
    backup_qs.id,
    cr.id as cropRegionId,  -- 現在のCropRegionのID
    backup_ans.studentId,
    CASE 
        WHEN backup_qs.partialScore IS NOT NULL THEN backup_qs.partialScore
        ELSE NULL 
    END as score,
    CASE 
        WHEN backup_qs.status = 'correct' THEN 1
        WHEN backup_qs.status = 'incorrect' THEN 0
        ELSE NULL
    END as isCorrect,
    backup_qs.partialScore,
    CASE 
        WHEN backup_qs.status = 'proposed' THEN 'unscored'
        ELSE backup_qs.status
    END as status,
    backup_qs.scoredByUserId,
    backup_qs.createdAt,
    backup_qs.updatedAt
FROM backup.QuestionScore backup_qs
JOIN backup.AnswerSheet backup_ans ON backup_qs.answerSheetId = backup_ans.id
JOIN ProjectPage pp ON backup_ans.projectId = pp.projectId AND backup_ans.pageNumber = pp.pageNumber
JOIN CropRegion cr ON cr.projectPageId = pp.id 
WHERE cr.id = backup_qs.layoutRegionId;  -- 古いlayoutRegionIdと現在のCropRegionのIDが一致

-- 4. バックアップデータベースをデタッチ
DETACH DATABASE backup;