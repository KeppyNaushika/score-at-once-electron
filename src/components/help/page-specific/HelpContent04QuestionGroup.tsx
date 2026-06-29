"use client"

import { ArrowDown, Check } from "lucide-react"
import { Fragment } from "react"

import {
  Callout,
  Figure,
  FocusSection,
  HelpDoc,
  HelpHero,
} from "@/components/help/common/DocComponents"

// ============================================================================
// このページ専用の図解アニメーション（CSS キーフレーム）
// 「関連付けのマトリクス」と「グループ内 OR・グループ間 AND の集計ルール」を、
// 小さな図でゆっくり繰り返し見せて、文章だけでは伝わりにくい操作を補う。
// ============================================================================

const HELP04_KEYFRAMES = `
/* マスにチェックが1つずつ付いていく（順番に現れて、最後にまとめて消えて繰り返す） */
@keyframes help04Tick {
  0% { opacity: 0; transform: scale(0.2); }
  6% { opacity: 1; transform: scale(1.2); }
  10% { transform: scale(1); }
  90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.2); }
}
/* グループ内 OR：左の項目が先に光り、続いて右の項目が光る（どちらでも対象） */
@keyframes help04OrA {
  0%, 100% { background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  18%, 38% { background-color: #3b82f6; border-color: #3b82f6; color: #ffffff; }
}
@keyframes help04OrB {
  0%, 38%, 100% { background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  54%, 74% { background-color: #3b82f6; border-color: #3b82f6; color: #ffffff; }
}
/* グループ間 AND：両方を掛け合わせる印を脈打たせる */
@keyframes help04AndPulse {
  0%, 100% { transform: scale(1); opacity: 0.75; }
  50% { transform: scale(1.12); opacity: 1; }
}
/* 掛け合わせた結果（両方を満たす設問）が下からふわりと現れる */
@keyframes help04Result {
  0%, 30% { opacity: 0; transform: translateY(4px); }
  45%, 90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(4px); }
}
`

/** 関連付けの図：横に小計項目、縦に設問を並べ、マスへ順にチェックが付く */
const MATRIX_COLS = ["大問1", "知識・理解"]
const MATRIX_ROWS: { label: string; checks: boolean[] }[] = [
  { label: "問1", checks: [true, true] },
  { label: "問2", checks: [true, false] },
  { label: "問3", checks: [false, true] },
]

function MatrixFigure() {
  // チェックが付く順番（左上から行ごとに）に合わせて表示を少しずつ遅らせる
  let order = 0
  return (
    <div aria-hidden className="w-full max-w-[18rem]">
      <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-1.5 text-xs">
        <div />
        {MATRIX_COLS.map((col) => (
          <div
            key={col}
            className="rounded-md bg-blue-50 px-1 py-1.5 text-center font-medium text-blue-700"
          >
            {col}
          </div>
        ))}
        {MATRIX_ROWS.map((row) => (
          <Fragment key={row.label}>
            <div className="flex items-center justify-center font-medium text-gray-600">
              {row.label}
            </div>
            {row.checks.map((checked, ci) => {
              const delay = checked ? order++ * 0.5 : 0
              return (
                <div
                  key={ci}
                  className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white"
                >
                  {checked && (
                    <Check
                      className="h-4 w-4 text-blue-600"
                      style={{
                        opacity: 0,
                        animation: `help04Tick 8s ${delay}s infinite`,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** 集計ルールの図：グループ内は OR、グループ間は AND で対象設問を絞り込む様子 */
function RuleFigure() {
  return (
    <div aria-hidden className="flex w-full flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* 大問グループ：内側は OR（どちらかに該当） */}
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
          <span className="text-[10px] font-medium text-blue-500">
            大問グループ
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-md border px-2 py-1 text-xs font-medium"
              style={{ animation: "help04OrA 6s infinite" }}
            >
              大問1
            </span>
            <span className="text-[10px] font-bold text-gray-400">OR</span>
            <span
              className="rounded-md border px-2 py-1 text-xs font-medium"
              style={{ animation: "help04OrB 6s infinite" }}
            >
              大問2
            </span>
          </div>
        </div>

        {/* グループ間は AND（両方を掛け合わせる） */}
        <span
          className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700"
          style={{ animation: "help04AndPulse 6s infinite" }}
        >
          AND
        </span>

        {/* 観点グループ：1項目 */}
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <span className="text-[10px] font-medium text-emerald-600">
            観点グループ
          </span>
          <span className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700">
            知識・理解
          </span>
        </div>
      </div>

      <ArrowDown className="h-4 w-4 text-gray-400" />

      <span
        className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-center text-xs font-medium text-violet-700"
        style={{ animation: "help04Result 6s infinite" }}
      >
        大問1 または 大問2 で、かつ 知識・理解 の設問
      </span>
    </div>
  )
}

export function HelpContent04QuestionGroup() {
  return (
    <HelpDoc>
      <style>{HELP04_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 4 / 小計点"
        title="小計点を設定する"
        lead="設問の点数を「漢字」「読解」「大問1」などの項目ごとにまとめて集計できるようにします。設定しておくと、出力する成績表に項目別の合計点を表示できます。"
      />

      <FocusSection title="① 小計点グループを準備する">
        <p>
          「小計点」とは、いくつかの設問の点数をまとめた合計のことです。たとえば「漢字に関する設問の合計」や「大問1の合計」が小計点にあたります。そして、関連する小計項目をひとまとめにしたものを「小計点グループ」と呼びます。
        </p>
        <p>
          このページの一番上にある「小計点グループ」のカードで、画面右の「グループを追加」ボタンを押すと、選択画面が開きます。すでに作成してあるグループの一覧から、使いたいものの「追加」ボタンを押すと、この試験で使えるようになります。
        </p>
        <p>
          一覧は名前で検索できますので、グループが多いときは検索欄に名前を入力して絞り込んでください。追加したグループは、不要になればカード右側のゴミ箱のアイコンで試験から外せます。
        </p>
        <Callout type="note" title="グループの作り方">
          使いたいグループがまだない場合は、選択画面の上にある「新規作成」ボタンを押してください。「小計点グループ管理」のページが開き、そこでグループと項目を作成できます。一度作ったグループは、いくつもの試験で使い回せます。
        </Callout>
      </FocusSection>

      <FocusSection title="② 設問を小計項目に関連付ける">
        <p>
          グループを追加すると、「設問と小計項目の関連付け」という表が表示されます。表の縦には試験の設問が、横には小計項目が並びます。各設問について、その点数を含めたい小計項目のマスにチェックを入れてください。
        </p>
        <p>
          1つの設問は、複数の小計項目に同時に関連付けられます。たとえば「問1」を「大問1」と「知識・理解」の両方にチェックを入れておくと、その点数は両方の小計点に加算されます。
        </p>
        <Figure caption="含めたい小計項目のマスにチェックして、各設問を関連付けます。">
          <MatrixFigure />
        </Figure>
        <Callout type="success" title="まとめてチェックできます">
          マスにマウスを合わせると、右下に小さな四角（フィルハンドル）が現れます。これをドラッグすると、Excelのように、なぞった範囲のマスへチェックの有無をまとめてコピーできます。たくさんの設問を一度に設定したいときに便利です。
        </Callout>
      </FocusSection>

      <FocusSection title="③ 小計点の計算ルールを知る">
        <p>
          複数のグループを使うと、設問の点数をより細かく集計できます。集計のしくみは次のとおりです。
        </p>
        <p>
          同じグループの中では「いずれかの項目に当てはまる（OR）」設問が対象になります。たとえば1つのグループの中で「大問1」または「大問2」のどちらかにチェックされた設問が、まとめて数えられます。
        </p>
        <p>
          別々のグループの間では「すべてに当てはまる（AND）」設問が対象になります。たとえば「大問」のグループと「観点」のグループの両方を使っている場合は、その両方の条件を満たす設問だけが合計されます。
        </p>
        <Figure caption="同じグループの中はOR、別のグループの間はANDで対象の設問を絞り込みます。">
          <RuleFigure />
        </Figure>
        <Callout type="tip" title="組み合わせの例">
          「大問1」または「大問2」に当てはまり、かつ「知識・理解」にも当てはまる設問、というように、2つのグループを掛け合わせた合計点を出せます。観点別の集計や、大問ごとの集計を同時に行いたいときに役立ちます。
        </Callout>
      </FocusSection>

      <FocusSection title="④ 小計点領域に表示する項目を決める">
        <p>
          答案用紙に小計点を書き込む欄（小計点領域）を作ってある場合は、「小計点領域との関連付け」という表も表示されます。ここでは、それぞれの小計点領域に、どの小計項目の合計を表示するかを決めます。
        </p>
        <p>
          表の縦には小計点領域が、横には小計項目が並びます。各小計点領域について、そこに表示したい項目のマスにチェックを入れてください。こちらの表でも、②と同じようにクリックでのチェックや、フィルハンドルのドラッグでのまとめて設定ができます。
        </p>
        <Callout type="note" title="この表が出てこないとき">
          「小計点領域との関連付け」の表は、答案用紙に小計点用の欄を作ってあるときだけ表示されます。表が出てこない場合は、ステップ2「採点領域作成」で小計点領域を追加してから、このページに戻ってきてください。
        </Callout>
      </FocusSection>

      <FocusSection title="⑤ 自動保存とやり直し">
        <p>
          チェックを入れたり外したりするたびに、内容は自動で保存されます。保存している間は、表の見出しの近くに「保存中...」という表示が出ます。保存ボタンを押す必要はありません。
        </p>
        <p>
          各表の右上にある「リセット」ボタンを押すと、表の状態を直前に保存された内容へ戻せます。編集の途中で元に戻したくなったときに使ってください。
        </p>
        <Callout type="warning" title="グループを外すときは注意してください">
          追加した小計点グループを試験から外すと、そのグループに関する関連付けや集計の設定がなくなります。すでに採点が進んでいる場合は影響が出ることがありますので、本当に外してよいかを確認してから操作してください。
        </Callout>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="warning" title="設問の表が出てこない">
          「設問と小計項目の関連付け」の表は、設問の領域があるときだけ表示されます。先にステップ2「採点領域作成」で設問の領域を作成してから、このページに戻ってきてください。
        </Callout>
        <Callout type="tip" title="小計点を使わないとき">
          小計点の設定は必須ではありません。項目別の集計が必要ないときは、このページで何も設定せずに先へ進めます。右上の「次へ:
          受験生徒の管理」ボタンを押すと、次のステップへ移れます。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
