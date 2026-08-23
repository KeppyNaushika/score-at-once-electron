"use client"

import {
  ClipboardList,
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
 * 試験外成績資料（トップページ）の使い方。
 *
 * 一覧の読み方・押し方は4つのトップページで同じ。ここに固有なのは
 * 「試験ではない成績」を入れる場所だという説明と、成績算出から参照されること。
 */
export function HelpContentCourseworkList() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          試験外成績資料
        </h2>
        <p className="text-muted-foreground">
          小テスト・提出物・実技など、答案を採点しない成績をここに入れます。
          入れた点数は成績算出のデータソースとして呼び出せます。
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
            description="資料の概要ページへ移動します。チェックボックスと行末の「…」だけは別の役目です"
            isImportant
          />
          <StepItem
            number={2}
            title="名前の下は要約"
            description="説明・生徒数・評価項目数と、付いているタグが出ます"
          />
          <StepItem
            number={3}
            title="「次のステップ」を押すと続きから"
            description="生徒がまだなら生徒の登録へ、評価項目がまだならその設定へ、揃っていれば点数の入力へ進みます"
          />
          <StepItem
            number={4}
            title="見出しを押すと並べ替え"
            description="名前・実施日・更新日時で並べ替えられます。並び順は次に開いたときも覚えています"
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
              <Badge variant="outline">新規作成</Badge>
              <Badge variant="outline">.coursework 読み込み</Badge>
              <Badge variant="outline">.coursework 書き出し</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              「新規作成」を押すと、名前を訊かずに資料が1件できて概要ページが開きます。
              資料名・実施日・説明・タグはそこで直に書き換えます（打つそばから保存されます）。
            </p>
            <p className="text-sm text-muted-foreground">
              書き出しと削除は行末の「…」から行います。成績算出から参照されている資料は削除できません
              （どの成績算出が使っているかを知らせます）。
            </p>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Search className="h-5 w-5 text-blue-600" />}
          title="探す・まとめて操作する"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              検索欄は資料名・説明・タグ名・学級名を見ます。タグ・学級・実施日での絞り込みと合わせて使えます。
            </p>
            <p className="text-sm text-muted-foreground">
              チェックを付けると、選んだ資料へまとめてタグを付けられます。
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
