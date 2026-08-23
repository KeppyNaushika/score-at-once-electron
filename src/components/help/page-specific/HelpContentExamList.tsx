"use client"

import {
  FolderInput,
  Lightbulb,
  MousePointerClick,
  PencilSparkles,
  Search,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

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
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <PencilSparkles className="h-6 w-6 text-blue-600" />
          試験一覧
        </h2>
        <p className="text-muted-foreground">
          採点する試験の一覧です。ここから試験を作り、8つの段を順に進めます。
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
            description="試験の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
            isImportant
          />
          <StepItem
            number={2}
            title="名前の下は要約"
            description="説明と、その試験に付いているタグが出ます"
          />
          <StepItem
            number={3}
            title="「次のステップ」を押すと続きから"
            description="いま何をすべき段なのかを試験ごとに判定して出しています。押すとその段へ直行します"
          />
          <StepItem
            number={4}
            title="見出しを押すと並べ替え"
            description="名前・試験日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FolderInput className="h-5 w-5 text-purple-600" />}
          title="作る・読み込む"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">新規試験作成</Badge>
              <Badge variant="outline">.score 読み込み</Badge>
              <Badge variant="outline">.score 書き出し</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              「新規試験作成」を押すと、名前を訊かずに試験が1件できて概要ページが開きます。
              試験名・試験日・説明・タグはそこで直に書き換えます（打つそばから保存されます）。
            </p>
            <p className="text-sm text-muted-foreground">
              別の端末で作った試験は「.score
              読み込み」で取り込めます。書き出しは行末の「…」から1件ずつ、
              チェックを付ければまとめて書き出せます。
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

      <TipItem type="info">
        <span className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          窓が狭いとボタンは右端の「…」へ畳まれます。畳まれても中身は同じで、検索欄だけは最後まで残ります。
        </span>
      </TipItem>
    </div>
  )
}
