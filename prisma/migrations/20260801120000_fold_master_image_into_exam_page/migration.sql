-- 模範解答画像（MasterImage）を ExamPage へ畳む。
--
-- ExamPage 1件に対し MasterImage は必ず1枚だった。2枚以上にする経路も、複数枚を使う
-- 読み取りも存在しない。1:N のままだったため、読む側は全箇所が `masterImages[0]` を書き、
-- インポートは unique 制約の代わりに手書きの重複チェックを持ち、削除は「残り0枚なら」を
-- 数えていた。ExamPage が imagePath / pageSize を直接持つ形へ改める。
--
-- 模範解答の無いページ（imagePath IS NULL）について:
--   旧実装では、答案画像が残っているページから模範解答だけを削除できた。そのページは
--   01-upload の一覧（模範解答の列挙）に現れないため教員からは見えず、直すこともできない
--   幽霊だった。ここでそのページを消すと答案画像と採点結果まで道連れになるので、消さずに
--   引き継ぐ。一覧がページ単位になることで幽霊ページが可視化され、差し替えるか削除するかを
--   教員が選べるようになる。アプリ側の新しい削除はページごと消すため、この状態が新たに
--   生まれることはない。
--
--   NULL であって空文字ではない。空文字だと Prisma の型が string を主張し続けるので、
--   画像を読む側が欠落の分岐を書き忘れてもコンパイルが通ってしまう（実際それで
--   答案アップロードと OMR 検出が丸ごと落ちる不具合を作った）。NULL なら型が分岐を強制する。

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ExamPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imagePath" TEXT,
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- 1ページに複数枚あった場合（FK 上は作れたが実際には存在しない）は古い方を採る。
-- createdAt が同値でも id で決まるので、端末ごとに結果がぶれない。
INSERT INTO "new_ExamPage" ("id", "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt")
SELECT
    "ExamPage"."id",
    "ExamPage"."examId",
    "ExamPage"."pageNumber",
    (SELECT "MasterImage"."imagePath" FROM "MasterImage"
     WHERE "MasterImage"."examPageId" = "ExamPage"."id"
     ORDER BY "MasterImage"."createdAt" ASC, "MasterImage"."id" ASC LIMIT 1),
    COALESCE(
        (SELECT "MasterImage"."pageSize" FROM "MasterImage"
         WHERE "MasterImage"."examPageId" = "ExamPage"."id"
         ORDER BY "MasterImage"."createdAt" ASC, "MasterImage"."id" ASC LIMIT 1),
        'A4'
    ),
    "ExamPage"."createdAt",
    "ExamPage"."updatedAt"
FROM "ExamPage";

-- ExamPage を落とす前に消す。MasterImage だけが ExamPage を参照しているので、
-- 先に落としておけば付け替え先の無い FK が一瞬たりとも残らない。
DROP TABLE "MasterImage";

DROP TABLE "ExamPage";
ALTER TABLE "new_ExamPage" RENAME TO "ExamPage";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
