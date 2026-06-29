"use client"

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  Upload,
} from "lucide-react"

import {
  Callout,
  Figure,
  FocusSection,
  HelpDoc,
  HelpHero,
  Kbd,
  Pill,
} from "@/components/help/common/DocComponents"

/**
 * ステップ1「模範解答アップロード」専用のアニメーション定義。
 * keyframe 名は他ページと衝突しないよう help01 で始める。
 */
const HELP01_KEYFRAMES = `
/* ファイルが取り込み口へ吸い込まれる */
@keyframes help01Drop {
  0% { transform: translate(78px,-54px) scale(1); opacity: 0; }
  12% { opacity: 1; }
  55% { transform: translate(0,0) scale(1); opacity: 1; }
  72% { transform: translate(0,0) scale(0.7); opacity: 0.5; }
  85%, 100% { transform: translate(0,0) scale(0.35); opacity: 0; }
}
/* 取り込み口がファイルを受け取った瞬間に青く光る */
@keyframes help01Zone {
  0%, 50% { border-color: #cbd5e1; background-color: rgba(0,0,0,0); }
  62% { border-color: #3b82f6; background-color: rgba(59,130,246,0.10); }
  80%, 100% { border-color: #cbd5e1; background-color: rgba(0,0,0,0); }
}
/* PDFから1ページずつ画像が現れる（delay で順番に） */
@keyframes help01PageIn {
  0%, 10% { opacity: 0; transform: scale(0.6) translateY(8px); }
  24%, 90% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.6) translateY(8px); }
}
/* 左のページが右へ弧を描いて移動して戻る（順番の入れ替え） */
@keyframes help01SwapRight {
  0%, 18% { transform: translate(0,0); }
  40%, 60% { transform: translate(96px,-16px); }
  82%, 100% { transform: translate(0,0); }
}
/* 右のページが左へ弧を描いて移動して戻る */
@keyframes help01SwapLeft {
  0%, 18% { transform: translate(0,0); }
  40%, 60% { transform: translate(-96px,16px); }
  82%, 100% { transform: translate(0,0); }
}
/* 右向き矢印が押された合図に光る（右へ動くとき） */
@keyframes help01ArrowR {
  0%, 20% { color: #9ca3af; transform: scale(1); }
  32%, 48% { color: #2563eb; transform: scale(1.3); }
  60%, 100% { color: #9ca3af; transform: scale(1); }
}
/* 左向き矢印が押された合図に光る（左へ戻すとき） */
@keyframes help01ArrowL {
  0%, 60% { color: #9ca3af; transform: scale(1); }
  72%, 86% { color: #2563eb; transform: scale(1.3); }
  100% { color: #9ca3af; transform: scale(1); }
}
`

/** ファイルを取り込み口へドラッグ＆ドロップする様子の図 */
function DropZoneFigure() {
  return (
    <div aria-hidden className="relative h-32 w-56">
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400"
        style={{ animation: "help01Zone 4s ease-in-out infinite" }}
      >
        <Upload className="h-6 w-6" />
        <span className="text-xs font-medium">ファイルを選択</span>
      </div>
      <div
        className="absolute top-1/2 left-1/2 -mt-7 -ml-5 flex h-14 w-10 flex-col items-center justify-center gap-1 rounded-md border border-blue-300 bg-white shadow-md"
        style={{ animation: "help01Drop 4s ease-in-out infinite" }}
      >
        <FileText className="h-5 w-5 text-blue-500" />
        <span className="text-[8px] font-bold text-gray-400">PDF</span>
      </div>
    </div>
  )
}

/** PDF1ファイルがページごとの画像に分かれる様子の図 */
function PdfConvertFigure() {
  return (
    <div aria-hidden className="flex items-center gap-3">
      <div className="flex h-20 w-14 flex-col items-center justify-center gap-1 rounded-md border border-gray-300 bg-white shadow-sm">
        <FileText className="h-7 w-7 text-rose-500" />
        <span className="text-[9px] font-bold text-gray-500">PDF</span>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-gray-400" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-20 w-14 flex-col items-center justify-between rounded-md border border-gray-300 bg-white p-1.5 shadow-sm"
            style={{
              animation: `help01PageIn 5s ${i * 0.5}s ease-in-out infinite both`,
            }}
          >
            <ImageIcon className="mt-1 h-6 w-6 text-blue-400" />
            <span className="text-[9px] font-bold text-gray-500">
              {i + 1}ページ
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 順番入れ替え用のページカード（弧を描いて移動） */
function SwapCard({
  label,
  tone,
  position,
  animation,
}: {
  label: string
  tone: "blue" | "emerald"
  position: string
  animation: string
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-300 bg-blue-50 text-blue-600"
      : "border-emerald-300 bg-emerald-50 text-emerald-600"
  return (
    <div
      className={`absolute top-0 ${position} flex h-24 w-16 flex-col items-center justify-center gap-1 rounded-md border-2 shadow-sm ${toneClass}`}
      style={{ animation: `${animation} 5s ease-in-out infinite` }}
    >
      <ImageIcon className="h-6 w-6" />
      <span className="text-xs font-bold">{label}</span>
    </div>
  )
}

/** 左右の矢印でページの順番を入れ替える様子の図 */
function ReorderFigure() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-4">
      <div className="relative h-24 w-40">
        <SwapCard
          label="ページ A"
          tone="blue"
          position="left-0"
          animation="help01SwapRight"
        />
        <SwapCard
          label="ページ B"
          tone="emerald"
          position="right-0"
          animation="help01SwapLeft"
        />
      </div>
      <div className="flex items-center gap-3 text-gray-400">
        <ChevronLeft
          className="h-6 w-6"
          style={{ animation: "help01ArrowL 5s ease-in-out infinite" }}
        />
        <span className="text-xs font-medium text-gray-500">
          順番を入れ替え
        </span>
        <ChevronRight
          className="h-6 w-6"
          style={{ animation: "help01ArrowR 5s ease-in-out infinite" }}
        />
      </div>
    </div>
  )
}

/**
 * ステップ1「模範解答アップロード」の使い方ガイド。
 * 実機能（FileUploadDropzone / MasterAnswerGallery / useMasterAnswers）に
 * 基づき、ファイルの取り込みから順序・用紙サイズの調整までを説明する。
 */
export function HelpContent01Upload() {
  return (
    <HelpDoc>
      <style>{HELP01_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 1 / アップロード"
        title="模範解答をアップロードする"
        lead="採点の見本になる模範解答を取り込みます。PDFや画像を取り込むと、後の採点で各設問の正解を見くらべられるようになります。最初に行う準備のステップです。"
      />

      <FocusSection title="① ファイルを用意する">
        <p>
          模範解答のファイルを用意します。対応しているファイルの種類は次のとおりです。
        </p>
        <p className="flex flex-wrap gap-2">
          <Pill>PDF</Pill>
          <Pill>PNG</Pill>
          <Pill>JPG / JPEG</Pill>
        </p>
        <p>
          1つのファイルの大きさは最大で50MB（メガバイト。ファイルの容量の単位です）までです。また、一度に選べるファイルは最大で20個までです。
        </p>
        <Callout type="tip" title="きれいな画像を使いましょう">
          文字がはっきり読める、明るくて鮮明な画像を使うと、採点のときに見くらべやすくなります。スキャナーで取り込むか、明るい場所で撮影したものをおすすめします。
        </Callout>
      </FocusSection>

      <FocusSection title="② ファイルを取り込む">
        <p>
          画面の上にある点線で囲まれた四角い枠が、ファイルの取り込み口です。ここにファイルを取り込む方法は2通りあります。
        </p>
        <p>
          1つめは、パソコンのファイルを枠の中へドラッグ＆ドロップ（マウスで file
          をつかんで枠の上まで運び、離す操作）する方法です。2つめは、枠の中の「ファイルを選択」ボタンを押して、開いた一覧から選ぶ方法です。枠のどこをクリックしてもファイル選択の画面が開きます。
        </p>
        <p>
          複数のファイルをまとめて選んで、一度に取り込むこともできます。取り込みが始まると、枠の中に進み具合を示すバー（横棒）とパーセント表示が出ます。表示が消えるまでお待ちください。
        </p>
        <Figure caption="ファイルを枠の中へドラッグ＆ドロップして取り込む様子">
          <DropZoneFigure />
        </Figure>
        <Callout type="note" title="取り込めなかったとき">
          対応していない種類のファイルや、大きさや個数の上限を超えたファイルを選ぶと、枠の下に赤い文字で理由が表示されます。文字の右にある×印を押すと、その表示を消せます。
        </Callout>
      </FocusSection>

      <FocusSection title="③ PDFは自動でページごとの画像になる">
        <p>
          PDFファイルを取り込むと、ページごとの画像へ自動的に変換されます。複数ページのPDFは、ページの枚数ぶんの画像に分かれて並びます。1ページずつに分ける手間はかかりません。
        </p>
        <Figure caption="1つのPDFが、ページごとの画像に分かれて並ぶ様子">
          <PdfConvertFigure />
        </Figure>
        <Callout type="note" title="パスワードつきのPDF">
          パスワードで保護されたPDFを取り込むと、パスワードの入力画面が表示されます。正しいパスワードを入力すると変換が進みます。間違っていると「パスワードが正しくありません」と表示されるので、入力し直してください。入力をやめると、そのファイルの取り込みは中止されます。
        </Callout>
      </FocusSection>

      <FocusSection title="④ 取り込んだページを確認する">
        <p>
          取り込みが終わると、画面の下に「模範解答」の一覧が表示されます。見出しには現在の合計ページ数が「模範解答（◯ページ）」のように出ます。一覧は横に長く並ぶため、ページ数が多いときは左右にスクロールして確認できます。
        </p>
        <p>
          それぞれのページには、左上から順に番号がついています。各ページにマウスのカーソルを重ねると、そのページを操作するためのボタンが現れます。
        </p>
      </FocusSection>

      <FocusSection title="⑤ ページの順番を整える">
        <p>
          採点では、ここで並んでいる順番がそのまま使われます。順番が正しくないときは、並べ替えて整えてください。
        </p>
        <p>
          順番を変えたいページにカーソルを重ねると、左右の矢印ボタンが現れます。左向きの矢印を押すとそのページが1つ前へ、右向きの矢印を押すと1つ後ろへ移動します。いちばん左のページはそれ以上左へ、いちばん右のページはそれ以上右へは動かせません。
        </p>
        <Figure caption="左右の矢印ボタンで、となり合うページの順番を入れ替える様子">
          <ReorderFigure />
        </Figure>
        <Callout type="tip" title="いらないページは削除できます">
          余分なページや間違って取り込んだページは、カーソルを重ねたときに現れるゴミ箱の形のボタンを押すと削除できます。削除や移動の処理中は、そのページに読み込み中のしるしが表示されます。
        </Callout>
      </FocusSection>

      <FocusSection title="⑥ 用紙サイズを設定する">
        <p>
          各ページにカーソルを重ねると、用紙サイズを選ぶ欄が現れます。
          <Pill>A3</Pill>
          <Pill>A4</Pill>
          <Pill>A5</Pill>
          <Pill>B4</Pill>
          <Pill>B5</Pill>
          の中から選べます。最初はA4が設定されています。
        </p>
        <p>
          この用紙サイズは、後の採点や結果の出力で、採点のしるしや書き込みを正しい大きさで表示するために使われます。実際の答案用紙の大きさに合わせて選んでおくと、ずれが起きにくくなります。
        </p>
      </FocusSection>

      <FocusSection title="⑦ 次のステップへ進む">
        <p>
          模範解答が1枚以上登録されると、画面の右上に「次へ:
          答案の採点領域作成」ボタンが表示されます。全てのページが正しい順番に並んでいることを確認してから、このボタンを押して次のステップへ進んでください。
        </p>
        <Callout type="success" title="自動で保存されます">
          取り込み・削除・並べ替え・用紙サイズの変更は、操作するたびに自動で保存されます。保存ボタンを押す必要はありません。次のステップへ進んだあとでも、このページに戻れば内容を直せます。
        </Callout>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="warning" title="画像が暗くて見にくいとき">
          取り込んだ画像が暗すぎたり、文字がぼやけていたりするときは、そのページを削除してから、スキャンし直すか、明るい場所で撮影し直したものを取り込み直してください。
        </Callout>
        <Callout type="tip" title="どのファイルか分かりやすくしたいとき">
          取り込む前に、ファイルの名前を「数学_第1回.pdf」のように内容が分かる名前にしておくと、複数のファイルを扱うときに迷いにくくなります。
        </Callout>
        <Callout type="note" title="操作をやり直したいとき">
          並べ替えや削除を間違えても、矢印ボタンで動かし直したり、もう一度ファイルを取り込み直したりして直せます。あわてず落ち着いて操作してください。なお、ファイル選択の画面では{" "}
          <Kbd>Esc</Kbd> を押すと選択をやめられます。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
