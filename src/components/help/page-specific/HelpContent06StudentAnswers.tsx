"use client"

import { FileText, MousePointer2 } from "lucide-react"

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
// このページ専用の図解アニメーション（CSS / SVG）
// keyframe 名はすべて help06 で始める。
// ============================================================================

const HELP06_KEYFRAMES = `
/* 答案がマス目にポンと現れる（配置されていく様子） */
@keyframes help06Pop {
  0% { opacity: 0; transform: scale(0.4); }
  6% { opacity: 1; transform: scale(1); }
  88% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}
/* つかんだ答案が右のマス目へ移る */
@keyframes help06SwapR {
  0%, 16% { transform: translateX(0); }
  50%, 82% { transform: translateX(76px); }
  100% { transform: translateX(0); }
}
/* もう一方の答案が左のマス目へ移る */
@keyframes help06SwapL {
  0%, 16% { transform: translateX(0); }
  50%, 82% { transform: translateX(-76px); }
  100% { transform: translateX(0); }
}
/* つかんでいる間だけ少し浮き上がる */
@keyframes help06Grab {
  0%, 12% { transform: scale(1); }
  16%, 84% { transform: scale(1.07); }
  88%, 100% { transform: scale(1); }
}
/* マウスカーソルが答案と一緒に動く */
@keyframes help06Cursor {
  0%, 16% { transform: translate(0, 0); }
  50%, 82% { transform: translate(76px, 0); }
  100% { transform: translate(0, 0); }
}
`

/** 生徒名（図解用のダミー） */
const GRID_ROWS = ["佐藤", "鈴木", "高橋"]

/** 1つのマス目。答案アイコンが遅延つきでポンと現れる（配置の様子） */
function PlacementCell({ order }: { order: number }) {
  return (
    <div className="flex h-9 w-12 items-center justify-center rounded-md border border-blue-200 bg-blue-50">
      <FileText
        aria-hidden
        className="h-4 w-4 text-blue-500"
        style={{
          opacity: 0,
          animation: `help06Pop 6s ${order * 0.35}s infinite`,
        }}
      />
    </div>
  )
}

/** 取り込んだ答案が「生徒 × ページ」のマス目へ順に並んでいく図 */
function PlacementGridFigure() {
  return (
    <div
      aria-hidden
      className="grid items-center gap-2 text-xs text-gray-500"
      style={{ gridTemplateColumns: "auto repeat(2, auto)" }}
    >
      <span />
      <span className="text-center font-medium">1ページ目</span>
      <span className="text-center font-medium">2ページ目</span>
      {GRID_ROWS.map((name, row) => (
        <Row key={name} name={name} row={row} />
      ))}
    </div>
  )
}

/** 配置グリッドの1行（生徒名＋ページぶんのマス目） */
function Row({ name, row }: { name: string; row: number }) {
  return (
    <>
      <span className="pr-1 text-right font-medium text-gray-600">{name}</span>
      <PlacementCell order={row} />
      <PlacementCell order={row + GRID_ROWS.length} />
    </>
  )
}

/** ドラッグで2つの答案の配置を入れ替える図 */
function DragSwapFigure() {
  const cardBase =
    "flex h-11 w-16 flex-col items-center justify-center gap-0.5 rounded-md border bg-white text-[10px] font-medium shadow-sm"
  return (
    <div aria-hidden className="relative flex items-center gap-3">
      <div
        className="relative z-10"
        style={{ animation: "help06SwapR 5s infinite" }}
      >
        <div
          className={`${cardBase} border-blue-400 text-blue-700`}
          style={{ animation: "help06Grab 5s infinite" }}
        >
          <FileText className="h-4 w-4 text-blue-500" />
          佐藤
        </div>
      </div>
      <div style={{ animation: "help06SwapL 5s infinite" }}>
        <div className={`${cardBase} border-gray-300 text-gray-600`}>
          <FileText className="h-4 w-4 text-gray-400" />
          鈴木
        </div>
      </div>
      <MousePointer2
        className="absolute -bottom-1 left-10 h-4 w-4 text-gray-700"
        style={{ animation: "help06Cursor 5s infinite" }}
      />
    </div>
  )
}

export function HelpContent06StudentAnswers() {
  return (
    <HelpDoc>
      <style>{HELP06_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 6 / 答案"
        title="答案を取り込んで、生徒に紐づける"
        lead="生徒の答案を画像やPDFで取り込み、「どの生徒の・何ページ目か」を表の上で確かめながら保存します。スキャンの順番に合わせて配置のしかたを選べば、ほとんど自動で並びます。"
      />

      <FocusSection title="① 答案ファイルを取り込む">
        <p>
          画面はタブで2つに分かれています。新しく答案を取り込むときは
          <strong>「新規追加」</strong>
          タブを使います。上部の「ファイルアップロード」の枠に答案ファイルを
          ドラッグ&ドロップするか、枠をクリックしてファイルを選んでください。
          複数のファイルをまとめて取り込めます。
        </p>
        <p>
          使えるファイルは次のとおりです。PDFは自動的に1ページずつの画像へ
          変換されます（少し時間がかかる場合があります）。
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill>PDF</Pill>
          <Pill>PNG</Pill>
          <Pill>JPEG / JPG</Pill>
          <Pill>TIFF</Pill>
          <Pill>BMP</Pill>
        </div>
        <Callout type="note" title="パスワード付きPDFのとき">
          パスワードが設定されたPDFを取り込むと、パスワードの入力画面が表示されます。
          パスワードを入力すると変換が続きます。
        </Callout>
      </FocusSection>

      <FocusSection title="② 配置のしかたを選ぶ">
        <p>
          取り込んだ答案は、表の中へ自動的に並べられます。表は
          <strong>縦が生徒・横がページ</strong>
          になっていて、それぞれのマス目に答案が入ります。どう並べるかは、表の上の
          <strong>「配置戦略」</strong>
          で選びます。スキャンした順番に合わせて選んでください。
        </p>
        <Figure caption="取り込んだ答案は、配置戦略の順番にしたがって、生徒とページのマス目へ自動的に並びます。">
          <PlacementGridFigure />
        </Figure>
        <Callout type="tip" title="スキャン順に合わせて選びましょう">
          <span className="block">
            <strong>ページ順</strong>
            ：全員の1ページ目をまとめて、次に全員の2ページ目…という順に
            スキャンした場合に選びます。
          </span>
          <span className="mt-2 block">
            <strong>生徒順</strong>
            ：1人目の全ページ、次に2人目の全ページ…という順に
            スキャンした場合に選びます。
          </span>
        </Callout>
        <p>
          生徒の並び順は、ステップ5「受験生徒管理」で決めた順番がそのまま使われます。
          選び方を変えると、答案が表の中で並べ直されます。
        </p>
      </FocusSection>

      <FocusSection title="③ 表で並びを確かめる・直す">
        <p>
          自動の配置が正しいとはかぎりません。保存する前に、
          <strong>「どの答案が、どの生徒のどのページに入っているか」</strong>
          を表の上で必ず確認してください。ずれている答案があれば、その答案を
          正しいマス目へドラッグして移動できます。
        </p>
        <Figure caption="ずれている答案は、つかんで正しいマス目へドラッグすると入れ替えられます。">
          <DragSwapFigure />
        </Figure>
        <p>
          名前を確認しやすくするための表示の切り替えもあります。表の上の
          <strong>「プレビュー」</strong>で<strong>「氏名欄のみ」</strong>
          を選ぶと、答案の氏名欄だけを大きく表示できます。氏名欄を使うには、
          採点領域の設定で氏名欄をあらかじめ決めておく必要があります。
        </p>
        <Callout type="note" title="いらない答案を一時的に外す">
          表からはみ出した答案や不要な答案は、右上の
          <strong>「無効化済み」</strong>
          に入れて保存対象から外せます。やっぱり使いたいときは、
          そこから「復元」で戻せます。
        </Callout>
      </FocusSection>

      <FocusSection title="④ アップロードして保存する">
        <p>
          並びを確認できたら、表の上の
          <strong>「アップロード実行」</strong>
          ボタンを押して保存します。保存が終わると、答案が試験に登録されます。
        </p>
        <Callout type="success" title="必要なときだけ使うスイッチ">
          <span className="block">
            <strong>既存答案上書き</strong>
            ：同じマス目にすでに答案があるとき、新しい答案で置き換えます。
            撮り直した答案に差し替えたいときに使います。
          </span>
          <span className="mt-2 block">
            <strong>マーカー補正</strong>
            ：答案の傾きや位置のずれを、模範解答に付いた目印（マーカー）に
            合わせて自動でそろえます。模範解答にマーカーがある場合だけ使えます。
          </span>
        </Callout>
      </FocusSection>

      <FocusSection title="⑤ あとから配置を直す">
        <p>
          いったん保存した答案の配置は、
          <strong>「配置済み答案の確認」</strong>
          タブから直せます。答案を別のマス目へドラッグして並べ替え、 画面右上の
          <strong>「○件の変更を反映」</strong>
          ボタンを押すと、変更がまとめて保存されます。
        </p>
        <p>
          変更を反映するときは、採点データの扱い方をたずねる画面が出ます。
          答案と採点結果がずれないように、ふだんは
          <strong>「採点情報も一緒に入れ替え」（推奨）</strong>
          を選んでください。
        </p>
        <Callout type="warning" title="「答案画像のみ入れ替え」に注意">
          このときに「答案画像のみ入れ替え」を選ぶと、採点結果は元の位置に残ったまま
          答案だけが動きます。答案と採点結果が食い違ってしまうため、特別な理由が
          ないかぎり選ばないでください。
        </Callout>
        <p>
          空いているマス目をクリックすると、そのマスだけに答案を追加することも
          できます。間違って入れた答案は、答案のメニューから削除できます。
        </p>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="tip" title="答案の位置がずれている">
          答案をドラッグして正しいマス目へ動かせます。「新規追加」タブなら
          そのまま、「配置済み答案の確認」タブなら最後に
          <strong>「○件の変更を反映」</strong>を押して保存してください。
        </Callout>
        <Callout type="warning" title="自動配置がうまく並ばない">
          スキャンした順番と「配置戦略」（ページ順・生徒順）が合っているか
          確かめてください。順番を選び直しても合わないときは、答案をドラッグして
          手で並べ直せます。
        </Callout>
        <Callout type="note" title="表が出てこない・マスが灰色のまま">
          答案を並べるには、先に模範解答が必要です。模範解答が登録されていないと
          「模範解答が登録されていません」と表示されます。その場合は
          ステップ1「模範解答アップロード」を先に終わらせてください。
        </Callout>
        <p>
          答案がそろったら、画面右上の
          <span className="mx-1 inline-flex items-center">
            <Kbd>次へ: 一括採点</Kbd>
          </span>
          からステップ7「一括採点」へ進みます。
        </p>
      </FocusSection>
    </HelpDoc>
  )
}
