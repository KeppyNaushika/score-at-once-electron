-- AI 採点のプロンプトに「朱書きの指示」の欄を足す（docs/vlm-grading-design.md §3-1）。
--
-- 朱書き（生徒向けの注釈）の量・書き方・どんな答案に入れるかを、教員がプロンプトの一部として
-- 指示できるようにする。プロンプトは版で残すので、指示も版ごとに残る。
-- 既存の行は空文字（指示なし＝アプリ共通の決まりだけ）になり、意味は変わらない。
ALTER TABLE "AiPrompt" ADD COLUMN "annotationInstruction" TEXT NOT NULL DEFAULT '';
