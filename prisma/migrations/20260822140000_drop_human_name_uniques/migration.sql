-- 人が打つ名前の UNIQUE を外す（User.username / Classroom.name / Student.studentNumber）。
--
-- 共有フォルダ経由のマルチマスタ同期は、別 id・同一ユニークキーの行を LWW で1つへ畳み、
-- 負けた行を消して子を勝者へ付け替える。畳んでよいのは「同じものを2回作った」ときだけで、
-- 「別のものが偶然ぶつかった」ときに畳むとデータの持ち主が入れ替わる。
--
-- この3列は人が自由に打つ名前なので後者が起きる:
--   * 別の校舎の教員がそれぞれ `suzuki`（鈴木一郎／鈴木花子）を作る
--   * 「2025年度の3年1組」と「2026年度の3年1組」（名前に年度を埋めるのは運用の習慣で、
--     UI もスキーマも要求していない）
--   * 付番規則の違う教員が同じ学籍番号を別人に振る
-- 畳まれると、負けた側の採点・在籍・答案が勝った側のものになる。とくに Student は
-- ExamStudent(examId, studentId) を経由して QuestionScore まで再帰的に付け替わる。
--
-- 決め手は、アプリの中で解釈が割れていたこと。取り込みは generateUniqueClassName /
-- generateUniqueStudentNumber で、名前が衝突したら `(2)` や `_1` を足して**別物として作る**
-- ＝「同名＝同一」とは決めていない。同期だけが畳んでいた。外せば揃う。
--
-- 残す UNIQUE には手を触れない。Tag.name は「同じ名前のタグは同じタグ」で畳むのが望みの
-- 動作、表示設定系（ExamAnswerOverlayStyle 等）は語彙が閉じていて必ず「同じもの」。
--
-- 3列とも名前付きの独立した索引なので DROP INDEX で足りる。テーブルの作り直し
-- （RENAME TO を伴う再定義）は要らないので、子テーブルの外部キーが旧名を指したまま残る
-- 問題も起きない。
--
-- Student.studentNumber だけは非ユニーク索引を置き直す。3列のうち、等値検索が
-- 取り込む生徒1人につき1回走り（generateUniqueStudentNumber）、かつ行数が年度ごとに
-- 積み上がるのはここだけ。User（教員の人数）と Classroom（学校の学級数）は索引無しで
-- 全走査させる。

-- IF EXISTS を付けるのは、索引が既に無い形の DB（ブリッジ経由で上がってきたもの）で
-- 起動そのものが止まらないようにするため。名前が想定と違って残ってしまう抜けは、
-- 空DBへ全 migration を通したうえで「この3列を覆うユニーク索引が1つも無い」ことを
-- 見るテスト（__tests__/migration/dropHumanNameUniques.test.ts）で塞ぐ。
DROP INDEX IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "Classroom_name_key";
DROP INDEX IF EXISTS "Student_studentNumber_key";

CREATE INDEX "Student_studentNumber_idx" ON "Student"("studentNumber");
