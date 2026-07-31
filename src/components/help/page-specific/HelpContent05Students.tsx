"use client"

import { GripVertical, UserCheck, Users, UserX } from "lucide-react"

import {
  Callout,
  Figure,
  FocusSection,
  HelpDoc,
  HelpHero,
  Pill,
} from "@/components/help/common/DocComponents"

// ============================================================================
// このページ専用の図解アニメーション（CSS キーフレーム）
// keyframe名は help05 で始める。装飾用の図なので aria-hidden を付ける。
// ============================================================================

const HELP05_KEYFRAMES = `
/* 学級チップが選ばれて青く強調される */
@keyframes help05Pick {
  0%, 100% { background-color: #ffffff; border-color: #e5e7eb; color: #374151; }
  10%, 82% { background-color: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
}
/* 生徒の行が上から1つずつまとめて現れる */
@keyframes help05RowIn {
  0% { opacity: 0; transform: translateY(-6px); }
  14% { opacity: 1; transform: translateY(0); }
  88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(0); }
}
/* 受験状態（受験・見込・欠席）が順番に選ばれてバッジの色が変わる。
   非選択は白地・灰枠・灰文字、選択中は各色で塗りつぶし＋白文字。 */
@keyframes help05StatRecv {
  0%, 30% { background-color: #059669; border-color: #059669; color: #ffffff; }
  34%, 100% { background-color: #ffffff; border-color: #d1d5db; color: #6b7280; }
}
@keyframes help05StatExp {
  0%, 30% { background-color: #ffffff; border-color: #d1d5db; color: #6b7280; }
  34%, 63% { background-color: #475569; border-color: #475569; color: #ffffff; }
  67%, 100% { background-color: #ffffff; border-color: #d1d5db; color: #6b7280; }
}
@keyframes help05StatAbs {
  0%, 63% { background-color: #ffffff; border-color: #d1d5db; color: #6b7280; }
  67%, 96% { background-color: #e11d48; border-color: #e11d48; color: #ffffff; }
  100% { background-color: #ffffff; border-color: #d1d5db; color: #6b7280; }
}
/* ドラッグでの並べ替え：2つの行が上下に入れ替わる */
@keyframes help05SwapDown {
  0%, 12% { transform: translateY(0); }
  44%, 100% { transform: translateY(36px); }
}
@keyframes help05SwapUp {
  0%, 12% { transform: translateY(36px); }
  44%, 100% { transform: translateY(0); }
}
`

/** 学級を選ぶと、その学級の生徒の行がまとめて追加される様子 */
function ClassroomAddFigure() {
  const rows = [
    { no: "1", name: "佐藤 花子" },
    { no: "2", name: "鈴木 一郎" },
    { no: "3", name: "高橋 さくら" },
    { no: "4", name: "田中 大輔" },
  ]
  return (
    <div aria-hidden className="w-full max-w-xs space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium"
          style={{ animation: "help05Pick 5s infinite" }}
        >
          <Users className="h-4 w-4" />
          1年A組
        </span>
        <span className="text-gray-400">→</span>
        <span className="text-xs text-gray-500">まとめて追加</span>
      </div>
      <div className="space-y-1.5 rounded-lg border border-gray-200 bg-white p-2">
        {rows.map((row, i) => (
          <div
            key={row.no}
            className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-700"
            style={{
              opacity: 0,
              animation: `help05RowIn 5s ${0.3 + i * 0.35}s infinite`,
            }}
          >
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="w-5 text-gray-400">{row.no}</span>
            <span>{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 受験状態（受験・見込・欠席）を切り替えると、選んだバッジの色が変わる様子 */
function StatusToggleFigure() {
  return (
    <div
      aria-hidden
      className="flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
    >
      <span className="text-sm font-medium text-gray-700">佐藤 花子</span>
      <div className="flex gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
          style={{ animation: "help05StatRecv 6s infinite" }}
        >
          <UserCheck className="h-3 w-3" />
          受験
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
          style={{ animation: "help05StatExp 6s infinite" }}
        >
          <Users className="h-3 w-3" />
          見込
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
          style={{ animation: "help05StatAbs 6s infinite" }}
        >
          <UserX className="h-3 w-3" />
          欠席
        </span>
      </div>
    </div>
  )
}

/** 生徒の行をドラッグして並べ替える様子（2行が上下に入れ替わる） */
function ReorderFigure() {
  const row =
    "absolute inset-x-0 top-0 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm"
  return (
    <div aria-hidden className="relative h-18 w-full max-w-xs">
      <div className={row} style={{ animation: "help05SwapDown 4s infinite" }}>
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="w-5 text-gray-400">1</span>
        <span>鈴木 一郎</span>
      </div>
      <div className={row} style={{ animation: "help05SwapUp 4s infinite" }}>
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="w-5 text-gray-400">2</span>
        <span>佐藤 花子</span>
      </div>
    </div>
  )
}

export function HelpContent05Students() {
  return (
    <HelpDoc>
      <style>{HELP05_KEYFRAMES}</style>
      <HelpHero
        eyebrow="ステップ 5 / 受験生徒"
        title="受験する生徒を登録する"
        lead="この試験を受ける生徒を登録して、一人ひとりの受験状態（受験・見込・欠席）を設定するステップです。学級ごとにまとめて追加することも、生徒を個別に選んで追加することもできます。"
      />

      <FocusSection title="① 画面の構成を知る">
        <p>
          画面の上部には2つのタブがあります。ふだんは「受験生徒一覧」タブで生徒の追加や受験状態の設定を行い、「学級の関連付け」タブで成績表や統計に使う学級の設定を行います。
        </p>
        <p>
          画面の右上には、登録済みの生徒数が「総生徒数」「受験者」「見込受験」「欠席者」に分けて表示されます。登録の状況をひと目で確認できます。
        </p>
        <Callout type="note" title="次のステップへ進むには">
          画面の右上にある「次へ:
          生徒答案の追加と関連付け」ボタンを押すと、次のステップ（生徒答案の管理）へ進みます。
        </Callout>
      </FocusSection>

      <FocusSection title="② 生徒を追加する">
        <p>
          「受験生徒一覧」タブで右上の「生徒を追加」ボタンを押すと、追加用の画面が開きます。この画面には2つの追加方法が用意されています。
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill>学級で追加</Pill>
          <Pill>個別で追加</Pill>
        </div>
        <p>
          「学級で追加」では、学級を選ぶとその学級の生徒をまとめて登録できます。複数の学級を選んだときは、追加する順序も並べ替えて決められます。一度にたくさんの生徒を登録したいときに便利です。
        </p>
        <Figure caption="学級を選ぶと、その学級の生徒がまとめて一覧に追加されます。">
          <ClassroomAddFigure />
        </Figure>
        <p>
          「個別で追加」では、名前・ふりがな・学籍番号で生徒を検索し、必要な生徒だけを選んで登録できます。学級でしぼり込むこともできます。
        </p>
        <Callout type="tip" title="「在籍中の生徒のみ表示」スイッチ">
          どちらの方法にも「在籍中の生徒のみ表示」スイッチがあり、最初はオンになっています。オンのままにしておくと、今その学級に在籍している生徒だけが候補に出ます。過去に在籍していた生徒なども含めて表示したいときは、スイッチをオフにしてください。
        </Callout>
      </FocusSection>

      <FocusSection title="③ 受験状態を設定する">
        <p>
          一覧の各生徒の行には、受験状態を切り替えるボタンが3つ並んでいます。生徒の状況に合わせて、いずれかを押して設定してください。今選ばれている状態のボタンには色が付きます。
        </p>
        <Figure caption="ボタンを押すと受験状態が切り替わり、選んだ状態のバッジに色が付きます。">
          <StatusToggleFigure />
        </Figure>
        <div className="space-y-3">
          <div className="border-l-4 border-emerald-500 pl-3">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <UserCheck className="h-4 w-4" />
              受験
            </h4>
            <p className="text-sm text-gray-600">
              実際に試験を受けた、採点の対象となる生徒です。ふつうはこの状態を選びます。
            </p>
          </div>
          <div className="border-l-4 border-slate-400 pl-3">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Users className="h-4 w-4" />
              見込
            </h4>
            <p className="text-sm text-gray-600">
              受験する見込みだが、まだ確定していない生徒に使う暫定的な状態です。
            </p>
          </div>
          <div className="border-l-4 border-rose-500 pl-3">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-rose-700">
              <UserX className="h-4 w-4" />
              欠席
            </h4>
            <p className="text-sm text-gray-600">
              試験を受けなかった生徒です。欠席に設定しておくと、次のステップ（生徒答案の管理）の表で自動的に無効になり、誤って答案を割り当てるのを防げます。
            </p>
          </div>
        </div>
        <Callout type="tip" title="状態でしぼり込めます">
          一覧の上にある受験状態のしぼり込みメニューで「受験」「見込」「欠席」を選ぶと、その状態の生徒だけを表示できます。「すべての受験状態」を選ぶと元に戻ります。名前・ふりがな・学籍番号での検索や、学級でのしぼり込みも一緒に使えます。
        </Callout>
      </FocusSection>

      <FocusSection title="④ 並び順を整える">
        <p>
          生徒の行はマウスでドラッグして並べ替えられます。ここで決めた並び順は、このあとの採点や出力での表示順になります。
        </p>
        <Figure caption="左端のつまみをドラッグすると、生徒の行を上下に入れ替えられます。">
          <ReorderFigure />
        </Figure>
        <p>
          手動で並べ替えた順番を元に戻したいときは、「並び順をリセット」ボタンを押します。学級の関連付けの順番、そして学級内の出席番号の順に、自動で並び直されます。
        </p>
      </FocusSection>

      <FocusSection title="⑤ 学級を関連付ける">
        <p>
          「学級の関連付け」タブでは、成績表の表示や統計の集計に使う学級を管理します。生徒の追加そのものは「生徒を追加」ボタンから行うため、このタブは集計のための設定が中心です。
        </p>
        <p>
          「学級を追加」ボタンで学級を関連付けると、一覧に学級が並びます。各学級には次の2つのチェックがあり、必要に応じて切り替えられます。
        </p>
        <div className="space-y-3">
          <div className="border-l-4 border-blue-500 pl-3">
            <h4 className="text-sm font-bold text-blue-700">学級表示</h4>
            <p className="text-sm text-gray-600">
              その学級を成績表などの表示の対象にするかどうかを決めます。
            </p>
          </div>
          <div className="border-l-4 border-violet-500 pl-3">
            <h4 className="text-sm font-bold text-violet-700">統計集計</h4>
            <p className="text-sm text-gray-600">
              その学級を統計の集計の対象に含めるかどうかを決めます。
            </p>
          </div>
        </div>
        <p>
          学級の行はドラッグで並べ替えでき、ごみ箱のアイコンで関連付けを解除できます。
        </p>
      </FocusSection>

      <FocusSection title="⑥ 生徒を削除する">
        <p>
          試験から外したい生徒がいるときは、各行の左にあるチェックボックスで生徒を選びます。1人だけでも、複数まとめてでも選べます。選ぶと右上に「選択した生徒を削除」ボタンが現れるので、それを押します。
        </p>
        <p>
          確認画面が表示され、削除する生徒の一覧を確認してから「削除する」を押すと削除されます。
        </p>
        <Callout type="warning" title="採点データがある生徒の削除に注意">
          すでに採点データがある生徒を削除しようとすると、確認画面に警告が表示されます。生徒を削除すると、その生徒の答案シート・採点結果やコメント・設問別の得点・最終成績も一緒に削除され、元に戻すことはできません。本当に削除してよいかを必ず確認してください。
        </Callout>
      </FocusSection>

      <FocusSection title="困ったときは">
        <Callout type="success" title="まとめて登録したい・候補に出ない">
          一度にたくさんの生徒を登録したいときは「生徒を追加」から「学級で追加」を選び、学級ごとにまとめて登録してください。追加したい生徒が候補に出てこないときは、「在籍中の生徒のみ表示」スイッチをオフにすると、在籍していない生徒も表示できます。
        </Callout>
        <Callout type="tip" title="欠席が分かっている生徒は先に設定を">
          欠席が分かっている生徒は、先に「欠席」に設定しておくと安心です。次のステップの答案管理で自動的に無効になり、その生徒に誤って答案を割り当てるのを防げます。
        </Callout>
      </FocusSection>
    </HelpDoc>
  )
}
