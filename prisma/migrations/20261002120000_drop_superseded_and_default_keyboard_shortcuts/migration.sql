-- ショートカットキーの割り当てから、既定と同じ値の行を消す。
--
-- 設定の保存は、かつて画面が持っている割り当て全部（既定の読み替えを通した全コマンド）を
-- まとめて書いていた。キーを1つでも直した利用者の行には、触っていないコマンドの既定まで
-- 焼き込まれており、あとから既定を変えても届かない。届かないまま同じ場面で別のコマンドと
-- 重なった2つ（Wマークの旧既定 t が文字ツールと、ズームを戻すの旧既定 0 が部分点の 0 と）は、
-- 読み込むたびに新しい既定へ読み替えていた（`resolveKeyBindings` の SUPERSEDED_BINDINGS）。
-- 保存は直した1件だけを書く形になったので、焼き込まれた行をここで1回だけ片付け、
-- 読み替えを撤去する。
--
-- 1. 読み替えていた2つ（と対になるフィルタ）を、読み替えと同じ条件で消す。
--    行を消せば既定（u / Alt+u / z）が効く。移す先の既定キーをすでに別のコマンドが
--    使っているときは消さない（消すと別の重なりを作る）。部分点の入力欄の中だけで
--    効くコマンド（modal.*）とは同じキーでよいので、重なりの相手から外す。
-- 2. 既定と同じ値の行をすべて消す。値は変わらない（行が無ければ既定が効く）ので
--    挙動は変わらず、今後の既定の変更が届くようになる。
--
-- 同期（sqlite-nas-sync）: この DELETE は同期のトリガーを通って削除の版になり、
-- 他の端末へ削除として届く。スキーマの版（最新のマイグレーション名）が変わるので、
-- まだ移行していない端末の写しは読まれない。各端末が自分でもこのマイグレーションを
-- 流すので、同じ行を両方で消して収束する。

-- 1a. Wマークと対のフィルタ。Wマークのキーが文字ツールの実効キーと同じなら移す。
--     フィルタは Wマークが移るときだけ、旧既定のまま（Alt+ + Wマークのキー）なら一緒に移す。
--     Wマークの行を消す前に判定するので、先にフィルタを消す。
DELETE FROM "UserKeyboardShortcut"
WHERE "action" = 'filter.toggleDoubleMark'
  AND EXISTS (
    SELECT 1 FROM "UserKeyboardShortcut" AS "doubleMark"
    WHERE "doubleMark"."userId" = "UserKeyboardShortcut"."userId"
      AND "doubleMark"."action" = 'scoring.doubleMark'
      AND "doubleMark"."key" = COALESCE(
        (SELECT "text"."key" FROM "UserKeyboardShortcut" AS "text"
          WHERE "text"."userId" = "doubleMark"."userId" AND "text"."action" = 'tool.text'),
        't')
      AND NOT EXISTS (
        SELECT 1 FROM "UserKeyboardShortcut" AS "other"
        WHERE "other"."userId" = "doubleMark"."userId"
          AND "other"."key" = 'u'
          AND "other"."action" <> 'scoring.doubleMark'
          AND "other"."action" NOT LIKE 'modal.%')
      AND "UserKeyboardShortcut"."key" = 'Alt+' || "doubleMark"."key")
  AND NOT EXISTS (
    SELECT 1 FROM "UserKeyboardShortcut" AS "other"
    WHERE "other"."userId" = "UserKeyboardShortcut"."userId"
      AND "other"."key" = 'Alt+u'
      AND "other"."action" <> 'filter.toggleDoubleMark'
      AND "other"."action" NOT LIKE 'modal.%');

DELETE FROM "UserKeyboardShortcut"
WHERE "action" = 'scoring.doubleMark'
  AND "key" = COALESCE(
    (SELECT "text"."key" FROM "UserKeyboardShortcut" AS "text"
      WHERE "text"."userId" = "UserKeyboardShortcut"."userId" AND "text"."action" = 'tool.text'),
    't')
  AND NOT EXISTS (
    SELECT 1 FROM "UserKeyboardShortcut" AS "other"
    WHERE "other"."userId" = "UserKeyboardShortcut"."userId"
      AND "other"."key" = 'u'
      AND "other"."action" <> 'scoring.doubleMark'
      AND "other"."action" NOT LIKE 'modal.%');

-- 1b. ズームを戻す。部分点の 0（scoring.openPartialWith0）の実効キーと同じなら移す。
DELETE FROM "UserKeyboardShortcut"
WHERE "action" = 'navigation.resetZoom'
  AND "key" = COALESCE(
    (SELECT "partial"."key" FROM "UserKeyboardShortcut" AS "partial"
      WHERE "partial"."userId" = "UserKeyboardShortcut"."userId"
        AND "partial"."action" = 'scoring.openPartialWith0'),
    '0')
  AND NOT EXISTS (
    SELECT 1 FROM "UserKeyboardShortcut" AS "other"
    WHERE "other"."userId" = "UserKeyboardShortcut"."userId"
      AND "other"."key" = 'z'
      AND "other"."action" <> 'navigation.resetZoom'
      AND "other"."action" NOT LIKE 'modal.%');

-- 2. 既定と同じ値の行。値は 2026-10-02 時点の既定（DEFAULT_KEYBINDINGS）。
WITH "defaultBinding" ("action", "key") AS (
  VALUES
    ('scoring.unscored', 'q'),
    ('scoring.correct', 'e'),
    ('scoring.partial', 'f'),
    ('scoring.pending', 'j'),
    ('scoring.incorrect', 'o'),
    ('scoring.noAnswer', 'p'),
    ('scoring.doubleMark', 'u'),
    ('scoring.comment', 'k'),
    ('navigation.nextQuestionArrow', 'ArrowRight'),
    ('navigation.prevQuestionArrow', 'ArrowLeft'),
    ('navigation.nextStudentArrow', 'ArrowDown'),
    ('navigation.prevStudentArrow', 'ArrowUp'),
    ('navigation.nextQuestion', 'Shift+d'),
    ('navigation.prevQuestion', 'Shift+a'),
    ('navigation.moveUp', 'w'),
    ('navigation.moveLeft', 'a'),
    ('navigation.moveDown', 's'),
    ('navigation.moveRight', 'd'),
    ('navigation.zoomIn', '='),
    ('navigation.zoomOut', '-'),
    ('navigation.resetZoom', 'z'),
    ('filter.toggleUnscored', 'Alt+q'),
    ('filter.toggleCorrect', 'Alt+e'),
    ('filter.togglePartial', 'Alt+f'),
    ('filter.togglePending', 'Alt+j'),
    ('filter.toggleIncorrect', 'Alt+o'),
    ('filter.toggleNoAnswer', 'Alt+p'),
    ('filter.toggleDoubleMark', 'Alt+u'),
    ('filter.refresh', 'r'),
    ('selection.selectAll', 'Ctrl+a'),
    ('view.toggleStudentNames', 'n'),
    ('view.toggleViewMode', 'v'),
    ('view.fullView', 'm'),
    ('view.questionView', 'c'),
    ('view.toggleMasterAnswer', 'x'),
    ('modal.cancel', 'Escape'),
    ('modal.backspace', 'Backspace'),
    ('modal.input0', '0'),
    ('modal.input1', '1'),
    ('modal.input2', '2'),
    ('modal.input3', '3'),
    ('modal.input4', '4'),
    ('modal.input5', '5'),
    ('modal.input6', '6'),
    ('modal.input7', '7'),
    ('modal.input8', '8'),
    ('modal.input9', '9'),
    ('modal.inputDot', '.'),
    ('scoring.openPartialWith0', '0'),
    ('scoring.openPartialWith1', '1'),
    ('scoring.openPartialWith2', '2'),
    ('scoring.openPartialWith3', '3'),
    ('scoring.openPartialWith4', '4'),
    ('scoring.openPartialWith5', '5'),
    ('scoring.openPartialWith6', '6'),
    ('scoring.openPartialWith7', '7'),
    ('scoring.openPartialWith8', '8'),
    ('scoring.openPartialWith9', '9'),
    ('scoring.openPartialWithDot', '.'),
    ('tool.hand', 'h'),
    ('tool.select', 'g'),
    ('tool.text', 't'),
    ('tool.line', 'l'),
    ('tool.rectangle', 'b'),
    ('tool.ellipse', 'y')
)
DELETE FROM "UserKeyboardShortcut"
WHERE EXISTS (
  SELECT 1 FROM "defaultBinding"
  WHERE "defaultBinding"."action" = "UserKeyboardShortcut"."action"
    AND "defaultBinding"."key" = "UserKeyboardShortcut"."key");
