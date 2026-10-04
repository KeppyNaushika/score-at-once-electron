"use client"

import type { Tag } from "@prisma/client"
import type { ReactNode } from "react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { Card, CardContent } from "@/components/ui/card"
import type { WorkflowPhaseGroup } from "@/lib/workflowTabs"

import { EntityOverviewBasicsFields } from "./entity-overview/EntityOverviewBasicsFields"
import { EntityOverviewStatStrip } from "./entity-overview/EntityOverviewStatStrip"
import type {
  EntityOverviewBasics,
  EntityOverviewStat,
} from "./entity-overview/types"
import { WorkflowPhaseCard } from "./entity-overview/WorkflowPhaseCard"

/**
 * `Date` でも ISO 文字列でも受けて、日付入力欄が読める yyyy-mm-dd にする。
 * 未設定は空文字（入力欄の「未入力」）。
 */
export function toDateInputValue(value: Date | string | null): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().split("T")[0]
}

interface EntityOverviewPageProps {
  /** 名前欄の見出しの語（試験名 / 資料名 / 解答用紙名 …） */
  nameLabel: string
  /** 日付欄の見出しの語（試験日 / 実施日 / 成績算出日 / 使用日） */
  dateLabel: string
  /** 日付欄に添える一言（在籍判定に使う、など）。無くてよい */
  dateHint?: string
  basics: EntityOverviewBasics
  /**
   * 書く。**触った1つだけが載る**（`{ description: "…" }`）。呼ばれるのは実際に
   * 値が変わったときだけ（同じ値での書き込みは同期の LWW を無意味に動かす）。
   *
   * **載っていない項目は「触っていない」の意**なので、受け取る側は書き換えない
   * （`undefined` を素通しすれば Prisma も main の更新関数も見送る）。属性ひとそろい
   * でしか更新できない実体（解答用紙）だけが、足りない分をいまの姿から埋める。
   */
  onCommitBasics: (changed: Partial<EntityOverviewBasics>) => Promise<void>
  /** いま付いているタグ（結合行の `tag` をそのまま） */
  tags: Tag[]
  /**
   * `tags` を取り直している最中か（取得の `isFetching` をそのまま）。
   *
   * **付け替えの後は必ず true になる。** 取り直しは待たれない（`invalidateQueries`
   * は `void`）ので、これを渡さないと `tags` が1往復ぶん古いまま次の付け替えを
   * 組み立てることになり、先に付けたタグが消える。
   */
  isReloadingTags: boolean
  /** 付け替える。渡すのは置き換え後のタグ id ひとそろい */
  onReplaceTags: (tagIds: string[]) => Promise<void>
  /** 書き換えられるか（解答用紙は担当だけ） */
  canEdit?: boolean
  /** 書き換えられない理由。`canEdit` が false のときだけ出す */
  editDisabledReason?: string
  /** 要約の帯（模範解答 3 / 採点領域 42 / …） */
  stats: EntityOverviewStat[]
  /** 段のタブ一覧。カードに出す段の名前と行き先はここからだけ引く */
  tabs: readonly WorkflowTab[]
  /** 実体のURL。段の行き先はこれに `WorkflowTab.path` を継ぐ */
  entityHref: string
  /** 段カードのまとまり */
  phases: readonly WorkflowPhaseGroup[]
  /**
   * 段が済んだか。**載っていない段は「判定できない」**（`null` と同じ）で、
   * 「n/m 完了」の分母からも外れる ——「済んでいない」ではないので 0/1 とは書かない。
   */
  stepCompletion: Record<string, boolean | null>
  /** 右上に置く操作（メンバー・書き出し・削除）。無くてよい */
  actions?: ReactNode
}

/**
 * 段ごとの「着手できるか」を導く。
 *
 * **前後関係の表を持たない。** 以前は段ごとに `dependsOn: ["02-template"]` を手で
 * 書いていたが、`phases` の `stepIds` は**やる順そのもの**なので、同じ前後関係を
 * 2度書いていたことになる。2度書けば段を挟んだときに片方だけ古くなるので、
 * 「それより前の段が全部済んでいれば着手できる」と読み替えて並びから導く。
 *
 * **判定できない段（`null`）は後ろを堰き止めない。** 済んでいないと分かったわけでは
 * ないので、それを理由に止めると材料の無い段（出力）より後ろが一生着手できない
 * ことになる。止めるのは**済んでいないと分かっている段**だけ。
 */
function deriveStepCanStart(
  phases: readonly WorkflowPhaseGroup[],
  stepCompletion: Record<string, boolean | null>
): Record<string, boolean> {
  const canStartByStepId: Record<string, boolean> = {}
  let blockedByEarlierStep = false
  phases.forEach((phase) => {
    phase.stepIds.forEach((stepId) => {
      canStartByStepId[stepId] = !blockedByEarlierStep
      if (stepCompletion[stepId] === false) blockedByEarlierStep = true
    })
  })
  return canStartByStepId
}

/**
 * 段のあるワークフロー4つ（試験・成績算出・試験外成績資料・解答用紙作成）が
 * 共通で使う概要ページ。
 *
 * ```
 * 名前  [                    ]
 * 日付  [          ]          ← 見出しの語は実体ごと
 * 説明  [                    ]
 * タグ  [ ] [ ] [+]
 * ────────────────────────────
 * 模範解答 3 / 採点領域 42 / 設問 38 / 受験生徒 120 / 答案 118
 * ────────────────────────────
 * ┌ 準備          5/5 完了 ┐┌ 採点          1/2 完了 ┐┌ 出力      ┐
 * │ [済] 模範解答画像の管理 ›││ [済] 生徒答案の追加…  ›││ 採点結果… ›│
 * │ [済] 答案の採点領域作成 ›││ [未] 一括採点         ›││           │
 * │ …                      ││ [未] 採点の割り当てと…›││           │
 * │        完了            ││  [次へ: 一括採点]      ││           │
 * └────────────────────────┘└────────────────────────┘└───────────┘
 * ```
 *
 * **モーダルを置かない。** 名前・日付・説明・タグは、別の窓を開いて保存して閉じる
 * のではなく**この画面で直に書き換える**。以前は4画面とも「編集」ボタン →
 * 基本設定モーダル →「保存」で、しかも成績はその形を丸ごと手で書き写していた。
 *
 * **保存は1打鍵ごとに即時**（docs/coding-style.md「ジェスチャは終わったときに1回書く」
 * の表: テキスト・選択肢は1回ごとに即時）。デバウンスも `onBlur` 確定も置かない。
 * 手本は `BoundaryEditor` の `changeLabel` / `changeMinPercentage`。
 * 楽観更新はしない —— 書いたら取り直し、表示は読み直した結果に従う。
 *
 * **入力中の文字は `useEditingText` が手元に持つ。** 1打鍵ごとに書く欄は、取り直しが
 * 打鍵の合間に着地すると値が戻る（`設問` と打って `設1` が保存される）。`onBlur` は
 * その覚えを捨てるためだけに使う（保存ではない）。
 *
 * **ゆえに未保存のガード（`NavigationGuardContext`）に載せない。** 打った時点で
 * 書かれているので、守るべき書きかけがそもそも残らない。
 *
 * **題は出さない。** 実体の名前は `WorkflowTabHeader` が出しており、ここで
 * もう一度大きな題を置くと同じ名前が上下に並ぶ。
 *
 * **全体の進捗バーは持たない。** 段カードが段ごとの進み具合を出しており、
 * それを1本に均した数（「試験進捗 62%」）は、どの段が残っているかを言わない。
 */
export function EntityOverviewPage({
  nameLabel,
  dateLabel,
  dateHint,
  basics,
  onCommitBasics,
  tags,
  isReloadingTags,
  onReplaceTags,
  canEdit = true,
  editDisabledReason,
  stats,
  tabs,
  entityHref,
  phases,
  stepCompletion,
  actions,
}: EntityOverviewPageProps) {
  const stepCanStart = deriveStepCanStart(phases, stepCompletion)

  // **1本の柱に揃える。** 端末の幅いっぱいに広げると、左端の入力欄と右端の
  // ボタンが遠く離れて別々の物に見える。中身はどれも同じ幅の中へ置く。
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/*
        見出しと操作は**枠の外**に置く。下の「手順」も同じ形（見出し → カード）
        なので、2つの節が同じ骨になる。枠の中に見出しを入れると、上の節だけ
        入れ子が1つ深く見えていた。
      */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            基本情報
          </h2>
          <div className="flex items-center gap-2">
            {!canEdit && editDisabledReason && (
              <p className="text-xs text-muted-foreground">
                {editDisabledReason}
              </p>
            )}
            {actions}
          </div>
        </div>
        <Card className="py-4">
          <CardContent className="space-y-4">
            <EntityOverviewBasicsFields
              nameLabel={nameLabel}
              dateLabel={dateLabel}
              dateHint={dateHint}
              basics={basics}
              onCommitBasics={onCommitBasics}
              tags={tags}
              isReloadingTags={isReloadingTags}
              onReplaceTags={onReplaceTags}
              canEdit={canEdit}
              editDisabledReason={editDisabledReason}
              entityHref={entityHref}
            />
            <EntityOverviewStatStrip stats={stats} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">手順</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {phases.map((phase) => (
            <WorkflowPhaseCard
              key={phase.title}
              phase={phase}
              tabs={tabs}
              entityHref={entityHref}
              stepCompletion={stepCompletion}
              stepCanStart={stepCanStart}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
