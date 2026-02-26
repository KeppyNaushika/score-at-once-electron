-- 重複レコードのクリーンアップ（最新のみ残す）
DELETE FROM StudentAnswerImage
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY projectPageId, studentId
      ORDER BY updatedAt DESC
    ) as rn
    FROM StudentAnswerImage
  ) ranked
  WHERE rn = 1
);

-- UNIQUE制約の追加
CREATE UNIQUE INDEX "StudentAnswerImage_projectPageId_studentId_key"
ON "StudentAnswerImage"("projectPageId", "studentId");
