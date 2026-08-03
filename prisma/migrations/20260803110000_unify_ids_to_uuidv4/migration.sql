-- 導出idを uuidv4 へ振り直す。
--
-- 対象は「id の値が行の内容から決まる」表。3系統ある。
--   (a) 合成id `親id:子キー`            … ExamSubtotalGroup / GradeConstraint* / GradeDataSourceEstimationSource
--   (b) 親の id をそのまま主キーにした行 … ExamIndividualReportSettings / …GraphSettings
--   (c) uuidv5（内容のsha1から導出）     … CropRegionAssignment
--
-- なぜ振り直すか: id が同一性を持つと、削除した id が再作成で復活するなど、行の生死と
-- 組み合わせの同一性が混線する。同定は `@@unique` が担い、競合の収束は sqlite-nas-sync
-- の LWW（conflict.ts の applyInsert がセカンダリUNIQUE違反を解決する）に委ねる。
-- (c) は形が uuid なので残しても実行時は無害だが、乱数由来と区別できず「この id は
-- 導出されている」と後から誰も気づけないため、合成idより始末が悪い。まとめて排除する。
--
-- **updatedAt を必ず同時に更新すること。** 各端末がこの移行を独立に走らせるため、
-- 同じ行に別々の uuid が振られる。両者が出会うと `@@unique` 違反になり、ライブラリが
-- updatedAt の LWW で新しい方へ収束させる（負けた行は削除され、その削除も伝搬する）。
-- updatedAt を据え置くと同時刻タイになり、isLaterTimestamp が厳密な `>` のため双方が
-- local_wins となって**恒久的に分岐する**。ミリ秒まで書いても同時刻の可能性は残るが、
-- そこは受容する（issue #1128）。
--
-- 既に v4 へ振り直された行は対象外にすること（再実行で収束済みの行を壊さないため）。
-- uuid のバージョンは15文字目に出る（v4 なら '4'、v5 なら '5'）。
--
-- id を参照する子テーブルは無い（全8表とも被参照ゼロ）ので、FK の付け替えは不要。

-- (a) 合成id: `親id:子キー`
UPDATE "ExamSubtotalGroup"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" LIKE '%:%';

UPDATE "GradeConstraintViewpoint"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" LIKE '%:%';

UPDATE "GradeConstraintLabelValue"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" LIKE '%:%';

UPDATE "GradeConstraintExclusionLabel"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" LIKE '%:%';

UPDATE "GradeDataSourceEstimationSource"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" LIKE '%:%';

-- (b) 親の id をそのまま主キーにしていた行（1対1。examId は別列に持っている）
UPDATE "ExamIndividualReportSettings"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" = "examId";

UPDATE "ExamIndividualReportGraphSettings"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE "id" = "examId";

-- (c) uuidv5（バージョンニブルは15文字目）
UPDATE "CropRegionAssignment"
SET "id" = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
WHERE length("id") = 36 AND substr("id", 15, 1) = '5';
