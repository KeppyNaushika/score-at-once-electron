"use client"

import { ChevronDown, ChevronUp, Settings2 } from "lucide-react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AsbBranchQuestionAttributes } from "@/types/answerSheetDefinition.types"

/**
 * 小問と枝問の1行目（番号・配点・高さ・幅・改行・戻る・移動・詳細設定）の部品。
 *
 * 小問と枝問は同じ並べ方の属性を持つので、欄の見た目と入力の扱いをここ1か所に置く。
 * 何を出すか（枝問があれば配点を隠す、など）は呼び出し側が決める。
 */

/** 1行目の欄が書き換える属性（小問・枝問の両方が持つもの） */
type QuestionRowUpdate = Partial<
  Pick<AsbBranchQuestionAttributes, "layoutWidth" | "nextPlacement" | "goUp">
>

const FIELD_GROUP_CLASS = "h-7 w-auto has-focus-visible:z-10"
const FIELD_ADDON_CLASS = "py-0 pl-1.5 text-xs font-normal"
const TEXT_INPUT_CLASS =
  "h-full w-12 flex-none px-0.5 py-0 text-center text-xs md:text-xs"
const NUMBER_INPUT_CLASS =
  "flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

/** 文字の欄（番号） */
export function QuestionTextField({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label: string
  ariaLabel?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <InputGroup className={FIELD_GROUP_CLASS}>
      <InputGroupAddon className={FIELD_ADDON_CLASS}>{label}</InputGroupAddon>
      <InputGroupInput
        className={TEXT_INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
    </InputGroup>
  )
}

/** 数の欄（配点・高さ）。離れたときに先頭の 0 などを整えて見せ直す */
export function QuestionNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <InputGroup className={FIELD_GROUP_CLASS}>
      <InputGroupAddon className={FIELD_ADDON_CLASS}>{label}</InputGroupAddon>
      <InputGroupInput
        type="number"
        aria-label={label}
        className={cn("h-full w-11", NUMBER_INPUT_CLASS)}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={(e) => {
          e.target.value = String(Number(e.target.value))
        }}
      />
    </InputGroup>
  )
}

/** 幅（layoutWidth）の欄。空にすると横並びをやめ、改行・戻るも外す */
export function LayoutWidthField({
  label,
  layoutWidth,
  onUpdate,
}: {
  label: string
  layoutWidth: string | undefined
  onUpdate: (update: QuestionRowUpdate) => void
}) {
  return (
    <InputGroup className={FIELD_GROUP_CLASS}>
      <InputGroupAddon className={FIELD_ADDON_CLASS}>{label}</InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        className={TEXT_INPUT_CLASS}
        value={layoutWidth ?? ""}
        onChange={(e) => {
          const trimmed = e.target.value.trim()
          if (trimmed === "") {
            onUpdate({
              layoutWidth: undefined,
              nextPlacement: undefined,
              goUp: undefined,
            })
          } else {
            onUpdate({ layoutWidth: trimmed })
          }
        }}
        placeholder="—"
      />
    </InputGroup>
  )
}

/** 改行ボタンと、自分自身をN行上に戻して置く「戻る」の欄 */
export function PlacementControls({
  nextPlacement,
  goUp,
  maxGoUp,
  onUpdate,
}: {
  nextPlacement: AsbBranchQuestionAttributes["nextPlacement"]
  goUp: number | undefined
  maxGoUp: number
  onUpdate: (update: QuestionRowUpdate) => void
}) {
  const goUpActive = goUp != null
  const goUpLabel =
    maxGoUp < 1 ? "戻れる行がありません" : `N行上に戻して配置 (最大${maxGoUp})`
  const isGoUpInvalid =
    goUp != null && (!Number.isInteger(goUp) || goUp < 1 || goUp > maxGoUp)
  const isBreak = nextPlacement === "break"

  return (
    <>
      <TooltipButton
        label="改行"

        variant="outline"
        size="icon"
        className={cn(
          "h-7 w-7 text-xs",
          isBreak
            ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
            : "text-muted-foreground"
        )}
        onClick={() =>
          onUpdate({ nextPlacement: isBreak ? undefined : "break" })
        }
      >
        ↵
      </TooltipButton>
      <InputGroup
        className={cn("h-7 w-auto", goUpActive && "border-primary/50")}
      >
        <InputGroupAddon className="py-0 pl-0 has-[>button]:ml-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <InputGroupButton
                  aria-label={goUpLabel}
                  size="icon-xs"
                  className={cn(
                    "size-6.5 text-xs",
                    goUp != null && goUp > 0
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground"
                  )}
                  onClick={() =>
                    onUpdate({
                      goUp: goUpActive ? undefined : Math.min(1, maxGoUp),
                    })
                  }
                  disabled={!goUpActive && maxGoUp < 1}
                >
                  ↑
                </InputGroupButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>{goUpLabel}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
        {goUpActive && (
          <InputGroupInput
            type="number"
            aria-label="戻り行数"
            aria-invalid={isGoUpInvalid}
            className={cn(
              "h-full w-8",
              NUMBER_INPUT_CLASS,
              isGoUpInvalid && "bg-red-100 dark:bg-red-900/30"
            )}
            value={goUp || ""}
            min={1}
            max={maxGoUp}
            onChange={(e) => {
              const typed = e.target.value
              onUpdate({ goUp: typed === "" ? 0 : Number(typed) })
            }}
            onBlur={() => {
              if (isGoUpInvalid) onUpdate({ goUp: undefined })
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                const current = goUp ?? 0
                const next = e.key === "ArrowUp" ? current + 1 : current - 1
                if (next >= 1 && next <= maxGoUp) {
                  onUpdate({ goUp: next })
                }
              }
            }}
          />
        )}
      </InputGroup>
    </>
  )
}

/** 上へ・下へ移動のボタン組。端では押せない（呼び出し側が undefined を渡す） */
export function MoveButtons({
  onMoveUp,
  onMoveDown,
}: {
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  return (
    <ButtonGroup className="rounded-md border">
      <TooltipButton
        label="上へ移動"

        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        onClick={onMoveUp}
        disabled={!onMoveUp}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </TooltipButton>
      <ButtonGroupSeparator />
      <TooltipButton
        label="下へ移動"

        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        onClick={onMoveDown}
        disabled={!onMoveDown}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </TooltipButton>
    </ButtonGroup>
  )
}

/**
 * 詳細設定を開くボタン。中身があれば点を付け、画像の表示先を絞っていれば
 * 橙で知らせる（片方の用紙にしか出ないことに気づけるように）
 */
export function DetailToggleButton({
  open,
  onToggle,
  hasContent,
  visibilityRestricted,
}: {
  open: boolean
  onToggle: () => void
  hasContent: boolean
  visibilityRestricted: boolean
}) {
  return (
    <TooltipButton
      label="詳細設定"

      variant="ghost"
      size="icon"
      className={cn(
        "relative h-7 w-7",
        visibilityRestricted
          ? "text-orange-500"
          : open
            ? "text-primary"
            : "text-muted-foreground"
      )}
      onClick={onToggle}
    >
      <Settings2 className="h-3.5 w-3.5" />
      {hasContent && (
        <span
          className={cn(
            "absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full",
            visibilityRestricted ? "bg-orange-500" : "bg-primary"
          )}
        />
      )}
    </TooltipButton>
  )
}
