"use client"

import {
  FileEdit,
  FolderInput,
  Lightbulb,
  MousePointerClick,
  Search,
  UserRoundCog,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

/**
 * 解答用紙作成（トップページ）の使い方。
 *
 * 一覧の読み方・押し方は4つのトップページで同じ。ここに固有なのは
 * 「担当」（編集できるのはひとりだけ）と、名前の下に出る用紙の要約。
 */
export function HelpContentAnswerSheetList() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <FileEdit className="h-6 w-6 text-blue-600" />
          解答用紙作成
        </h2>
        <p className="text-muted-foreground">
          印刷して配る解答用紙を作ります。作った用紙は書き出して他の端末へ渡せます。
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
            description="解答用紙の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
            isImportant
          />
          <StepItem
            number={2}
            title="名前の下は用紙の要約"
            description="用紙サイズ・向き・設問数・合計配点・担当が並びます"
          />
          <StepItem
            number={3}
            title="「次のステップ」を押すと続きから"
            description="設問がまだ無ければ作成へ、あれば書き出しへ進みます"
          />
          <StepItem
            number={4}
            title="見出しを押すと並べ替え"
            description="名前・使用日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<UserRoundCog className="h-5 w-5 text-orange-600" />}
          title="担当（編集できる人）"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              1つの解答用紙を編集できるのは担当者ひとりだけです。閲覧と書き出しは誰でもできます。
            </p>
            <p className="text-sm text-muted-foreground">
              他の人に直してもらうときは、行末の「…」から「担当を渡す」を選びます。
              「全員の解答用紙を表示」を外すと、自分が担当のものだけが並びます。
            </p>
          </div>
        </HelpSection>

        <HelpSection
          icon={<FolderInput className="h-5 w-5 text-purple-600" />}
          title="作る・読み込む"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">新規作成</Badge>
              <Badge variant="outline">.asb 読み込み</Badge>
              <Badge variant="outline">.asb 書き出し</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              書き出しと複製は行末の「…」から行います。
            </p>
          </div>
        </HelpSection>
      </div>

      <HelpSection
        icon={<Search className="h-5 w-5 text-blue-600" />}
        title="探す・まとめて操作する"
      >
        <p className="text-sm text-muted-foreground">
          検索欄は名前・説明・タグ名を見ます。チェックを付けると、選んだ解答用紙へまとめてタグを付けられます
          （担当でないものは選べません）。
        </p>
      </HelpSection>

      <TipItem type="info">
        <span className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          窓が狭いとボタンは右端の「…」へ畳まれます。畳まれても中身は同じで、検索欄だけは最後まで残ります。
        </span>
      </TipItem>
    </div>
  )
}
