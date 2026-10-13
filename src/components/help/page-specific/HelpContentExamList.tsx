"use client"

import { FolderInput, PencilSparkles, Search } from "lucide-react"

import { ArchiveImportFormatsNote } from "@/components/help/common/ArchiveImportFormatsNote"
import { HelpSection } from "@/components/help/common/HelpComponents"
import {
  ListActionBadges,
  ListHelpHeader,
  ListHelpTip,
  ListReadingSteps,
} from "@/components/help/common/ListPageHelp"

/**
 * 試験一覧（トップページ）の使い方。
 *
 * 一覧の読み方・押し方は4つのトップページ（試験・解答用紙・試験外成績資料・
 * 成績算出）で同じなので、書き方も揃えてある。違うのは扱う実体と、
 * 名前の下に出る要約・「次のステップ」の中身だけ。
 */
export function HelpContentExamList() {
  return (
    <div className="space-y-6">
      <ListHelpHeader
        icon={<PencilSparkles className="h-6 w-6 text-blue-600" />}
        title="試験"
      >
        採点する試験の一覧です。ここから試験を作り、8つの段を順に進めます。
      </ListHelpHeader>

      <ListReadingSteps
        overviewDescription="試験の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
        summaryTitle="名前の下は要約"
        summaryDescription="説明と、その試験に付いているタグが出ます"
        nextStepDescription="いま何をすべき段なのかを試験ごとに判定して出しています。押すとその段へ直行します"
        sortDescription="名前・試験日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
      />

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FolderInput className="h-5 w-5 text-purple-600" />}
          title="作る・取り込む"
        >
          <div className="space-y-3">
            <ListActionBadges
              labels={["新規作成", "取り込み", ".sao 書き出し"]}
            />
            <p className="text-sm text-muted-foreground">
              「新規作成」を押すと、名前を訊かずに試験が1件できて概要ページが開きます。
              試験名・試験日・説明・タグはそこで直に書き換えます（打つそばから保存されます）。
            </p>
            <p className="text-sm text-muted-foreground">
              別のPCで作った試験は「取り込み」から取り込めます
              <ArchiveImportFormatsNote legacyFormats=".score や外部の .hsz・.dat" />
              。書き出しは行末の「…」から1件ずつ、チェックを付ければまとめて
              .sao に書き出せます。
            </p>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Search className="h-5 w-5 text-blue-600" />}
          title="探す・まとめて操作する"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              検索欄は試験名・説明・タグ名を見ます。タグでの絞り込みと合わせて使えます。
            </p>
            <p className="text-sm text-muted-foreground">
              チェックを付けると、選んだ試験へまとめてタグを付けたり、まとめて書き出したりできます。
            </p>
          </div>
        </HelpSection>
      </div>

      <ListHelpTip>
        窓が狭いとボタンは右端の「…」へ畳まれます。畳まれても中身は同じで、検索欄だけは最後まで残ります。
      </ListHelpTip>
    </div>
  )
}
