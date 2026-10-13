"use client"

import { ChartColumn, FolderInput, Search } from "lucide-react"

import { ArchiveImportFormatsNote } from "@/components/help/common/ArchiveImportFormatsNote"
import { HelpSection } from "@/components/help/common/HelpComponents"
import {
  ListActionBadges,
  ListHelpHeader,
  ListHelpTip,
  ListReadingSteps,
} from "@/components/help/common/ListPageHelp"

/**
 * 成績算出（トップページ）の使い方。
 *
 * 一覧の読み方・押し方は4つのトップページで同じ。ここに固有なのは
 * 「試験と資料の得点を集めて評定にする」場所だという説明。
 */
export function HelpContentGradeList() {
  return (
    <div className="space-y-6">
      <ListHelpHeader
        icon={<ChartColumn className="h-6 w-6 text-blue-600" />}
        title="成績算出"
      >
        試験と試験外成績資料の得点を集めて、観点別評価や評定を出します。
        学期や年度など、成績を出す単位ごとに1つ作ります。
      </ListHelpHeader>

      <ListReadingSteps
        overviewDescription="成績算出の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
        summaryTitle="名前の下は要約"
        summaryDescription="対象の学級・生徒数・成績評価項目数と、付いているタグが出ます"
        nextStepDescription="生徒・成績評価項目・成績境界のうち、まだ埋まっていない段を指します"
        sortDescription="名前・成績算出日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
      />

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FolderInput className="h-5 w-5 text-purple-600" />}
          title="作る・複製する・取り込む"
        >
          <div className="space-y-3">
            <ListActionBadges
              labels={["新規作成", "複製", "取り込み", ".sao 書き出し"]}
            />
            <p className="text-sm text-muted-foreground">
              「新規作成」を押すと、名前を訊かずに成績算出が1件できて概要ページが開きます。
              名前・成績算出日・説明・タグはそこで直に書き換えます（打つそばから保存されます）。
            </p>
            <p className="text-sm text-muted-foreground">
              前の学期と同じ作りで出すときは、行末の「…」から「複製」を選ぶと設定ごと写せます。
            </p>
            <p className="text-sm text-muted-foreground">
              別のPCで作った成績算出は「取り込み」から取り込めます
              <ArchiveImportFormatsNote legacyFormats=".grade" />
              。書き出しは行末の「…」から行います。
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

      <ListHelpTip>
        「成績算出日」は、その成績がいつのものかを表す日付です。どの生徒がその学級に在籍していたかの判定にも使われます。
      </ListHelpTip>
    </div>
  )
}
