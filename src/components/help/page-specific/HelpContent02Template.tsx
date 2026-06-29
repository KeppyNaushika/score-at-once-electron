"use client"

import { MousePointer2, Move } from "lucide-react"
import type { CSSProperties } from "react"

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
// このページ専用の図解アニメーション（CSS）
//
// HelpContent07Scoring の HELP07_KEYFRAMES と同じ方式。モジュール先頭で
// キーフレーム文字列を定義し、HelpDoc の最初の子として <style> で描画する。
// 各図は div＋inline style={{ animation }} の小さな部品で組み立てる。
// ============================================================================

const HELP02_KEYFRAMES = `
/* ドラッグで点線の枠が右下へ広がる */
@keyframes help02DragBox {
  0%, 10% { width: 0px; height: 0px; opacity: 0; }
  16% { opacity: 1; }
  60%, 86% { width: 120px; height: 60px; opacity: 1; }
  100% { width: 120px; height: 60px; opacity: 0; }
}
/* マウスカーソルが枠の左上から右下へ動く */
@keyframes help02DragCursor {
  0%, 10% { transform: translate(0px, 0px); }
  60%, 100% { transform: translate(120px, 60px); }
}
/* 枠が四隅のつまみで大きくなり、つぎに中央ドラッグで移動する */
@keyframes help02Edit {
  0%, 8% { width: 90px; height: 50px; transform: translate(0px, 0px); }
  26%, 42% { width: 120px; height: 70px; transform: translate(0px, 0px); }
  62%, 84% { width: 120px; height: 70px; transform: translate(40px, 18px); }
  100% { width: 120px; height: 70px; transform: translate(40px, 18px); }
}
/* リサイズ中に右下のつまみが強調される */
@keyframes help02Handle {
  0%, 8% { transform: scale(1); }
  26%, 42% { transform: scale(1.7); }
  62%, 100% { transform: scale(1); }
}
/* 移動中だけ中央の移動カーソルが現れる */
@keyframes help02Center {
  0%, 46% { opacity: 0; }
  62%, 84% { opacity: 1; }
  100% { opacity: 0; }
}
/* 自動検出された青い点線枠が順に現れる */
@keyframes help02Detect {
  0%, 8% { opacity: 0; transform: scale(0.85); }
  24% { opacity: 1; transform: scale(1); }
  82% { opacity: 1; transform: scale(1); }
  92%, 100% { opacity: 0; transform: scale(0.85); }
}
`

/** 図の下地となる、答案用紙を模した薄い枠（共通） */
function SheetBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative h-[150px] w-[240px] overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm"
    >
      {children}
    </div>
  )
}

/** 手書きを模した薄いプレースホルダ行 */
function DummyLine({ className }: { className?: string }) {
  return (
    <span className={`block h-2 rounded-sm bg-gray-200 ${className ?? ""}`} />
  )
}

/** ①の図：ドラッグして四角い採点領域を作る様子 */
function DragCreateFigure() {
  return (
    <SheetBackdrop>
      <div className="absolute inset-x-4 top-4 space-y-2">
        <DummyLine className="w-3/4" />
        <DummyLine className="w-1/2" />
      </div>
      <div className="absolute inset-x-4 bottom-4 space-y-2">
        <DummyLine className="w-2/3" />
      </div>
      {/* ドラッグで広がる点線の枠 */}
      <div
        className="absolute rounded-sm border-2 border-dashed border-blue-500 bg-blue-500/10"
        style={{
          left: 44,
          top: 46,
          width: 0,
          height: 0,
          animation: "help02DragBox 4s ease-in-out infinite",
        }}
      />
      {/* 左上から右下へ動くカーソル */}
      <div
        className="absolute"
        style={{
          left: 44,
          top: 46,
          animation: "help02DragCursor 4s ease-in-out infinite",
        }}
      >
        <MousePointer2
          className="h-4 w-4 -translate-x-1 -translate-y-1 text-gray-800"
          fill="white"
        />
      </div>
    </SheetBackdrop>
  )
}

/** 四隅のつまみ（右下だけリサイズ時に強調する） */
const RESIZE_HANDLES: { pos: string; pulse?: boolean }[] = [
  { pos: "-top-1 -left-1" },
  { pos: "-top-1 -right-1" },
  { pos: "-bottom-1 -left-1" },
  { pos: "-bottom-1 -right-1", pulse: true },
]

/** ②の図：四隅のつまみでリサイズ／中央ドラッグで移動する様子 */
function ResizeMoveFigure() {
  return (
    <SheetBackdrop>
      <div className="absolute inset-x-4 top-3 space-y-2">
        <DummyLine className="w-2/3" />
      </div>
      {/* 選択中の枠（大きさが変わり、つぎに位置が動く） */}
      <div
        className="absolute rounded-sm border-2 border-blue-500 bg-blue-500/5"
        style={{
          left: 40,
          top: 44,
          width: 90,
          height: 50,
          animation: "help02Edit 5s ease-in-out infinite",
        }}
      >
        {RESIZE_HANDLES.map((h) => (
          <span
            key={h.pos}
            className={`absolute h-2 w-2 rounded-[1px] border border-blue-600 bg-white ${h.pos}`}
            style={
              h.pulse
                ? { animation: "help02Handle 5s ease-in-out infinite" }
                : undefined
            }
          />
        ))}
        {/* 移動中だけ現れる中央の移動カーソル */}
        <Move
          className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-blue-600"
          style={{ animation: "help02Center 5s ease-in-out infinite" }}
        />
      </div>
    </SheetBackdrop>
  )
}

/** ④の図：印刷された解答欄を自動で見つけて青い点線でハイライトする様子 */
const DETECT_REGIONS: CSSProperties[] = [
  { left: 20, top: 22, width: 90, height: 36 },
  { left: 130, top: 22, width: 90, height: 36 },
  { left: 20, top: 78, width: 200, height: 44 },
]

function AutoDetectFigure() {
  return (
    <SheetBackdrop>
      {/* もとから印刷されている解答欄（薄い実線） */}
      {DETECT_REGIONS.map((r, i) => (
        <div
          key={`box-${i}`}
          className="absolute rounded-sm border border-gray-300"
          style={r}
        />
      ))}
      {/* 自動検出された青い点線の枠（順に現れる） */}
      {DETECT_REGIONS.map((r, i) => (
        <div
          key={`hit-${i}`}
          className="absolute rounded-sm border-2 border-dashed border-blue-500 bg-blue-500/10"
          style={{
            ...r,
            animation: `help02Detect 4.5s ${i * 0.5}s ease-in-out infinite`,
          }}
        />
      ))}
    </SheetBackdrop>
  )
}

export function HelpContent02Template() {
  return (
    <HelpDoc>
      <style>{HELP02_KEYFRAMES}</style>

      <HelpHero
        eyebrow="ステップ 2 / 採点領域"
        title="採点したい範囲を四角で囲む"
        lead="模範解答の画像の上で、採点したい場所をマウスで四角く囲んでいきます。ここで囲んだ範囲が、あとで生徒の答案を採点するときの枠になります。"
      />

      <FocusSection title="① 採点したい場所を四角で囲む">
        <p>
          画面の左側に、模範解答の画像が表示されています。採点したい場所の左上から右下へ向かって、マウスをドラッグ（左ボタンを押したまま動かす）してください。指を離すと、その範囲が四角い枠として作られます。
        </p>
        <Figure caption="左上から右下へドラッグすると、点線の枠が広がって採点領域になります。">
          <DragCreateFigure />
        </Figure>
        <p>
          作った枠は、画面の右側にある「領域一覧」にも追加されます。枠を1つ作るたびに、自動的に保存されますので、保存ボタンを押す必要はありません。
        </p>
        <Callout type="tip" title="少し大きめに囲みましょう">
          生徒が書く文字や図が枠からはみ出さないよう、解答が書かれる範囲よりも少し大きめに囲んでおくと安心です。問題文は囲まず、解答が書かれる部分だけを囲んでください。
        </Callout>
      </FocusSection>

      <FocusSection title="② 大きさと位置を整える">
        <p>
          作った枠をクリックすると、その枠が選ばれて、四隅に小さな四角いつまみが表示されます。このつまみをドラッグすると、枠の大きさを変えられます。
        </p>
        <Figure caption="四隅のつまみをドラッグで大きさを変え、枠の真ん中をドラッグで位置を動かせます。">
          <ResizeMoveFigure />
        </Figure>
        <p>
          枠の真ん中をドラッグすると、枠ごと位置を動かせます。大きさを変えたり動かしたりした内容も、そのつど自動的に保存されます。
        </p>
      </FocusSection>

      <FocusSection title="③ いらない範囲を消す">
        <p>
          間違えて作ってしまった枠は、削除できます。まず消したい枠をクリックして選び、つぎに{" "}
          <Kbd>Delete</Kbd> キーか <Kbd>Backspace</Kbd>{" "}
          キーを押してください。選んでいた枠が消えます。
        </p>
        <p>
          消したあとは、もう一度正しい場所をドラッグして囲み直してください。削除した内容も自動的に保存されます。
        </p>
      </FocusSection>

      <FocusSection title="④ 枠を自動で見つけてもらう">
        <p>
          答案用紙に、もとから枠線（解答欄を囲む線）が印刷されている場合は、その枠をアプリが自動で見つけてくれます。画面右上のタブで{" "}
          <Pill>自動検出</Pill> を選ぶと、見つかった枠が青い点線で表示されます。
        </p>
        <Figure caption="印刷された解答欄をアプリが見つけると、青い点線の枠でハイライトされます。">
          <AutoDetectFigure />
        </Figure>
        <p>
          青い点線の枠をクリックすると、その形に合わせた採点領域がそのまま作られます。手でドラッグして囲んだときも、近くに点線の枠があれば、その線にぴったり合うように調整されます。
        </p>
        <p>
          うまく枠が見つからないときは、「検出設定」を開いて「検出感度」を上げると、薄い線やかすれた線も見つけやすくなります。設定を変えすぎたときは「デフォルトに戻す」で元の状態に戻せます。枠線が無い答案や、自分で自由に囲みたいときは、タブを{" "}
          <Pill>手動指定</Pill>{" "}
          に切り替えると、点線の枠が消えて、ドラッグだけで囲めるようになります。
        </p>
        <Callout type="note" title="自動検出はあくまで補助です">
          自動検出はきれいな枠線がある答案ほど得意です。思った場所が見つからないときは、無理をせず手動指定に切り替えて、自分でドラッグして囲んでください。
        </Callout>
      </FocusSection>

      <FocusSection title="⑤ 何を囲めばよいか">
        <p>
          採点や集計に使いたい場所を、もれなく囲んでおきます。よく囲むのは次のような場所です。
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill>設問の解答欄</Pill>
          <Pill>氏名欄</Pill>
          <Pill>生徒番号欄</Pill>
          <Pill>合計点欄（必要なら）</Pill>
          <Pill>小計欄（必要なら）</Pill>
        </div>
        <p>
          ドラッグして囲んだ枠は、最初はすべて「設問（解答欄）」として作られます。それぞれの枠が、氏名欄なのか・生徒番号欄なのか・合計点欄なのか、また何点の設問なのかといった細かい設定は、次のステップ「採点領域の詳細情報設定」でおこないます。ここでは、まず必要な場所をすべて囲むことに集中してください。
        </p>
        <Callout type="tip" title="配点の初期値を決めておくと便利です">
          画面右側の「配点の初期値」に点数を入れておくと、新しく作る設問に、その点数が最初から入ります。同じ配点の設問が多いときに、入力の手間を減らせます。
        </Callout>
      </FocusSection>

      <FocusSection title="⑥ 複数ページを切り替える">
        <p>
          模範解答が複数ページあるときは、画面の上にページの切り替えボタンが表示されます。左右の矢印ボタンを押すか、ドロップダウンからページを選ぶと、別のページに移動できます。
        </p>
        <p>
          ページを切り替えると、それまでに作った枠は自動的に保存されます。採点領域は、ページごとに囲む必要がありますので、すべてのページで忘れずに囲んでください。
        </p>
      </FocusSection>

      <FocusSection title="⑦ 画面を拡大・縮小する">
        <p>
          細かい場所を正確に囲みたいときは、画像を拡大すると作業がしやすくなります。{" "}
          <Kbd>Ctrl</Kbd>{" "}
          キーを押しながらマウスのホイールを回すと、拡大・縮小ができます。
        </p>
        <p>
          キーボードでも操作できます。画像をクリックして選んでから、{" "}
          <Kbd>Ctrl</Kbd>+<Kbd>+</Kbd> で拡大、<Kbd>Ctrl</Kbd>+<Kbd>-</Kbd>{" "}
          で縮小、<Kbd>Ctrl</Kbd>+<Kbd>0</Kbd>{" "}
          でもとの大きさに戻ります。拡大して画面からはみ出した部分は、通常どおりスクロールで見られます。画面右上の{" "}
          <Kbd>?</Kbd>{" "}
          ボタンを押すと、これらの操作の一覧をいつでも確認できます。
        </p>
      </FocusSection>

      <FocusSection title="⑧ 次のステップへ進む">
        <p>
          表示しているページに採点領域を1つ以上作ると、画面の右上に「次へ:
          採点領域の詳細情報設定」ボタンが表示されます。このボタンを押すと、次のステップへ進めます。
        </p>
        <Callout type="success" title="複数ページがあるときは">
          すべてのページで採点領域を囲んでから、次のステップへ進んでください。一部のページを囲み忘れると、そのページの解答を採点できなくなります。
        </Callout>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="warning" title="範囲を間違えてしまったとき">
          間違えた枠をクリックして選び、<Kbd>Delete</Kbd> キーか{" "}
          <Kbd>Backspace</Kbd>{" "}
          キーで削除してから、もう一度正しい場所を囲み直してください。
        </Callout>
        <Callout type="tip" title="枠が小さすぎて作れないとき">
          ドラッグした範囲が小さすぎると、枠は作られません。少し大きめにドラッグするか、画像を拡大してから囲み直してみてください。
        </Callout>
        <Callout type="note" title="作業の内容は自動で保存されます">
          枠の作成・大きさの変更・移動・削除は、そのつど自動的に保存されます。保存ボタンを押す必要はありませんので、安心して作業を進めてください。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
