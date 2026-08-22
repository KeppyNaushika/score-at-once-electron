"use client"

import {
  BarChart3,
  FolderInput,
  Lightbulb,
  MousePointerClick,
  Search,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

/**
 * 成績算出（トップページ）の使い方。
 *
 * 一覧の読み方・押し方は4つのトップページで同じ。ここに固有なのは
 * 「試験と資料の点数を集めて評定にする」場所だという説明。
 */
export function HelpContentGradeList() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          成績算出
        </h2>
        <p className="text-muted-foreground">
          試験と試験外成績資料の点数を集めて、観点別評価や評定を出します。
          学期や年度など、成績を出す単位ごとに1つ作ります。
        </p>
      </div>

      <HelpSection
        icon={<MousePointerClick className="h-5 w-5 text-green-600" />}
        title="一覧の読み方・押し方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="行のどこを押しても概要が開く"
            description="成績算出の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
            isImportant
          />
          <StepItem
            number={2}
            title="名前の下は要約"
            description="対象の学級・生徒数・評価項目数と、付いているタグが出ます"
          />
          <StepItem
            number={3}
            title="「次のステップ」を押すと続きから"
            description="生徒・データソース・外部成績・成績境界のうち、まだ埋まっていない段を指します"
          />
          <StepItem
            number={4}
            title="見出しを押すと並べ替え"
            description="名前・成績算出日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FolderInput className="h-5 w-5 text-purple-600" />}
          title="作る・複製する・読み込む"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">新規作成</Badge>
              <Badge variant="outline">複製</Badge>
              <Badge variant="outline">.grade 読み込み</Badge>
              <Badge variant="outline">.grade 書き出し</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              前の学期と同じ作りで出すときは、行末の「…」から「複製」を選ぶと設定ごと写せます。
            </p>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Search className="h-5 w-5 text-blue-600" />}
          title="探す・まとめて操作する"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              検索欄は名前・説明・学級名・タグ名を見ます。タグ・学級・成績算出日での絞り込みと合わせて使えます。
            </p>
            <p className="text-sm text-muted-foreground">
              チェックを付けると、選んだ成績算出へまとめてタグを付けられます。
            </p>
          </div>
        </HelpSection>
      </div>

      <TipItem type="info">
        <span className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          「成績算出日」は、その成績がいつのものかを表す日付です。どの生徒がその学級に在籍していたかの判定にも使われます。
        </span>
      </TipItem>
    </div>
  )
}
