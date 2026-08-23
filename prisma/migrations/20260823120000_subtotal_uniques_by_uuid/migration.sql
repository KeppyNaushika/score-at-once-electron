-- 小計まわりの UNIQUE を「uuid どうしの組だけ」に揃える。
--
-- 共有フォルダ経由のマルチマスタ同期は、別 id・同一ユニークキーの行を LWW で1つへ畳む。
-- 畳んでよいのは「同じものを2回作った」ときだけで、「別のものが偶然ぶつかった」ときに
-- 畳むとデータの持ち主が入れ替わる。人が打つ名前を含む鍵は後者になり、uuid だけで
-- 組まれた鍵は必ず前者になる。
--
-- 外す2件:
--
--   * Subtotal(subtotalGroupId, name) — 名前は人が自由に打ち、改名もできる。別々の小計が
--     同じ名前になると畳まれ、負けた小計の子（04 で設定した設問の割り当て CropSubtotal と、
--     その小計を参照する成績のデータソース GradeDataSource）が勝者へ移る＝2つの小計が
--     1つに潰れる。ついでに「2つの項目が名前を互いに入れ替える保存」も通るようになる
--     （途中で必ず重複するため、差分書き込みでは表現できなかった）。
--
--   * CourseworkLetterScale(courseworkItemId, label) — 評語は1行ずつ人が打ち、「行を追加」は
--     ["A"…"F"] の未使用の先頭を取るので、刻みの無い評価項目で2人が同時に押すと2人とも
--     "A" を作る。A=100 と A=90 という別の刻みなのに同値になる。畳まれると負けた刻みの
--     ラベルを持つ点数（CourseworkScore.letterValue は FK でない素の文字列なので付け替わらない）
--     が換算先を失って欠測になり、画面上は何も起きていないように見える。
--
-- 張る1件:
--
--   * CropSubtotal(cropRegionId, subtotalId, assignmentType) — uuid 2つと閉じた語彙の区分
--     （QUESTION_ASSIGNMENT / SUBTOTAL_DEFINITION。利用者は増やせず、書き換える経路も無い）。
--     同値になるのは「同じマスに2人がチェックを入れた」ときだけなので、畳むのが正しい。
--     CropSubtotal は子を持たないので、敗者の子が消える／勝った側の端末が外部キー違反で
--     詰まる（docs/sync-secondary-unique-hazard.md §3）にも当たらない。
--     張るまでは読む側が毎回重複を畳んでいた（畳み忘れると配点が二重に計上される）。
--
-- 索引は置き直さない。Subtotal は1グループ数項目・全体でも数十行、CourseworkLetterScale は
-- courseworkItemId の索引が別に在る。読みの無いところに書きの費用を足すことになる。

-- Subtotal は UNIQUE(subtotalGroupId, name) を **CREATE TABLE の中に** 持つ DB がある
-- （データがそれで、索引名は sqlite_autoindex_Subtotal_2）。表制約に付いた暗黙の索引は
-- DROP INDEX できないので、表を作り直す。新規インストールの側は同じ制約を名前付き索引
-- （Subtotal_subtotalGroupId_name_key）で持つが、DROP TABLE で一緒に消えるのでどちらの形も
-- ここで揃う。
--
-- foreign_keys=OFF で囲むのは2つの理由から。(1) DROP TABLE "Subtotal" が子の
-- ON DELETE CASCADE を発火させて CropSubtotal / GradeDataSource を消してしまうのを止める。
-- (2) ALTER TABLE ... RENAME TO は foreign_keys=ON のとき他の表の REFERENCES 句も書き換える。
-- ここで欲しいのは「子は "Subtotal" を指したまま」なので、書き換えられては困る
-- （テーブル改名の migration とは逆向きの要求である点に注意）。
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Subtotal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subtotal_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

INSERT INTO "new_Subtotal" ("id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt")
SELECT "id", "name", "subtotalGroupId", "order", "createdAt", "updatedAt"
FROM "Subtotal";

DROP TABLE "Subtotal";
ALTER TABLE "new_Subtotal" RENAME TO "Subtotal";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CourseworkLetterScale は名前付きの独立した索引なので DROP INDEX で足りる。
-- IF EXISTS は、索引が既に無い形の DB で起動そのものが止まらないようにするため。
DROP INDEX IF EXISTS "CourseworkLetterScale_courseworkItemId_label_key";

-- 索引を張る前に、同じマスの重複を1行へ畳む。**残すのは id がいちばん小さい行**で、
-- どの端末で走らせても同じ答えになる（id は uuid。格納順で決めると端末ごとに違う行が
-- 残り、その差がそのまま同期へ流れる）。データに重複は無いが、
-- 制約が無い間に同期を通した DB には在りうる。
DELETE FROM "CropSubtotal"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "CropSubtotal"
  GROUP BY "cropRegionId", "subtotalId", "assignmentType"
);

CREATE UNIQUE INDEX "CropSubtotal_cropRegionId_subtotalId_assignmentType_key" ON "CropSubtotal"("cropRegionId", "subtotalId", "assignmentType");
