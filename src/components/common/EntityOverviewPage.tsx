"use client"

import type { Tag } from "@prisma/client"
import { Check, ChevronRight, Info, X } from "lucide-react"
import type { ReactNode } from "react"

import { EntityTagEditor } from "@/components/common/EntityTagEditor"
import { GuardedLink } from "@/components/common/GuardedLink"
import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditingText } from "@/hooks/useEditingText"
import { cn } from "@/lib/utils"
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

/**
 * 要約の帯の1項目に付ける色。
 *
 * **どの語に何色かは呼ぶ側が決める。** 色は「模範解答は青、答案は橙」という
 * 実体ごとの割り当てで、共通部品には決めようがない（以前の `QuickStats` は
 * 試験の5項目を名前で決め打ちしていた）。省略すれば灰。
 */
type EntityOverviewStatTone =
  "blue" | "green" | "purple" | "indigo" | "orange" | "teal" | "rose"

/** 要約の帯に並べる1項目 */
export interface EntityOverviewStat {
  /** 見出しの語。帯の中で一意なので React の key も兼ねる */
  label: string
  value: ReactNode
  /** 数が入っているときの色。省略すると灰 */
  tone?: EntityOverviewStatTone
}

/**
 * 編集欄は**触るまで文字に見せる。**
 *
 * 概要を開く用は「どこまで進んだか見て、次の段へ行く」がほとんどなのに、入力欄が
 * 4つ開きっぱなしだと画面の上半分が設定フォームの顔になり、下の段カードと喧嘩する。
 * 枠を消して文字として置き、**載せたときと打っている間だけ欄に見せる**。
 *
 * モーダルへ戻す手もあるが、1文字直すのに「開く→直す→閉じる」の3手が復活する。
 * しかも保存ボタンが無い（打った時点で書かれる）ので、閉じることが保存に見えて
 * かえって迷わせる。
 */
const QUIET_FIELD_CLASSES = cn(
  "border-transparent bg-transparent px-2 shadow-none",
  "hover:border-input hover:bg-background focus-visible:bg-background",
  // 書き換えられない相手（持ち主でない解答用紙）では、載せても欄に見せない。
  // `Textarea` は `disabled` でもポインタを受けるので、変化を明示的に止める
  "disabled:hover:border-transparent disabled:hover:bg-transparent"
)

/**
 * 見出しと数の色。
 *
 * **控えめに置く。** 濃く塗って白抜きにすると、画面の中でいちばん強い面が
 * 「いくつあるか」になる。ここは現在地の見取り図で、読ませたいのは下の手順である。
 * 淡く敷いて濃い文字を載せれば、色の違いは残したまま主張が下がる。
 *
 * **同系色にはしない。** 項目どうしを見分けるための印なので、色相は離す。
 */
interface StatToneClasses {
  /** 札の外枠 */
  frame: string
  /** 見出し側（淡く敷いて濃い文字） */
  label: string
  /** 数側（敷かずに色文字） */
  value: string
}

const STAT_TONE_CLASSES: Record<EntityOverviewStatTone, StatToneClasses> = {
  blue: {
    frame: "border-blue-200",
    label: "bg-blue-100 text-blue-800",
    value: "text-blue-700",
  },
  green: {
    frame: "border-emerald-200",
    label: "bg-emerald-100 text-emerald-800",
    value: "text-emerald-700",
  },
  purple: {
    frame: "border-purple-200",
    label: "bg-purple-100 text-purple-800",
    value: "text-purple-700",
  },
  indigo: {
    frame: "border-indigo-200",
    label: "bg-indigo-100 text-indigo-800",
    value: "text-indigo-700",
  },
  orange: {
    frame: "border-orange-200",
    label: "bg-orange-100 text-orange-800",
    value: "text-orange-700",
  },
  teal: {
    frame: "border-teal-200",
    label: "bg-teal-100 text-teal-800",
    value: "text-teal-700",
  },
  rose: {
    frame: "border-rose-200",
    label: "bg-rose-100 text-rose-800",
    value: "text-rose-700",
  },
}

/** まだ1件も無い項目は灰へ落とす（色が付いているのは「在る」の合図） */
const STAT_EMPTY_CLASSES: StatToneClasses = {
  frame: "border-gray-200",
  label: "bg-gray-100 text-gray-600",
  value: "text-gray-500",
}

function statToneClasses(stat: EntityOverviewStat): StatToneClasses {
  if (typeof stat.value === "number" && stat.value === 0)
    return STAT_EMPTY_CLASSES
  if (!stat.tone) return STAT_EMPTY_CLASSES
  return STAT_TONE_CLASSES[stat.tone]
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
  const { textOf, remember, forgetField } = useEditingText()
  const stepCanStart = deriveStepCanStart(phases, stepCompletion)

  /**
   * **触った1つだけを書く。**
   *
   * 以前はここで3つをまとめ、下書きの無い欄は `basics` で埋めていた。ところが
   * `onBlur` は下書きを捨てる一方で**取り直しは待たれない**（`queryClient.ts` の
   * `void client.invalidateQueries(…)`）ので、捨てた直後の `basics` は打った値では
   * なく**取り直し前の古い値**である。説明を打つ → 離す → 取り直しが返る前に日付を
   * 触る、で日付の書き込みが古い説明を同梱し、打ったばかりの説明が消えていた。
   *
   * 触った欄だけを運べば、他の欄は載らないので上書きも起きない
   * （docs/coding-style.md「IPC は意図を運ぶ。状態を運ばない」）。
   */
  const write = (changed: Partial<EntityOverviewBasics>) => {
    void onCommitBasics(changed).catch(() => {
      // 失敗の通知は MutationCache が出す
    })
  }

  /**
   * その欄にいま出ている文字。入力中ならその文字、そうでなければ保存されている値。
   * **「変わったか」はこれと比べて決める**（`basics` と比べると、取り直しが遅れて
   * いる間に打った値が「変わっていない」に見える）。
   */
  const shownText = (field: keyof EntityOverviewBasics) =>
    textOf(entityHref, field, basics[field])

  const changeName = (text: string) => {
    const previous = shownText("name")
    remember(entityHref, "name", text)
    // 名前は空にできない。消し切った途中では書かない（次の打鍵で確定する）
    const name = text.trim()
    if (name === "") return
    // 変わっていないなら書かない（同期の LWW を無意味に動かさない）
    if (name === previous.trim()) return
    write({ name })
  }

  /**
   * 日付を書き換える。**空は書かない。**
   *
   * Chromium の `input[type=date]` は、年の桁に触った瞬間のように**値が不完全に
   * なった時点で `""` を報告する**。そのまま書くと、入力を終えずに他所を触っただけで
   * 設定済みの日付が消える。
   *
   * 消す手段は別に置く（下の「未設定にする」）。「打っている間の空は無視して、
   * 離れたときだけ消す」という手もあるが、それは規約が禁じている `onBlur` 確定で
   * あるうえ、**画面から見えない規則**になる（利用者は離れると消えることを知らない）。
   */
  const changeReferenceDate = (text: string) => {
    const previous = shownText("referenceDate")
    remember(entityHref, "referenceDate", text)
    if (text === "") return
    if (text === previous) return
    write({ referenceDate: text })
  }

  /** 日付を未設定へ戻す。空を書くのはこの明示の操作だけ */
  const clearReferenceDate = () => {
    remember(entityHref, "referenceDate", "")
    write({ referenceDate: "" })
  }

  const changeDescription = (text: string) => {
    const previous = shownText("description")
    remember(entityHref, "description", text)
    if (text === previous) return
    write({ description: text })
  }

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
            {/*
            見出しの列は幅を決め打つ。中身に合わせて伸縮させると、実体ごとに
            （「試験名」と「解答用紙名」）入力欄の左端がずれる。

            **1行のときは4行とも同じ高さ（h-9）**にする。欄ごとに背の高さが違うと、
            行の間隔だけでなく文字と文字の間も不揃いに見える（説明が2行以上に
            なれば、その行だけ伸びるのは当然として）
          */}
            <div className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-2">
              <Label
                htmlFor="entity-overview-name"
                className="text-sm text-muted-foreground"
              >
                {nameLabel}
              </Label>
              <Input
                id="entity-overview-name"
                value={shownText("name")}
                disabled={!canEdit}
                placeholder={`${nameLabel}を入力`}
                onChange={(e) => changeName(e.target.value)}
                onBlur={() => forgetField(entityHref, "name")}
                className={cn(
                  QUIET_FIELD_CLASSES,
                  "text-base font-semibold md:text-base"
                )}
              />

              <Label
                htmlFor="entity-overview-reference-date"
                className="text-sm text-muted-foreground"
              >
                {dateLabel}
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id="entity-overview-reference-date"
                  type="date"
                  value={shownText("referenceDate")}
                  disabled={!canEdit}
                  onChange={(e) => changeReferenceDate(e.target.value)}
                  onBlur={() => forgetField(entityHref, "referenceDate")}
                  className={cn(QUIET_FIELD_CLASSES, "w-auto")}
                />
                {canEdit && shownText("referenceDate") !== "" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    aria-label={`${dateLabel}を未設定にする`}
                    title={`${dateLabel}を未設定にする`}
                    onClick={clearReferenceDate}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/*
              日付が何に効くかは、書き換えるときだけ知りたい。常に添えておくと
              2行を占め、しかも毎回読み飛ばされる。訊いたときに答える形にする。
            */}
                {dateHint && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={dateHint}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {dateHint}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <Label
                htmlFor="entity-overview-description"
                className="text-sm text-muted-foreground"
              >
                説明
              </Label>
              <Textarea
                id="entity-overview-description"
                value={shownText("description")}
                disabled={!canEdit}
                // 高さは中身に従う（`Textarea` の `field-sizing-content`）。行数で
                // 決め打つと、1行しか書いていなくても2行ぶんの空白が居座る
                rows={1}
                placeholder="説明を書く"
                onChange={(e) => changeDescription(e.target.value)}
                onBlur={() => forgetField(entityHref, "description")}
                className={cn(
                  QUIET_FIELD_CLASSES,
                  // 1行のときは他の欄と同じ高さ（h-9）に収める。伸びるのは
                  // 2行目からで、そこまでは4行が等間隔に並ぶ
                  "min-h-9 resize-none py-1.5"
                )}
              />

              <Label
                htmlFor="entity-overview-tag"
                className="text-sm text-muted-foreground"
              >
                タグ
              </Label>
              <EntityTagEditor
                className="min-h-9 px-2"
                tags={tags}
                isReloading={isReloadingTags}
                onReplace={onReplaceTags}
                disabled={!canEdit}
                disabledReason={editDisabledReason}
              />
            </div>

            {/*
            現在地の見取り図。**1項目が1枚の札**で、左が見出し（色で塗って白抜き）、
            右が数（塗らずに色文字）。高さも文字も詰める——ここで足を止めさせたい
            わけではないので、面積を取らせない。基本情報と同じ枠へ入れる——どちらも
            「この実体が何か」の話で、下の手順とは別である
          */}
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-4">
              {stats.map((stat) => {
                const tone = statToneClasses(stat)
                return (
                  <span
                    key={stat.label}
                    className={cn(
                      "inline-flex overflow-hidden rounded border text-[11px] leading-none",
                      tone.frame
                    )}
                  >
                    <span className={cn("px-1.5 py-1", tone.label)}>
                      {stat.label}
                    </span>
                    <span
                      className={cn("px-1.5 py-1 font-semibold", tone.value)}
                    >
                      {stat.value}
                    </span>
                  </span>
                )
              })}
            </div>
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

/**
 * 段カードの足元（「次へ」・「n/m 完了」・「前の段の完了を待機中」）の1行。
 *
 * **3態とも同じ高さにする。** ボタンだけ背が高いと、横に並べたときカードごとに
 * 区切り線の下の厚みが変わり、下端が揃わない。
 */
const FOOTER_ROW_CLASSES =
  "flex h-7 items-center justify-center text-center text-sm"

interface WorkflowPhaseCardProps {
  phase: WorkflowPhaseGroup
  tabs: readonly WorkflowTab[]
  entityHref: string
  stepCompletion: Record<string, boolean | null>
  stepCanStart: Record<string, boolean>
}

/** 段の名前とアイコンの色。済み＝緑／着手できる＝青／まだ＝灰 */
function stepTextColor(isCompleted: boolean | null, canStart: boolean): string {
  if (isCompleted) return "text-green-600"
  if (canStart) return "text-blue-600"
  return "text-gray-400"
}

/** 段の行の下地。色の意味は {@link stepTextColor} と同じ */
function stepRowBackground(
  isCompleted: boolean | null,
  canStart: boolean
): string {
  if (isCompleted) return "bg-green-50"
  if (canStart) return "bg-blue-50"
  return "bg-gray-50"
}

/**
 * 段カード1枚。まとまりの見出しの下に、**段が1行ずつ並ぶ**。
 *
 * **行そのものがリンク。** 別に「開く」ボタンを置くと、同じ行き先への口が1枚の
 * カードに2つ出て、しかもボタンの側は行き先を名前で言わない（どの段が開くのか
 * 読めない）。進行中のまとまりにだけ「次へ: 〈段の名前〉」を足す ——これは
 * 「どこから手を付けるか」を名指しするもので、行の複製ではない。
 *
 * **数えるのは判定できる段だけ**（`2/5 完了`）。出力のように材料が無い段しか
 * 無いまとまりでは数そのものを出さない（`0/1` と書くと、何度でもやってよい出力が
 * 「まだやっていない」ことになる）。％にはしない —— 5段のうち2段と言う方が、
 * 40% と言うより残りが見える。
 */
function WorkflowPhaseCard({
  phase,
  tabs,
  entityHref,
  stepCompletion,
  stepCanStart,
}: WorkflowPhaseCardProps) {
  const steps = phase.stepIds.flatMap((stepId) => {
    const tab = tabs.find((workflowTab) => workflowTab.id === stepId)
    if (!tab) return []
    return [
      {
        tab,
        isCompleted: stepCompletion[stepId] ?? null,
        canStart: stepCanStart[stepId] ?? true,
      },
    ]
  })

  const measurableSteps = steps.filter((step) => step.isCompleted !== null)
  const completedCount = measurableSteps.filter(
    (step) => step.isCompleted === true
  ).length

  /**
   * 済んだと言えるのは、判定できる段が在って、それが全部済んだとき。
   * 判定できる段が1つも無いまとまり（出力）は「済み」という状態を持たない。
   */
  const isCompleted =
    measurableSteps.length > 0 && completedCount === measurableSteps.length
  /** 先頭の段に手を付けられるなら、このまとまりに手を付けられる */
  const canStart = steps[0]?.canStart ?? true
  const isActive = canStart && !isCompleted
  const nextStep = steps.find(
    (step) => step.isCompleted !== true && step.canStart
  )

  return (
    /*
      `Card` の既定は `gap-6 py-6`。見出しの下に `pb-4` を足すと、題と最初の段の
      あいだだけ 40px 空いて理由の分からない隙間になる。段カードは詰める。
    */
    <Card
      className={cn(
        "h-full gap-3 py-4 transition-all",
        isActive
          ? "border-blue-300 shadow-lg"
          : isCompleted
            ? "border-green-300"
            : "border-gray-200"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">{phase.title}</h3>
            <p className="text-sm font-normal text-gray-600">
              {phase.description}
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      {/*
        足元（区切り線・「n/m 完了」・「次へ」）は**カードの下端へ寄せる。** 段の数は
        まとまりごとに違うので、内容に続けて置くと横に並べたとき区切り線の高さが
        揃わず、3枚がばらばらに見える。
      */}
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          {steps.map((step) => {
            const StepIcon = step.tab.icon
            return (
              <GuardedLink
                key={step.tab.id}
                href={entityHref + step.tab.path}
                className={cn(
                  "block rounded-lg p-3 transition-all hover:shadow-sm",
                  stepRowBackground(step.isCompleted, step.canStart)
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 items-center gap-3">
                    <div
                      className={stepTextColor(step.isCompleted, step.canStart)}
                      aria-hidden
                    >
                      {step.isCompleted ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4
                        className={cn(
                          "text-sm font-medium",
                          stepTextColor(step.isCompleted, step.canStart)
                        )}
                      >
                        {step.tab.title}
                      </h4>
                      <p className="mt-1 text-xs text-gray-600">
                        {step.tab.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="ml-2 h-4 w-4 shrink-0 text-gray-400"
                    aria-hidden
                  />
                </div>
              </GuardedLink>
            )
          })}
        </div>

        {/*
          足元の3態は**同じ高さ**にする。ボタンだけ背が高いと、横に並べたとき
          カードごとに区切り線の下の厚みが変わって、下端が揃わない。
        */}
        {isActive && nextStep && (
          <div className="mt-auto border-t pt-4">
            <Button className={cn(FOOTER_ROW_CLASSES, "w-full")} asChild>
              <GuardedLink href={entityHref + nextStep.tab.path}>
                次へ: {nextStep.tab.title}
              </GuardedLink>
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="mt-auto border-t pt-4">
            <p
              className={cn(
                FOOTER_ROW_CLASSES,
                "gap-1 font-medium text-green-600"
              )}
            >
              <Check className="h-4 w-4" aria-hidden />
              {completedCount}/{measurableSteps.length} 完了
            </p>
          </div>
        )}

        {!isActive && !isCompleted && !canStart && (
          <div className="mt-auto border-t pt-4">
            <p className={cn(FOOTER_ROW_CLASSES, "font-medium text-gray-500")}>
              前の段の完了を待機中
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
