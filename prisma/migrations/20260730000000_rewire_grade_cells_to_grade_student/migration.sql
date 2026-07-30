-- 成績のセル3種（GradeOverride / GradeFrozenScore / GradeItemExclusion）を
-- Student 直結から GradeStudent（その成績の対象者）経由へ配線し直す。
--
-- これまで3テーブルは (gradeId, studentId) の2列で「その成績のその生徒」を表しており、
-- GradeStudent という実体があるのにそれを参照していなかった。GradeStudent を参照する
-- 子テーブルが1つも無かったため「成績から生徒を外す」操作（学級ごとの削除）では
-- DB の cascade が働かず、名簿から消えた生徒の上書き・確定値・除外設定が残り続けていた。
-- 残った行は成績算出のループが GradeStudent 軸なので普段は無害だが、同じ生徒を再び
-- 追加した瞬間に過去の設定が甦る。特に GradeFrozenScore は「確定した成績値」であり、
-- 教員が知らないうちに古い確定値が復活するのは実害が大きい（#962）。
--
-- gradeId / studentId の2列は残さず GradeStudent へ畳む。両方を残すと
-- gradeId ≠ gradeStudent.gradeId が起こりうるため（ExamStudent 系の
-- ReturnSnapshot.examId と同じ判断。20260728000000 を参照）。
--
-- バックフィルは GradeStudent との INNER JOIN で行うため、孤児は自然に落ちる。
-- 破棄は削除確認の説明が以前から約束していた挙動であり、仕様変更ではなく仕様への適合。
-- 破棄件数は AuditLog に記録する（起動時のモーダルは data フォルダの手動コピー運用では
-- 最初にそのコピーを開いた人にしか出ず、周知手段として機能しないため）。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. GradeOverride ────────────────────────────────────────────
CREATE TABLE "new_GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeOverride_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_GradeOverride" ("id", "gradeStudentId", "gradeItemId", "overrideLabel", "createdAt", "updatedAt")
SELECT go."id", gs."id", go."gradeItemId", go."overrideLabel", go."createdAt", go."updatedAt"
FROM "GradeOverride" go
JOIN "GradeStudent" gs ON gs."gradeId" = go."gradeId" AND gs."studentId" = go."studentId";

-- ── 2. GradeFrozenScore ─────────────────────────────────────────
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
    CONSTRAINT "GradeFrozenScore_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeFrozenScore_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeFrozenScore_frozenByUserId_fkey" FOREIGN KEY ("frozenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_GradeFrozenScore" ("id", "gradeStudentId", "gradeItemId", "weightedScore", "weightedMaxScore", "percentage", "gradeLabel", "frozenByUserId", "frozenAt", "createdAt", "updatedAt")
SELECT gfs."id", gs."id", gfs."gradeItemId", gfs."weightedScore", gfs."weightedMaxScore", gfs."percentage", gfs."gradeLabel", gfs."frozenByUserId", gfs."frozenAt", gfs."createdAt", gfs."updatedAt"
FROM "GradeFrozenScore" gfs
JOIN "GradeStudent" gs ON gs."gradeId" = gfs."gradeId" AND gs."studentId" = gfs."studentId";

-- ── 3. GradeItemExclusion ───────────────────────────────────────
CREATE TABLE "new_GradeItemExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeStudentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeItemExclusion_gradeStudentId_fkey" FOREIGN KEY ("gradeStudentId") REFERENCES "GradeStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeItemExclusion_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_GradeItemExclusion" ("id", "gradeStudentId", "gradeItemId", "createdAt", "updatedAt")
SELECT gie."id", gs."id", gie."gradeItemId", gie."createdAt", gie."updatedAt"
FROM "GradeItemExclusion" gie
JOIN "GradeStudent" gs ON gs."gradeId" = gie."gradeId" AND gs."studentId" = gie."studentId";

-- ── 4. 破棄した孤児の件数を監査ログへ記録（1件以上あるときだけ） ──
INSERT INTO "AuditLog" ("id", "createdAt", "updatedAt", "userId", "action", "category", "scopeId", "scopeLabel", "entityType", "entityId", "summary", "metadata")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    NULL,
    'system.migration.cleanup_orphaned_grade_cells',
    'system',
    NULL,
    NULL,
    'System',
    '20260730000000_rewire_grade_cells_to_grade_student',
    '成績の対象者として登録されていない生徒の上書き・確定値・除外設定 ' ||
        (((SELECT COUNT(*) FROM "GradeOverride") - (SELECT COUNT(*) FROM "new_GradeOverride"))
         + ((SELECT COUNT(*) FROM "GradeFrozenScore") - (SELECT COUNT(*) FROM "new_GradeFrozenScore"))
         + ((SELECT COUNT(*) FROM "GradeItemExclusion") - (SELECT COUNT(*) FROM "new_GradeItemExclusion"))) ||
        ' 件を、データ移行時に破棄しました。該当する生徒を成績へ再び追加しても、以前の設定は復元されません。',
    json_object(
        'gradeOverride', (SELECT COUNT(*) FROM "GradeOverride") - (SELECT COUNT(*) FROM "new_GradeOverride"),
        'gradeFrozenScore', (SELECT COUNT(*) FROM "GradeFrozenScore") - (SELECT COUNT(*) FROM "new_GradeFrozenScore"),
        'gradeItemExclusion', (SELECT COUNT(*) FROM "GradeItemExclusion") - (SELECT COUNT(*) FROM "new_GradeItemExclusion")
    )
WHERE (((SELECT COUNT(*) FROM "GradeOverride") - (SELECT COUNT(*) FROM "new_GradeOverride"))
       + ((SELECT COUNT(*) FROM "GradeFrozenScore") - (SELECT COUNT(*) FROM "new_GradeFrozenScore"))
       + ((SELECT COUNT(*) FROM "GradeItemExclusion") - (SELECT COUNT(*) FROM "new_GradeItemExclusion"))) > 0;

-- ── 5. 差し替えとインデックス再作成 ──────────────────────────────
DROP TABLE "GradeOverride";
ALTER TABLE "new_GradeOverride" RENAME TO "GradeOverride";
CREATE UNIQUE INDEX "GradeOverride_gradeStudentId_gradeItemId_key" ON "GradeOverride"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeOverride_gradeStudentId_idx" ON "GradeOverride"("gradeStudentId");
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");

DROP TABLE "GradeFrozenScore";
ALTER TABLE "new_GradeFrozenScore" RENAME TO "GradeFrozenScore";
CREATE UNIQUE INDEX "GradeFrozenScore_gradeStudentId_gradeItemId_key" ON "GradeFrozenScore"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeFrozenScore_gradeStudentId_idx" ON "GradeFrozenScore"("gradeStudentId");
CREATE INDEX "GradeFrozenScore_gradeItemId_idx" ON "GradeFrozenScore"("gradeItemId");

DROP TABLE "GradeItemExclusion";
ALTER TABLE "new_GradeItemExclusion" RENAME TO "GradeItemExclusion";
CREATE UNIQUE INDEX "GradeItemExclusion_gradeStudentId_gradeItemId_key" ON "GradeItemExclusion"("gradeStudentId", "gradeItemId");
CREATE INDEX "GradeItemExclusion_gradeStudentId_idx" ON "GradeItemExclusion"("gradeStudentId");
CREATE INDEX "GradeItemExclusion_gradeItemId_idx" ON "GradeItemExclusion"("gradeItemId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
