"use client"

import type { Tag } from "@prisma/client"
import { Check } from "lucide-react"
import type { ReactNode } from "react"

import { EntityTagEditor } from "@/components/common/EntityTagEditor"
import { GuardedLink } from "@/components/common/GuardedLink"
import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useEditingText } from "@/hooks/useEditingText"
import type { WorkflowPhaseGroup } from "@/lib/workflowTabs"

/**
 * その場で書き換える3つ。
 *
 * 日付は `<input type="date">` が扱う **yyyy-mm-dd**（未設定は空文字）で持つ。
 * DB の列は4実体とも `referenceDate` に揃っているが、境界を越えてくる姿は
 * `Date`（試験・成績・資料）と ISO 文字列（解答用紙）で割れているので、
 * 入力欄の形へ寄せる側で1つにする（{@link toDateInputValue}）。
 */
export interface EntityOverviewBasics {
  name: string
  /** yyyy-mm-dd。未設定は空文字 */
  referenceDate: string
  /** 未設定は空文字 */
  description: string
}

/** 要約の帯に並べる1項目 */
export interface EntityOverviewStat {
  /** 見出しの語。帯の中で一意なので React の key も兼ねる */
  label: string
  value: ReactNode
}

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
   * 書く。**呼ばれるのは実際に値が変わったときだけ**（同じ値での書き込みは
   * 同期の LWW を無意味に動かす）。
   */
  onCommitBasics: (basics: EntityOverviewBasics) => Promise<void>
  /** いま付いているタグ（結合行の `tag` をそのまま） */
  tags: Tag[]
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
   * 完了％の分母からも外れる ——「済んでいない」ではないので 0% とは書かない。
   */
  stepCompletion: Record<string, boolean | null>
  /** 右上に置く操作（メンバー・書き出し・削除）。無くてよい */
  actions?: ReactNode
}

function isSameBasics(
  left: EntityOverviewBasics,
  right: EntityOverviewBasics
): boolean {
  return (
    left.name === right.name &&
    left.referenceDate === right.referenceDate &&
    left.description === right.description
  )
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
 * [準備 100% 開く] [採点 62% 開く] [確定 開く] [出力 開く]
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
  const { textOf, remember, forgetField } = useEditingText()

  /**
   * いま書くべき3つ。**入力中の文字を優先**し、`override` はそれより優先する
   * （`remember` は状態の更新なので、同じ打鍵の中ではまだ読み出せない）。
   *
   * 変わっていない2つも毎回一緒に送る。書く先は1行なので UPDATE は1本のままで、
   * かつ「片方の書き込みが着地する前にもう片方を打った」ときに古い値で上書き
   * しない（画面が知っている最新をいつも丸ごと渡す）。
   */
  const currentBasics = (
    override: Partial<EntityOverviewBasics>
  ): EntityOverviewBasics => {
    const name = override.name ?? textOf(entityHref, "name", basics.name)
    const referenceDate =
      override.referenceDate ??
      textOf(entityHref, "referenceDate", basics.referenceDate)
    const description =
      override.description ??
      textOf(entityHref, "description", basics.description)
    return {
      // 名前は空にできない（消し切ったままなら元の名前が残る）
      name: name.trim() === "" ? basics.name : name.trim(),
      referenceDate,
      description,
    }
  }

  const write = (override: Partial<EntityOverviewBasics>) => {
    const next = currentBasics(override)
    // 変わっていないなら書かない（同期の LWW を無意味に動かさない）
    if (isSameBasics(next, basics)) return
    void onCommitBasics(next).catch(() => {
      // 失敗の通知は MutationCache が出す
    })
  }

  const changeName = (text: string) => {
    remember(entityHref, "name", text)
    // 消し切った途中では書かない（次の打鍵で確定する）
    if (text.trim() === "") return
    write({ name: text })
  }

  const changeReferenceDate = (text: string) => {
    remember(entityHref, "referenceDate", text)
    write({ referenceDate: text })
  }

  const changeDescription = (text: string) => {
    remember(entityHref, "description", text)
    write({ description: text })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="space-y-3">
        {(actions || (!canEdit && editDisabledReason)) && (
          <div className="flex items-center justify-end gap-2">
            {!canEdit && editDisabledReason && (
              <p className="mr-auto text-xs text-muted-foreground">
                {editDisabledReason}
              </p>
            )}
            {actions}
          </div>
        )}
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3">
          <Label
            htmlFor="entity-overview-name"
            className="pt-2 text-sm text-muted-foreground"
          >
            {nameLabel}
          </Label>
          <Input
            id="entity-overview-name"
            value={textOf(entityHref, "name", basics.name)}
            disabled={!canEdit}
            onChange={(e) => changeName(e.target.value)}
            onBlur={() => forgetField(entityHref, "name")}
            className="max-w-md"
          />

          <Label
            htmlFor="entity-overview-reference-date"
            className="pt-2 text-sm text-muted-foreground"
          >
            {dateLabel}
          </Label>
          <div className="space-y-1">
            <Input
              id="entity-overview-reference-date"
              type="date"
              value={textOf(entityHref, "referenceDate", basics.referenceDate)}
              disabled={!canEdit}
              onChange={(e) => changeReferenceDate(e.target.value)}
              onBlur={() => forgetField(entityHref, "referenceDate")}
              className="w-48"
            />
            {dateHint && (
              <p className="text-xs text-muted-foreground">{dateHint}</p>
            )}
          </div>

          <Label
            htmlFor="entity-overview-description"
            className="pt-2 text-sm text-muted-foreground"
          >
            説明
          </Label>
          <Textarea
            id="entity-overview-description"
            value={textOf(entityHref, "description", basics.description)}
            disabled={!canEdit}
            rows={2}
            placeholder="任意"
            onChange={(e) => changeDescription(e.target.value)}
            onBlur={() => forgetField(entityHref, "description")}
            className="max-w-md"
          />

          <Label
            htmlFor="entity-overview-tag"
            className="pt-2 text-sm text-muted-foreground"
          >
            タグ
          </Label>
          <EntityTagEditor
            tags={tags}
            onReplace={onReplaceTags}
            disabled={!canEdit}
            disabledReason={editDisabledReason}
          />
        </div>
      </section>

      <section className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y py-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <span className="text-lg font-semibold">{stat.value}</span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {phases.map((phase) => (
          <WorkflowPhaseCard
            key={phase.title}
            phase={phase}
            tabs={tabs}
            entityHref={entityHref}
            stepCompletion={stepCompletion}
          />
        ))}
      </section>
    </div>
  )
}

interface WorkflowPhaseCardProps {
  phase: WorkflowPhaseGroup
  tabs: readonly WorkflowTab[]
  entityHref: string
  stepCompletion: Record<string, boolean | null>
}

/**
 * 段カード1枚。
 *
 * 完了％の分母は**判定できる段だけ**。出力や採点確定のように材料が無い段しか
 * 無いまとまりでは％を出さず、「開く」だけを置く（0% と書くと、何度でもやってよい
 * 出力が「まだやっていない」ことになる）。
 */
function WorkflowPhaseCard({
  phase,
  tabs,
  entityHref,
  stepCompletion,
}: WorkflowPhaseCardProps) {
  const steps = phase.stepIds.flatMap((stepId) => {
    const tab = tabs.find((workflowTab) => workflowTab.id === stepId)
    return tab ? [{ tab, isCompleted: stepCompletion[stepId] ?? null }] : []
  })

  const measurableSteps = steps.filter((step) => step.isCompleted !== null)
  const completedCount = measurableSteps.filter(
    (step) => step.isCompleted
  ).length
  const percentage =
    measurableSteps.length > 0
      ? Math.round((completedCount / measurableSteps.length) * 100)
      : null

  // 「開く」の行き先は、まだ済んでいない最初の段。全部済んでいれば先頭へ戻す
  const openStep = steps.find((step) => step.isCompleted !== true) ?? steps[0]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline justify-between text-base">
          <span>{phase.title}</span>
          {percentage !== null && (
            <span className="text-sm font-semibold text-muted-foreground">
              {percentage}%
            </span>
          )}
        </CardTitle>
        {percentage !== null && <Progress value={percentage} className="h-2" />}
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.tab.id}>
              <GuardedLink
                href={entityHref + step.tab.path}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <span
                  className={
                    step.isCompleted
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }
                  aria-hidden
                >
                  {step.isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="inline-block h-4 w-4 text-center">・</span>
                  )}
                </span>
                <span className="truncate">{step.tab.title}</span>
              </GuardedLink>
            </li>
          ))}
        </ul>
        {openStep && (
          <Button size="sm" className="w-full" asChild>
            <GuardedLink href={entityHref + openStep.tab.path}>
              開く
            </GuardedLink>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
