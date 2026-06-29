"use client"

import {
  Callout,
  Figure,
  FocusSection,
  HelpDoc,
  HelpHero,
  Kbd,
  Pill,
} from "@/components/help/common/DocComponents"

// ============================================================================
// このページ専用の図解アニメーション（CSS keyframes）
// HelpContent07Scoring の方式にならい、<style> で keyframes を描画し、
// 各図は小さな div を inline style={{ animation }} で動かす。
// ============================================================================

const HELP03_KEYFRAMES = `
/* 解答用紙プレビュー側の領域ハイライト（オレンジ） */
@keyframes help03RegionOn {
  0%, 27% { background-color: rgba(249,115,22,0.18); border-color: #f97316; }
  33%, 100% { background-color: rgba(255,255,255,0); border-color: #d1d5db; }
}
/* 表の行ハイライト（プレビューの領域と同期） */
@keyframes help03RowOn {
  0%, 27% { background-color: #fff7ed; border-color: #fdba74; }
  33%, 100% { background-color: #ffffff; border-color: #e5e7eb; }
}
/* Tab / Enter のフォーカス枠がセル間を移動する */
@keyframes help03Focus {
  0%, 11% { transform: translate(0px, 0px); }
  16%, 27% { transform: translate(66px, 0px); }
  33%, 44% { transform: translate(132px, 0px); }
  50%, 61% { transform: translate(0px, 40px); }
  66%, 77% { transform: translate(66px, 40px); }
  83%, 94% { transform: translate(132px, 40px); }
  100% { transform: translate(0px, 0px); }
}
/* OMR の読み取り線が選択肢の上を左から右へ走る */
@keyframes help03Scan {
  0% { transform: translateX(-6px); opacity: 0; }
  12% { opacity: 1; }
  78% { opacity: 1; }
  100% { transform: translateX(150px); opacity: 0; }
}
/* 読み取り後にチェックが現れる */
@keyframes help03Check {
  0%, 72% { opacity: 0; transform: scale(0.4); }
  86%, 100% { opacity: 1; transform: scale(1); }
}
`

/** 表の行を選ぶと、左の解答用紙プレビューで対応する領域が光る様子 */
function RowRegionSyncFigure() {
  // プレビュー上の領域の位置（用紙の中での相対位置）
  const regions = [
    { top: "12%", left: "12%", width: "55%", height: "16%" },
    { top: "40%", left: "12%", width: "70%", height: "16%" },
    { top: "68%", left: "12%", width: "40%", height: "16%" },
  ]
  const rows = [
    { num: "1", label: "問1", points: "10" },
    { num: "2", label: "問2", points: "5" },
    { num: "3", label: "問3", points: "8" },
  ]
  return (
    <div aria-hidden className="flex items-stretch justify-center gap-6">
      {/* 左：解答用紙プレビュー */}
      <div className="relative h-40 w-28 shrink-0 rounded-md border border-gray-300 bg-white shadow-sm">
        {regions.map((r, i) => (
          <div
            key={i}
            className="absolute rounded-sm border-2"
            style={{
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
              borderColor: "#d1d5db",
              animation: `help03RegionOn 9s ${i * 3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* 右：領域の表 */}
      <div className="flex w-44 flex-col gap-1.5 self-center">
        <div className="flex gap-1 px-1 text-[10px] font-semibold text-gray-400">
          <span className="w-4">＃</span>
          <span className="flex-1">ラベル</span>
          <span className="w-8 text-right">配点</span>
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-1 rounded-md border bg-white px-2 py-1.5 text-xs text-gray-700"
            style={{
              borderColor: "#e5e7eb",
              animation: `help03RowOn 9s ${i * 3}s infinite`,
            }}
          >
            <span className="w-4 text-gray-400">{row.num}</span>
            <span className="flex-1 font-medium">{row.label}</span>
            <span className="w-8 text-right text-gray-500">{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tab / Enter でセル間のフォーカスが移動する様子 */
function CellFocusFigure() {
  const columns = ["種類", "ラベル", "配点"]
  const cells = [
    ["設問解答", "問1", "10"],
    ["設問解答", "問2", "5"],
  ]
  return (
    <div aria-hidden className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold text-gray-400">
        {columns.map((c) => (
          <span key={c} className="w-[60px] text-center">
            {c}
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-1.5">
          {cells.flat().map((value, i) => (
            <div
              key={i}
              className="flex h-[34px] w-[60px] items-center justify-center rounded-md border border-gray-200 bg-white text-xs text-gray-600"
            >
              {value}
            </div>
          ))}
        </div>
        {/* 移動するフォーカス枠 */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-[34px] w-[60px] rounded-md border-2 border-blue-500 bg-blue-500/10"
          style={{ animation: "help03Focus 8s steps(1, end) infinite" }}
        />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Kbd>Tab</Kbd>横へ
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Enter</Kbd>下の行へ
        </span>
      </div>
    </div>
  )
}

/** OMR がマークシートを読み取るイメージ */
function OmrScanFigure() {
  const choices = ["ア", "イ", "ウ", "エ"]
  const correct = 2 // 「ウ」が正解（塗りつぶし）
  return (
    <div aria-hidden className="flex flex-col items-center gap-3">
      <div className="relative h-12 w-[160px] overflow-hidden rounded-md border border-gray-300 bg-white px-3">
        <div className="flex h-full items-center justify-between">
          {choices.map((c, i) => (
            <div
              key={c}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold"
              style={
                i === correct
                  ? {
                      borderColor: "#111827",
                      backgroundColor: "#111827",
                      color: "#ffffff",
                    }
                  : { borderColor: "#d1d5db", color: "#9ca3af" }
              }
            >
              {c}
            </div>
          ))}
        </div>
        {/* 読み取り線 */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-full w-0.5 bg-blue-500/80"
          style={{ animation: "help03Scan 4s ease-in-out infinite" }}
        />
        {/* 読み取り結果のチェック */}
        <span
          className="pointer-events-none absolute top-0 right-2 text-lg font-bold text-emerald-500"
          style={{
            top: "2px",
            animation: "help03Check 4s ease-in-out infinite",
          }}
        >
          ✓
        </span>
      </div>
      <span className="text-[11px] text-gray-500">
        塗られたマークを自動で読み取り
      </span>
    </div>
  )
}

export function HelpContent03RegionInfo() {
  return (
    <HelpDoc>
      <style>{HELP03_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 3 / 領域情報"
        title="採点する場所に、くわしい情報を設定する"
        lead="前のステップで囲んだ場所が、表に1行ずつ並びます。各行で「この場所は何か（種類）」「名前（ラベル）」「配点」などを設定して、採点の準備を整えましょう。"
      />

      <FocusSection title="① 表で領域の情報を設定する">
        <p>
          画面の左側には模範解答のすべてのページが並び、囲んだ場所（領域）が色付きの四角で表示されます。右側には、その領域が1行ずつ並んだ表があります。表の行をクリックすると、左側の対応する場所がオレンジ色で強調され、どこを設定しているのかがひと目で分かります。
        </p>
        <Figure caption="表の行を選ぶと、左のプレビューで対応する領域がオレンジ色で強調されます。">
          <RowRegionSyncFigure />
        </Figure>
        <p>表の各列では、次の内容を確認・設定できます。</p>
        <div className="flex flex-wrap gap-2">
          <Pill>＃ … 並び順の番号</Pill>
          <Pill>ページ … 何ページ目か（自動表示）</Pill>
          <Pill>種類 … その場所が何か</Pill>
          <Pill>ラベル … 分かりやすい名前</Pill>
          <Pill>配点 … その問題の満点</Pill>
          <Pill>OMR … マークシートの読み取り設定</Pill>
        </div>
        <Callout type="tip" title="入力は自動で保存されます">
          設定した内容は、入力をやめてしばらくすると自動的に保存されます。保存ボタンを押す必要はありません。
        </Callout>
      </FocusSection>

      <FocusSection title="② 領域の種類を選ぶ">
        <p>
          「種類」の欄をクリックすると、その場所が何かを一覧から選べます。種類によって採点アプリでの扱いが変わるため、まず正しい種類を選びましょう。
        </p>
        <p>選べる種類は次のとおりです。</p>
        <div className="flex flex-wrap gap-2">
          <Pill>設問解答</Pill>
          <Pill>氏名</Pill>
          <Pill>生徒番号</Pill>
          <Pill>合計点</Pill>
          <Pill>小計</Pill>
          <Pill>マーク</Pill>
          <Pill>コメント</Pill>
          <Pill>その他</Pill>
        </div>
        <Callout type="note" title="種類ごとの役割">
          採点して点数をつけるのは「設問解答」です。「氏名」「生徒番号」は答案がだれのものかを確認するための場所です。「合計点」「小計」は計算した点数を表示する場所として使います。
        </Callout>
      </FocusSection>

      <FocusSection title="③ ラベルと配点を入力する">
        <p>
          「ラベル」の欄には、採点のときに分かりやすい名前を入力します。たとえば「問1」「問2-1」「問3-a」のように、問題用紙と同じ番号を使うと迷いにくくなります。
        </p>
        <p>
          「配点」の欄には、その問題の満点を入力します。たとえば「10」や「2.5」のように、小数の配点も入力できます。
        </p>
        <Callout
          type="warning"
          title="配点を入力できるのは「設問解答」だけです"
        >
          配点を入力できるのは、種類が「設問解答」の行だけです。それ以外の種類の行では配点の欄が「-」と表示され、入力できません。配点を入れたいのに入力できないときは、まず種類が「設問解答」になっているか確認してください。
        </Callout>
      </FocusSection>

      <FocusSection title="④ キーボードですばやく入力する">
        <p>
          たくさんの行に入力するときは、マウスを使わずキーボードだけで次の欄へ移動できます。表の入力欄で次のキーを使ってみてください。
        </p>
        <ul className="ml-1 space-y-2">
          <li>
            <Kbd>Tab</Kbd> … 同じ行の次の欄へ進みます。
          </li>
          <li>
            <Kbd>Shift</Kbd>+<Kbd>Tab</Kbd> … 同じ行の前の欄へ戻ります。
          </li>
          <li>
            <Kbd>Enter</Kbd> … 次の行の同じ欄へ進みます。
          </li>
          <li>
            <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> … 前の行の同じ欄へ戻ります。
          </li>
        </ul>
        <Figure caption="Tab で同じ行の右の欄へ、Enter で次の行へとフォーカスが移ります。">
          <CellFocusFigure />
        </Figure>
        <Callout type="tip" title="同じ項目を続けて入力するとき">
          <Kbd>Enter</Kbd>{" "}
          を使うと、ラベルだけ、または配点だけを上から順にどんどん入力していけます。同じ種類の作業をまとめて進めたいときに便利です。
        </Callout>
      </FocusSection>

      <FocusSection title="⑤ 行の順番を入れ替える">
        <p>
          表の行は、上下にドラッグして順番を入れ替えられます。各行の左にあるつまみ（縦の点が並んだ印）をつかんで、置きたい場所まで動かしてください。採点や結果出力のときに見やすい順番に並べておくと、あとの作業がスムーズになります。
        </p>
        <p>
          いらない領域は、行の右端にあるごみ箱のアイコンから削除できます。削除すると確認の画面が出るので、間違いがないか確かめてから消してください。
        </p>
      </FocusSection>

      <FocusSection title="⑥ マークシートを自動で読み取る（OMR）">
        <p>
          選択式のマークシートや、数字を書き込む解答欄は、コンピューターに自動で読み取らせることができます。これを「OMR（マークの自動読み取り）」と呼びます。
        </p>
        <Figure caption="塗りつぶされたマークをコンピューターが読み取り、自動で答え合わせをします。">
          <OmrScanFigure />
        </Figure>
        <p>
          種類が「設問解答」の行には「OMR」のボタンが表示されます。これを押すと設定欄が開き、読み取りの種類を選べます。
        </p>
        <ul className="ml-1 space-y-2">
          <li>
            <strong>選択肢</strong> …
            ア・イ・ウのような選択式の解答です。選択肢の数（2〜10）や横並び・縦並びの並べ方を決め、それぞれの選択肢に名前を付けて、正しい答えにチェックを入れます。
          </li>
          <li>
            <strong>手書き数字</strong> …
            数字を書き込む解答です。桁数（1〜5）と正しい答え（例：42）を入力します。
          </li>
        </ul>
        <p>
          内容を決めたら「設定」（または「更新」）ボタンで保存します。設定をやめたいときは「削除」ボタンで消せます。
        </p>
        <Callout type="success" title="採点が自動で進みます">
          OMRを設定しておくと、その問題は読み取り結果をもとに自動で採点されるため、手作業の採点を減らせます。
        </Callout>
      </FocusSection>

      <FocusSection title="⑦ 合計配点を確認して次へ進む">
        <p>
          表の下と、左側のページ一覧の下には「合計配点」が表示されます。これは「設問解答」の配点をすべて足した点数です。試験全体の満点と合っているか、ここで確認しましょう。
        </p>
        <p>
          確認できたら、画面右上の「次へ:
          小計点の設定」ボタンから次のステップへ進めます。
        </p>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="warning" title="表に領域が表示されない">
          表に1行も出てこないときは、前のステップ「採点領域作成」で採点する場所をまだ囲んでいない可能性があります。前のステップに戻り、模範解答の上で採点したい場所を囲んでから、このページに進んでください。
        </Callout>
        <Callout type="tip" title="設定を間違えても大丈夫です">
          種類・ラベル・配点は、何度でも選び直したり入力し直したりできます。変更した内容は自動で保存されるので、気づいたときに直せば問題ありません。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
