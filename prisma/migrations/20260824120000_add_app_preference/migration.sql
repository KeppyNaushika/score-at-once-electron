-- アプリ全体の設定（KV方式）を置く表を作る。
--
-- 利用者ごとの好みは UserPreference が持っているが、**組織の決めごと**を置く先が
-- どこにも無かった。最初の住人は年度の開始日（既定は 4/1）で、一覧の絞り込みが
-- 「今年度」を組み立てるのに読む。人によって違う値を持つと、同じ条件で絞ったのに
-- 見えるものが人ごとに変わる。
--
-- 行が無いときは既定を使う（起動時に既定値を書き込まない）。書き込むと、まだ誰も
-- 設定していないことと、既定を選んだこととが区別できなくなる。
CREATE TABLE "AppPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AppPreference_key_key" ON "AppPreference"("key");
