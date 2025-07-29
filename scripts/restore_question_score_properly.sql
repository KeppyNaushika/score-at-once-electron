-- バックアップから正しいQuestionScoreデータを復元

-- 1. 現在のダミーデータを削除
DELETE FROM QuestionScore;

-- 2. バックアップからの復元用一時テーブルを作成
CREATE TEMPORARY TABLE backup_data AS
SELECT 
    qs.id,
    qs.layoutRegionId as old_cropRegionId,
    qs.answerSheetId,
    ans.studentId,
    ans.projectId,
    ans.pageNumber,
    qs.partialScore,
    qs.comment,
    qs.scoredByUserId,
    qs.status,
    qs.createdAt,
    qs.updatedAt
FROM 
    (SELECT * FROM QuestionScore) AS backup_qs
    INNER JOIN QuestionScore qs ON 1=0  -- これはダミー、実際は外部からデータを取得