"use client"

import { FileBarChart, FileCheck, FileSpreadsheet } from "lucide-react"

import {
  Callout,
  Figure,
  FocusSection,
  HelpDoc,
  HelpHero,
  Pill,
} from "@/components/help/common/DocComponents"

// ============================================================================
// このページ専用の図解アニメーション（keyframe 名は help09 で始める）
// ============================================================================

const HELP09_KEYFRAMES = `
@keyframes help09CardCycle {
  0%, 6% {
    border-color: #3b82f6;
    box-shadow: 0 8px 18px -8px rgba(59, 130, 246, 0.55);
    transform: translateY(-3px);
  }
  28%, 100% {
    border-color: #e5e7eb;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transform: translateY(0);
  }
}
@keyframes help09IconCycle {
  0%, 6% { color: #2563eb; }
  28%, 100% { color: #9ca3af; }
}
@keyframes help09MarkPop {
  0%, 18% { opacity: 0; transform: scale(0.2) rotate(-8deg); }
  32% { opacity: 1; transform: scale(1.15) rotate(-8deg); }
  44%, 86% { opacity: 1; transform: scale(1) rotate(-8deg); }
  100% { opacity: 0; transform: scale(1) rotate(-8deg); }
}
@keyframes help09ScoreFade {
  0%, 52% { opacity: 0; transform: translateY(4px); }
  66%, 90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(4px); }
}
`

/** 3つの出力形式のカード。順番に1つずつ青く浮き上がる */
function OutputFormatCard({
  icon,
  label,
  sub,
  delay,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  delay: number
}) {
  return (
    <div
      aria-hidden
      className="flex w-28 flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-3 py-4 text-center"
      style={{ animation: `help09CardCycle 9s ${delay}s infinite` }}
    >
      <span
        className="text-gray-400"
        style={{ animation: `help09IconCycle 9s ${delay}s infinite` }}
      >
        {icon}
      </span>
      <span className="text-xs font-bold text-gray-800">{label}</span>
      <span className="text-[10px] text-gray-500">{sub}</span>
    </div>
  )
}

/** 出力できる3形式を並べた図 */
function OutputFormatsFigure() {
  return (
    <div
      aria-hidden
      className="flex flex-wrap items-stretch justify-center gap-3"
    >
      <OutputFormatCard
        icon={<FileCheck className="h-7 w-7" />}
        label="採点済み答案PDF"
        sub="生徒に返す"
        delay={0}
      />
      <OutputFormatCard
        icon={<FileSpreadsheet className="h-7 w-7" />}
        label="採点データExcel"
        sub="集計・管理"
        delay={3}
      />
      <OutputFormatCard
        icon={<FileBarChart className="h-7 w-7" />}
        label="個人成績表PDF"
        sub="一人ずつ配る"
        delay={6}
      />
    </div>
  )
}

/** 採点マークが答案に重なって現れる行（記号がポップして表示される） */
const HELP08_SHEET_ROWS = [
  { label: "問1", answer: "12", mark: "○", color: "#16a34a", delay: 0 },
  { label: "問2", answer: "9", mark: "△", color: "#d97706", delay: 0.6 },
  { label: "問3", answer: "6", mark: "✕", color: "#dc2626", delay: 1.2 },
]

/** 答案の上に採点マーク（○△✕）と点数が重なって表示される様子の図 */
function GradedMarksFigure() {
  return (
    <div
      aria-hidden
      className="w-64 rounded-md border border-gray-300 bg-white px-4 py-3 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-1.5">
        <span className="text-[11px] font-medium text-gray-600">
          {"算数　答案用紙"}
        </span>
        <span
          className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-700"
          style={{ animation: "help09ScoreFade 6s infinite" }}
        >
          合計 14 点
        </span>
      </div>
      <div className="space-y-3">
        {HELP08_SHEET_ROWS.map((row) => (
          <div key={row.label} className="relative flex items-center gap-3">
            <span className="w-7 shrink-0 text-[10px] text-gray-400">
              {row.label}
            </span>
            <span
              className="text-2xl text-blue-900/80"
              style={{ fontFamily: "cursive" }}
            >
              {row.answer}
            </span>
            <span
              className="pointer-events-none absolute left-7 text-4xl leading-none"
              style={{
                color: row.color,
                animation: `help09MarkPop 6s ${row.delay}s infinite`,
              }}
            >
              {row.mark}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * ステップ9「結果出力」の使い方ガイド。
 * 実機能（ExportMainView / ExportOptionsCard / StudentSelectionCard /
 * ScoringMarkSettings / IndividualReportSettings / ExportWarningModal /
 * ReturnDiffPanel）に基づき、3種類の出力と設定・プレビュー・再印刷を説明する。
 */
export function HelpContent09Export() {
  return (
    <HelpDoc>
      <style>{HELP09_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 9 / 出力"
        title="採点結果をファイルに出力する"
        lead="採点が終わったら、その結果をファイルにまとめて保存します。生徒に返すための採点済み答案PDF、成績をまとめたExcel、生徒ごとの個人成績表PDFの3種類を作れます。最後のステップです。"
      />

      <FocusSection title="① 出力する生徒を選ぶ">
        <p>
          画面は左右に分かれています。左側が「生徒選択」、右側が「出力の設定」です。まずは左側で、ファイルに含めたい生徒を選びます。生徒の名前の左にあるチェックボックス（四角い印）をクリックすると、その生徒が選ばれます。
        </p>
        <p>
          生徒がたくさんいるときは、上の「名前または学籍番号で検索」の欄に文字を入れると、一覧をしぼり込めます。さらに、その下のボタンで次のように絞り込めます。
        </p>
        <p className="flex flex-wrap gap-2">
          <Pill>学級で絞り込む</Pill>
          <Pill>受験</Pill>
          <Pill>見込</Pill>
          <Pill>欠席</Pill>
        </p>
        <p>
          「全選択」を押すと、いま表示されている生徒をまとめて選べます。「全解除」を押すと、表示されている生徒の選択をまとめて外せます。一覧の右上には「◯人選択中
          / ◯人表示中」と出るので、何人を選んでいるかを確認できます。
        </p>
        <Callout type="tip" title="まず生徒を選びましょう">
          生徒を1人も選んでいないと、ダウンロードのボタンは押せません。出力したい生徒にチェックを入れてから、右側の操作に進んでください。
        </Callout>
      </FocusSection>

      <FocusSection title="② 出力する形式を選ぶ">
        <p>
          右側の上部に、出力できる3つの形式がタブ（切り替えの見出し）で並んでいます。作りたいファイルのタブを選んでください。
        </p>
        <p className="flex flex-wrap gap-2">
          <Pill>採点済み答案PDF</Pill>
          <Pill>採点データExcel</Pill>
          <Pill>個人成績表PDF</Pill>
        </p>
        <p>
          それぞれの中身は次のとおりです。「採点済み答案PDF」は、生徒の答案に採点のしるしや点数を重ねたPDFで、生徒に返すときに使います。「採点データExcel」は、点数や正誤を一覧にまとめた表で、成績の管理や集計に使います。「個人成績表PDF」は、生徒一人ひとりの成績を1枚にまとめたもので、生徒や保護者へ配るときに使います。
        </p>
        <Figure caption="出力できる3つの形式。用途に合わせて使い分けます。">
          <OutputFormatsFigure />
        </Figure>
        <Callout type="note" title="タブを切り替えても選んだ生徒はそのままです">
          形式のタブを切り替えても、左側で選んだ生徒はそのまま引き継がれます。同じ生徒で複数の形式を順番に出力できます。
        </Callout>
      </FocusSection>

      <FocusSection title="③ 採点済み答案PDFを作る">
        <p>
          「採点済み答案PDF」のタブでは、いちばん上の「採点済み答案PDFをダウンロード」ボタンで出力を始めます。ボタンを押すと保存先を選ぶ画面が開くので、ファイルを置く場所と名前を決めてください。
        </p>
        <p>その下では、次の設定を調整できます。</p>
        <p>
          <strong>用紙の向き</strong>は、
          <Pill>A4縦（ポートレート）</Pill>
          <Pill>A4横（ランドスケープ）</Pill>
          のどちらかを選べます。答案用紙の形に合わせて選んでください。
        </p>
        <p>
          <strong>並列処理数</strong>
          は、出力をどれくらい同時に進めるかの設定です。1から8まで選べ、数を大きくすると出力が速くなりますが、パソコンが使うメモリ（一時的な作業領域）は増えます。動作が重く感じるときは小さめにしてください。
        </p>
        <p>
          <strong>採点マーク設定</strong>
          では、答案に重ねる採点のしるしや点数の見た目を細かく決められます。「採点マーク表示対象」「点数表示対象」では、正解・不正解・部分点・保留・無答などの採点の種類ごとに、しるしや点数を表示するかどうかを選べます。さらに、採点マーク・設問の部分点・小計点・合計点のそれぞれについて、色・不透明度（濃さ）・位置・上下左右のずれ・大きさを調整できます。設定を初めの状態に戻したいときは「デフォルトに戻す」を押してください。
        </p>
        <Figure caption="生徒の答案の上に、採点マーク（○△✕）と点数が重なって表示されます。">
          <GradedMarksFigure />
        </Figure>
        <Callout type="tip" title="不透明度で見やすさを調整できます">
          採点マークの不透明度を下げると下の答案が透けて見やすくなり、上げると採点結果がはっきりします。返却用か確認用かなど、用途に合わせて調整してください。
        </Callout>
      </FocusSection>

      <FocusSection title="④ 採点データExcelを作る">
        <p>
          「採点データExcel」のタブでは、「採点データExcelをダウンロード」ボタンを押すだけで出力できます。このExcelには、設問ごとの得点や正誤、合計点などがまとまった表が入ります。
        </p>
        <p>
          このタブには細かい設定はありません。出力が終わると、保存された場所がメッセージで表示されます。
        </p>
      </FocusSection>

      <FocusSection title="⑤ 個人成績表PDFを作る">
        <p>
          「個人成績表PDF」のタブでは、生徒一人ひとりの成績をまとめた成績表を作れます。「個人成績表PDFをダウンロード」ボタンを押すと印刷の画面が開くので、そこからPDFとして保存したり、印刷したりできます。
        </p>
        <p>
          下の設定パネルで、成績表に載せる項目を選べます。主なものは次のとおりです。
        </p>
        <p>
          <strong>基本表示・統計情報</strong>
          では、点数・学級平均・全体平均・偏差値・学級順位・全体順位を表示するかどうかを選べます。あわせて、平均や順位を計算するときに受験・見込・欠席のどの生徒を含めるかも指定できます。
        </p>
        <p>
          <strong>小計点関連</strong>
          では、設問をまとめた小計点の表や、得点の散らばりを示す箱ひげ図（はこひげず。点数の分布を箱と線で表したグラフ）を表示できます。
        </p>
        <p>
          <strong>設問関連</strong>
          では、設問ごとの結果をまとめた表（マルバツ・正答率・得点率の表示も選べます）や、復習に役立つ学習アドバイスを載せられます。
        </p>
        <p>
          <strong>行政要素</strong>
          では、手書きで書き込むためのコメント欄や、署名・押印欄を付けられます。
        </p>
        <Callout type="tip" title="プレビューで仕上がりを確かめましょう">
          設定を変えるたびに、左側の「プレビュー」タブで仕上がりの見た目がすぐ変わります。配る前に、必要な項目がそろっているか確認しておくと安心です。
        </Callout>
      </FocusSection>

      <FocusSection title="⑥ 出来上がりをプレビューで確認する">
        <p>
          左側には「生徒選択」と「プレビュー」の2つのタブがあります。「プレビュー」タブに切り替えると、いま選んでいる形式の出来上がりを、出力する前に画面で確かめられます。
        </p>
        <p>
          「採点済み答案PDF」と「個人成績表PDF」では、プレビューの上の「生徒」欄から、確認したい生徒を選んで切り替えられます。「採点データExcel」では、出力されるExcelの表の内容を確認できます。本番のファイルを作る前にここで見ておくと、設定の間違いに気づきやすくなります。
        </p>
      </FocusSection>

      <FocusSection title="⑦ 出力前のチェックと警告に気をつける">
        <p>
          ダウンロードのボタンを押すと、出力の前に採点内容が自動でチェックされます。気をつけたほうがよい点が見つかると、「警告」の画面が表示されます。表示されるのは、次のような場合です。
        </p>
        <p className="flex flex-wrap gap-2">
          <Pill>採点データがない</Pill>
          <Pill>未採点のまま</Pill>
          <Pill>採点者どうしで結果が食い違っている</Pill>
          <Pill>部分点が未入力</Pill>
        </p>
        <p>
          採点者どうしで結果が食い違っている設問は、未採点として出力されます。「8.
          採点確定」のページで、試験の所有者が結果を確定してください。警告の画面では、「キャンセル」を押していったん戻り採点を直すか、「警告を無視して続行」を押してそのまま出力するかを選べます。
        </p>
        <Callout type="warning" title="気になる点は直してから出力しましょう">
          警告が出たまま出力すると、その部分は正しく表示されないことがあります。急ぎでなければ、採点画面に戻って直してから出力するのが安心です。
        </Callout>
      </FocusSection>

      <FocusSection title="⑧ 返却した後の修正だけを再印刷する">
        <p>
          画面のいちばん上にある「答案返却・差分」のパネルでは、答案を返した後に採点を直したぶんだけを、効率よく印刷し直せます。
        </p>
        <p>
          まず、生徒を選んだ状態で「選択中の◯名を返却版として記録」を押すと、いまの採点内容が「返却版」として記録されます。これは、生徒に返したときの状態を覚えておくための記録です。
        </p>
        <p>
          その後で採点（点数や採点マーク）を直すと、このパネルが、返却版から変わった生徒を見つけてくれます。「変更があった生徒のみ選択」を押すと、直した生徒だけがまとめて選ばれるので、その生徒のぶんだけを出力し直せます。「変更内容を表示」を押すと、誰のどの設問がどう変わったかも確認できます。
        </p>
        <Callout type="note" title="最初は記録がありません">
          まだ一度も「返却版として記録」をしていないときは、差分は表示されません。返却のたびに記録しておくと、次に直したぶんだけを取り出せるようになります。
        </Callout>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="warning" title="ダウンロードのボタンが押せないとき">
          生徒を1人も選んでいないと、ボタンは押せません。左側で出力したい生徒にチェックを入れてから、もう一度試してください。
        </Callout>
        <Callout type="note" title="出力に時間がかかるとき">
          生徒の数が多いと、出力に時間がかかります。とくに採点済み答案PDFでは、進み具合を示す画面が表示されるので、終わるまでお待ちください。動作が重いときは、採点済み答案PDFの「並列処理数」を小さくすると安定することがあります。
        </Callout>
        <Callout type="success" title="何度でも作り直せます">
          出力したファイルの見た目が思っていたものと違っても、設定を変えて作り直せます。採点マークの色や位置、成績表に載せる項目などを調整しながら、納得のいくものを作ってください。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
