-- 試験外成績資料の点数（CourseworkScore）を Student 直結から
-- CourseworkStudent（資料の対象者）経由へ配線し直す。
--
-- これまで CourseworkScore は studentId で Student を直接参照していた。
-- CourseworkStudent を参照する子テーブルが1つも無かったため「資料から生徒を外す」操作
-- （removeStudentsFromCoursework / 学級ごとの削除）では DB の cascade が働かず、
-- 名簿から消えた生徒の点数がそのまま残り続けていた。
-- 残った点数は資料の画面（すべて CourseworkStudent 起点）には現れないのに、
-- 成績算出（rawScoreCalculator は CourseworkStudent を経由していなかった）でだけ
-- 素点として算入されていた。ExamStudent 系（20260728000000）と同型の穴である。
--
-- バックフィルは CourseworkStudent との INNER JOIN で行うため、孤児は自然に落ちる。
-- 破棄は削除確認ダイアログが以前から約束していた挙動であり、仕様変更ではなく仕様への適合。
-- 破棄件数は AuditLog に記録する（起動時のモーダルは data フォルダの手動コピー運用では
-- 最初にそのコピーを開いた人にしか出ず、周知手段として機能しないため）。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. 新テーブルの作成とバックフィル ───────────────────────────
-- CourseworkItem.courseworkId 経由で CourseworkStudent に到達する
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
    CONSTRAINT "CourseworkScore_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkScore_courseworkStudentId_fkey" FOREIGN KEY ("courseworkStudentId") REFERENCES "CourseworkStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_CourseworkScore" ("id", "courseworkItemId", "courseworkStudentId", "score", "letterValue", "adjustment", "adjustmentReason", "comment", "createdAt", "updatedAt")
SELECT cs."id", cs."courseworkItemId", cst."id", cs."score", cs."letterValue", cs."adjustment", cs."adjustmentReason", cs."comment", cs."createdAt", cs."updatedAt"
FROM "CourseworkScore" cs
JOIN "CourseworkItem" ci ON ci."id" = cs."courseworkItemId"
JOIN "CourseworkStudent" cst ON cst."courseworkId" = ci."courseworkId" AND cst."studentId" = cs."studentId";

-- ── 2. 破棄した孤児の件数を監査ログへ記録（1件以上あるときだけ） ──
INSERT INTO "AuditLog" ("id", "createdAt", "updatedAt", "userId", "action", "category", "scopeId", "scopeLabel", "entityType", "entityId", "summary", "metadata")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    NULL,
    'system.migration.cleanup_orphaned_scores',
    'system',
    NULL,
    NULL,
    'System',
    '20260729000000_rewire_coursework_score_to_coursework_student',
    '試験外成績資料の対象者として登録されていない生徒の点数 ' ||
        ((SELECT COUNT(*) FROM "CourseworkScore") - (SELECT COUNT(*) FROM "new_CourseworkScore")) ||
        ' 件を、データ移行時に破棄しました。該当する資料を参照している成績では算出の結果が変わります。',
    json_object(
        'courseworkScore', (SELECT COUNT(*) FROM "CourseworkScore") - (SELECT COUNT(*) FROM "new_CourseworkScore")
    )
WHERE ((SELECT COUNT(*) FROM "CourseworkScore") - (SELECT COUNT(*) FROM "new_CourseworkScore")) > 0;

-- ── 3. 差し替えとインデックス再作成 ──────────────────────────────
DROP TABLE "CourseworkScore";
ALTER TABLE "new_CourseworkScore" RENAME TO "CourseworkScore";
CREATE UNIQUE INDEX "CourseworkScore_courseworkItemId_courseworkStudentId_key" ON "CourseworkScore"("courseworkItemId", "courseworkStudentId");
CREATE INDEX "CourseworkScore_courseworkItemId_idx" ON "CourseworkScore"("courseworkItemId");
CREATE INDEX "CourseworkScore_courseworkStudentId_idx" ON "CourseworkScore"("courseworkStudentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
