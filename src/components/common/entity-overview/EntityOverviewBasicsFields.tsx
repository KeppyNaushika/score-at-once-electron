import type { Tag } from "@prisma/client"
import { Info, X } from "lucide-react"

import { EntityTagEditor } from "@/components/common/EntityTagEditor"
import { TooltipButton } from "@/components/common/TooltipButton"
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

import type { EntityOverviewBasics } from "./types"

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

interface EntityOverviewBasicsFieldsProps {
  nameLabel: string
  dateLabel: string
  dateHint?: string
  basics: EntityOverviewBasics
  onCommitBasics: (changed: Partial<EntityOverviewBasics>) => Promise<void>
  tags: Tag[]
  isReloadingTags: boolean
  onReplaceTags: (tagIds: string[]) => Promise<void>
  canEdit: boolean
  editDisabledReason?: string
  /** 入力中の文字を覚えておく鍵（実体ごとに分ける） */
  entityHref: string
}

/**
 * 名前・日付・説明・タグの4行。打った時点で書く（属性の意味は
 * `EntityOverviewPage` の props を参照）。
 */
export function EntityOverviewBasicsFields({
  nameLabel,
  dateLabel,
  dateHint,
  basics,
  onCommitBasics,
  tags,
  isReloadingTags,
  onReplaceTags,
  canEdit,
  editDisabledReason,
  entityHref,
}: EntityOverviewBasicsFieldsProps) {
  const { textOf, remember, forgetField } = useEditingText()

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

  return (
    /*
      見出しの列は幅を決め打つ。中身に合わせて伸縮させると、実体ごとに
      （「試験名」と「解答用紙名」）入力欄の左端がずれる。

      **1行のときは4行とも同じ高さ（h-9）**にする。欄ごとに背の高さが違うと、
      行の間隔だけでなく文字と文字の間も不揃いに見える（説明が2行以上に
      なれば、その行だけ伸びるのは当然として）
    */
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
          <TooltipButton
            label={`${dateLabel}を未設定にする`}
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={clearReferenceDate}
          >
            <X className="h-3.5 w-3.5" />
          </TooltipButton>
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
  )
}
