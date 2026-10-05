-- 匿名採点を試験として固定する列を足す（docs/scoring-scope-and-permissions-design.md §3-5）。
--
-- ON の間、オーナー以外の参加者は「7. 採点」で生徒の名前・答案の氏名欄・名簿順を見られず、
-- 自分で解除もできない（採点者が自分で解除できては、採点者の先入観を減らせない）。
-- 既存の試験はすべて OFF で、意味は変わらない。既存の行には触らない（docs/unified-archive-design.md §8）。
ALTER TABLE "Exam" ADD COLUMN "anonymousScoringEnforced" BOOLEAN NOT NULL DEFAULT false;
