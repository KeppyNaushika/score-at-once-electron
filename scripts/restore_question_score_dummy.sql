-- QuestionScoreにダミーデータを作成（新しい構造で一時的に復元）

-- 現在の構造（cropRegionId + studentId）用のサンプルデータを作成
-- CropRegionとStudentの組み合わせに基づいてダミーデータを生成

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
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    cr.id as cropRegionId,
    s.id as studentId,
    NULL as score,           -- 未採点
    NULL as isCorrect,       -- 未採点
    NULL as partialScore,    -- 未採点
    'unscored' as status,    -- 未採点状態
    NULL as scoredByUserId,  -- 未採点
    datetime('now') as createdAt,
    datetime('now') as updatedAt
FROM CropRegion cr
CROSS JOIN Student s
WHERE EXISTS (
    SELECT 1 FROM ProjectStudent ps 
    WHERE ps.studentId = s.id 
    AND ps.projectId = cr.projectId
    AND ps.status = 'PARTICIPATING'
)
LIMIT 100;  -- 最初の100件だけ作成