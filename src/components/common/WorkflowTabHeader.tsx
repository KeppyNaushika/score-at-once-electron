"use client"

import { List } from "lucide-react"
import { usePathname } from "next/navigation"

import { GuardedLink } from "@/components/common/GuardedLink"
import { usePageHelp } from "@/components/help/usePageHelp"
import { HistoryNavButtons } from "@/components/layout/HistoryNavButtons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * 段のタブ1枚。
 *
 * `path` は実体のURLに継ぐ残りで、先頭の `/` を含む（例: `/01-upload`）。
 * 概要だけは実体そのもののURLなので空文字になる。
 *
 * **短い名前と長い名前の両方を持つ。** タブは9枚並ぶので `label` は詰めるが
 * （「1. 模範解答」）、見出しと「次へ」は何をする画面かを言い切る必要がある
 * （「模範解答画像の管理」）。同じ段を2つの長さで呼ぶので、両方をここに置く。
 */
export interface WorkflowTab {
  id: string
  /** タブに出す短い名前（「1. 模範解答」） */
  label: string
  /** 見出しと「次へ」に出す長い名前（「模範解答画像の管理」） */
  title: string
  path: string
}

interface WorkflowTabHeaderProps {
  /** 「一覧へ戻る」の行き先 */
  listHref: string
  /** いま開いている実体の名前 */
  entityName: string
  /** 実体のURL。各タブの行き先はこれに `WorkflowTab.path` を継いで作る */
  entityHref: string
  tabs: readonly WorkflowTab[]
}

/**
 * 段のあるワークフローの詳細画面が共通で被るヘッダー。
 * 上段が Word のタイトルバー、下段が段のタブ。
 *
 * ```
 * [←][→][≡] 模範解答画像の管理｜期末考査（数学）  [次へ：答案の採点領域作成][使い方]
 * 概要  1.模範解答  2.採点領域  …  9.結果
 * ```
 *
 * **段の題も「使い方」も「次へ」もここが出す。** 以前は各段のページが `PageHeader` で
 * 自分の題を出しており、タブに段の名前が出るようになってからは**同じ段の名前が上下に
 * 2回**並んでいた。3つとも段が決まれば決まるもの ——「使い方」は `usePageHelp` が
 * URL から引き、「次へ」は次のタブそのもの —— なので、段ごとに書き写す理由が無い。
 *
 * **「次へ」は条件を付けずに常に出す。** 以前は「模範解答が1枚以上あるとき」のように
 * 段ごとの条件で隠していたが、**すぐ下のタブが同じ行き先へ無条件で連れて行く**ので
 * 隠しても止められていない。止めたいものがあるなら行き先の画面で言う。
 *
 * **パンくずは置かない。** 段は上流から下流へ一本道に見えるが、実際はどの段へも
 * 行き来できる**兄弟**であって、いま居る段の親ではない。`›` で連なる道筋は
 * その関係を偽る。一覧との親子だけは本物だが、それはツールバーの一覧1つで足りる。
 *
 * 遷移は必ずガードを通す。書きかけを抱えた画面から段を移ると黙って捨てることに
 * なるので、離脱の確認を挟む口を1つに保つ（`GuardedLink` と、履歴の行き来を
 * `guardedTraverse` で包む `useNavigationHistory`）。
 *
 * **「戻る／進む」は閲覧の履歴であって段の前後ではない。** 一覧 → 試験A → 試験B と
 * 来たら、戻るで試験Aへ帰る。段を1つ戻るのは下段のタブの仕事。
 *
 * 押せるかどうかは `HistoryNavButtons` が Electron のセッション履歴に訊いた
 * `canGoBack` / `canGoForward` に従う（端では押せない）。選ばなかった形:
 *
 * - **常に押せるままにする**: 端でも押せて、押しても何も起きない。壊れているのか
 *   端なのかを利用者が区別できない
 * - **アプリ側で行き来を数える**: 数えられるのはアプリが起こした遷移だけなので、
 *   外から履歴を動かされるとずれる（Alt+← / マウスの第4ボタン）。ずれて
 *   **戻れるのに押せない**方が、押しても何も起きないより悪い（手が無くなる）。
 *   Electron に訊けばこの二択自体が要らない —— 履歴そのものを見た答えなので、
 *   誰が動かしてもずれない
 */
export function WorkflowTabHeader({
  listHref,
  entityName,
  entityHref,
  tabs,
}: WorkflowTabHeaderProps) {
  const pathname = usePathname()
  const { helpButton } = usePageHelp({ compact: true })

  const currentIndex = tabs.findIndex(
    (tab) => pathname === entityHref + tab.path
  )
  const currentTab = currentIndex === -1 ? undefined : tabs[currentIndex]
  // 最後の段には「次へ」が無い。現在地が引けないときも出さない（行き先を決められない）
  const nextTab = currentIndex === -1 ? undefined : tabs[currentIndex + 1]

  return (
    <header className="shrink-0 border-b bg-background">
      {/*
        題は**クイックアクセスのすぐ右**に置く。行の中央に絶対配置していたが、
        目が最初に行くのは左端で、そこから中央まで戻って読むことになる。左から
        「どこへ行けるか → いま何を見ているか」と並べば、視線が一方向で済む。
      */}
      <div className="flex items-center gap-2 px-2 pt-1">
        <div className="flex shrink-0 items-center gap-0.5">
          <HistoryNavButtons />
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <GuardedLink
              href={listHref}
              aria-label="一覧へ戻る"
              title="一覧へ戻る"
            >
              <List />
            </GuardedLink>
          </Button>
        </div>
        <h1 className="min-w-0 truncate text-sm font-semibold">
          {currentTab && currentTab.path !== ""
            ? `${currentTab.title}｜${entityName}`
            : entityName}
        </h1>
        {/* 右端が「使い方」、その左が「次へ」（4画面で同じ並び） */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {nextTab && (
            <Button size="sm" className="h-7 text-xs" asChild>
              <GuardedLink href={entityHref + nextTab.path}>
                次へ：{nextTab.title}
              </GuardedLink>
            </Button>
          )}
          {helpButton}
        </div>
      </div>
      {/* 試験は概要込みで9枚並ぶ。窓が狭いときはタブ列だけを横に流す */}
      <nav
        aria-label="ワークフローの段"
        className="flex gap-1 overflow-x-auto px-4 pt-1"
      >
        {tabs.map((tab) => {
          const tabHref = entityHref + tab.path
          // 現在地はパスの完全一致で決める。部分一致では概要（path が空文字）が
          // どのページにも当たってしまい、段のページでも概要が光る。
          // 段どうしでも、片方の path が他方の先頭に重なれば同じ取り違えが起きる
          const isCurrent = pathname === tabHref
          return (
            <GuardedLink
              key={tab.id}
              href={tabHref}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                isCurrent
                  ? "border-green-600 font-semibold text-green-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </GuardedLink>
          )
        })}
      </nav>
    </header>
  )
}
