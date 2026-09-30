"use client"

import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  Settings2,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  AsbSubQuestionUpdate,
  BranchQuestion,
  GlobalSettings,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import {
  branchManuscriptAreaWidth,
  manuscriptCellSize,
  maxManuscriptColumns,
  subManuscriptAreaWidth,
} from "../../hooks/layout/manuscriptWidth"
import { movedIds } from "../../reorderIds"
import type { AsbEditorActions } from "../../types"
import { BranchQuestionForm } from "./BranchQuestionForm"
import { ImageElementEditor } from "./ImageElementEditor"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import { TextElementEditor } from "./TextElementEditor"

/** 簡易分数パース (例: "1/3" → 0.333) */
function parseFractionSimple(fraction: string): number {
  const match = fraction.match(/^(\d+)\/(\d+)$/)
  if (match) return parseInt(match[1]) / parseInt(match[2])
  const parsed = parseFloat(fraction)
  return isNaN(parsed) ? 1 : parsed
}

/** 各枝問の maxGoUp (= その枝問の goUp 適用前の行インデックス) を計算 */
function calcBranchMaxGoUps(branches: BranchQuestion[]): number[] {
  const result: number[] = []
  let row = 0
  let curX = 0
  for (let i = 0; i < branches.length; i++) {
    const branchQuestion = branches[i]
    const w = parseFractionSimple(branchQuestion.layoutWidth ?? "1")

    // auto-break
    if (curX > 1e-9 && curX + w > 1 + 1e-9) {
      row++
      curX = 0
    }

    // maxGoUp = goUp 適用前の行インデックス
    result.push(row)

    // goUp 適用
    if (branchQuestion.goUp != null && branchQuestion.goUp > 0) {
      row = Math.max(0, row - branchQuestion.goUp)
      curX = 0.5
    }

    curX += w

    if (branchQuestion.nextPlacement === "break") {
      row++
      curX = 0
    }
  }
  return result
}

interface SubQuestionFormProps {
  subQuestion: SubQuestion
  maxGoUp: number
  definitionId: string
  actions: AsbEditorActions
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** 用紙設定。縦書きの判定と、原稿用紙の列数の上限（段の幅）に要る */
  settings: GlobalSettings
}

export function SubQuestionForm({
  subQuestion,
  maxGoUp,
  definitionId,
  actions,
  onMoveUp,
  onMoveDown,
  settings,
}: SubQuestionFormProps) {
  const vertical = settings.verticalLayout ?? false
  const cell = { subQuestionId: subQuestion.id }
  const onUpdate = (data: AsbSubQuestionUpdate) =>
    actions.updateSubQuestion(subQuestion.id, data)
  const hasBranches = subQuestion.branchQuestions.length > 0
  const [detailOpen, setDetailOpen] = useState(false)
  // 縦書きでは見た目の高さ/幅が入れ替わるためラベルだけ入れ替える（内部値は不変）
  const heightLabel = vertical ? "幅" : "高さ"
  const widthLabel = vertical ? "高さ" : "幅"

  const hasDetailContent =
    subQuestion.textElements.length > 0 ||
    (subQuestion.imageElements?.length ?? 0) > 0 ||
    !!subQuestion.manuscriptPaper?.enabled

  const hasVisibilityRestricted = subQuestion.imageElements?.some(
    (imageElement) =>
      imageElement.visibility && imageElement.visibility !== "both"
  )

  // 原稿用紙の列数の上限。マス目は正方形なので、段の幅から入る個数がそのまま決まる
  const manuscriptMaxColumns = maxManuscriptColumns(
    subManuscriptAreaWidth(settings, subQuestion),
    manuscriptCellSize(subQuestion, settings.baseRowHeight)
  )

  const branchMaxGoUps = useMemo(
    () => calcBranchMaxGoUps(subQuestion.branchQuestions),
    [subQuestion.branchQuestions]
  )

  const isManuscriptPaper =
    !!subQuestion.manuscriptPaper?.enabled && !hasBranches
  const participatesInHorizontal =
    !!subQuestion.layoutWidth || isManuscriptPaper

  const goUpActive = subQuestion.goUp != null
  const goUpLabel =
    maxGoUp < 1 ? "戻れる行がありません" : `N行上に戻して配置 (最大${maxGoUp})`
  const isGoUpInvalid =
    goUpActive &&
    (!Number.isInteger(subQuestion.goUp) ||
      subQuestion.goUp! < 1 ||
      subQuestion.goUp! > maxGoUp)

  return (
    <div className="space-y-1 border-l-2 border-primary/30 pl-4">
      {/* 小問ヘッダー */}
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <InputGroup className="h-7 w-auto has-focus-visible:z-10">
            <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
              番号
            </InputGroupAddon>
            <InputGroupInput
              className="h-full w-12 flex-none px-0.5 py-0 text-center text-xs md:text-xs"
              value={subQuestion.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              aria-label="小問番号"
            />
          </InputGroup>
          {/* 配点: 枝問なし or 完答モード(usesBranchPoints=false)の時に表示 */}
          {(!hasBranches || subQuestion.usesBranchPoints === false) && (
            <InputGroup className="h-7 w-auto has-focus-visible:z-10">
              <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
                配点
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                aria-label="配点"
                className="h-full w-11 flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={subQuestion.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </InputGroup>
          )}
          {/* 高さ: 枝問なしの時のみ（縦書き時はラベルを「幅」に） */}
          {!hasBranches && (
            <InputGroup className="h-7 w-auto has-focus-visible:z-10">
              <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
                {heightLabel}
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                aria-label={heightLabel}
                className="h-full w-11 flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={subQuestion.heightMultiplier}
                min={1}
                max={30}
                step={0.5}
                onChange={(e) =>
                  onUpdate({ heightMultiplier: Number(e.target.value) })
                }
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </InputGroup>
          )}
          {/* 幅 (layoutWidth) - 原稿用紙有効時は列数から自動計算のため非表示。縦書き時はラベルを「高さ」に */}
          {!isManuscriptPaper && (
            <InputGroup className="h-7 w-auto has-focus-visible:z-10">
              <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
                {widthLabel}
              </InputGroupAddon>
              <InputGroupInput
                aria-label={widthLabel}
                className="h-full w-12 flex-none px-0.5 py-0 text-center text-xs md:text-xs"
                value={subQuestion.layoutWidth ?? ""}
                onChange={(e) => {
                  const value = e.target.value.trim()
                  if (value === "") {
                    onUpdate({
                      layoutWidth: undefined,
                      nextPlacement: undefined,
                      goUp: undefined,
                    })
                  } else {
                    onUpdate({ layoutWidth: value })
                  }
                }}
                placeholder="—"
              />
            </InputGroup>
          )}
        </ButtonGroup>
        {/* 改行ボタン */}
        {participatesInHorizontal && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="改行"
                variant="outline"
                size="icon"
                className={`h-7 w-7 text-xs ${subQuestion.nextPlacement === "break" ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"}`}
                onClick={() => {
                  if (subQuestion.nextPlacement === "break") {
                    onUpdate({ nextPlacement: undefined })
                  } else {
                    onUpdate({ nextPlacement: "break" })
                  }
                }}
              >
                ↵
              </Button>
            </TooltipTrigger>
            <TooltipContent>改行</TooltipContent>
          </Tooltip>
        )}
        {/* 戻るボタン（自分自身をN行上に配置） */}
        {participatesInHorizontal && (
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
                        goUpActive && subQuestion.goUp! > 0
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground"
                      )}
                      onClick={() => {
                        if (goUpActive) {
                          onUpdate({ goUp: undefined })
                        } else {
                          onUpdate({ goUp: Math.min(1, maxGoUp) })
                        }
                      }}
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
                  "h-full w-8 flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                  isGoUpInvalid && "bg-red-100 dark:bg-red-900/30"
                )}
                value={subQuestion.goUp || ""}
                min={1}
                max={maxGoUp}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === "") {
                    onUpdate({ goUp: 0 })
                  } else {
                    onUpdate({ goUp: Number(value) })
                  }
                }}
                onBlur={() => {
                  if (
                    subQuestion.goUp == null ||
                    !Number.isInteger(subQuestion.goUp) ||
                    subQuestion.goUp < 1 ||
                    subQuestion.goUp > maxGoUp
                  ) {
                    onUpdate({ goUp: undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault()
                    const cur = subQuestion.goUp ?? 0
                    const next = e.key === "ArrowUp" ? cur + 1 : cur - 1
                    if (next >= 1 && next <= maxGoUp) {
                      onUpdate({ goUp: next })
                    }
                  }
                }}
              />
            )}
          </InputGroup>
        )}

        {/* 枝問配点スイッチ（枝問がある場合のみ） */}
        {hasBranches && (
          <div className="flex items-center gap-1">
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              枝問配点
            </span>
            <Switch
              checked={subQuestion.usesBranchPoints !== false}
              onCheckedChange={(value) => onUpdate({ usesBranchPoints: value })}
            />
          </div>
        )}

        {/* アクションボタン */}
        <div className="ml-auto flex items-center gap-1.5">
          <ButtonGroup className="rounded-md border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="上へ移動"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={onMoveUp}
                  disabled={!onMoveUp}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上へ移動</TooltipContent>
            </Tooltip>
            <ButtonGroupSeparator />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="下へ移動"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={onMoveDown}
                  disabled={!onMoveDown}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下へ移動</TooltipContent>
            </Tooltip>
          </ButtonGroup>
          {!hasBranches && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="詳細設定"
                  variant="ghost"
                  size="icon"
                  className={`relative h-7 w-7 ${hasVisibilityRestricted ? "text-orange-500" : detailOpen ? "text-primary" : "text-muted-foreground"}`}
                  onClick={() => setDetailOpen(!detailOpen)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {hasDetailContent && (
                    <span
                      className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${hasVisibilityRestricted ? "bg-orange-500" : "bg-primary"}`}
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>詳細設定</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="枝問を追加"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => actions.addBranchQuestion(subQuestion.id)}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>枝問を追加</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="小問を削除"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => actions.deleteSubQuestion(subQuestion.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>小問を削除</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 枝問なし: 詳細設定（展開コンテンツ） */}
      {!hasBranches && detailOpen && (
        <div className="space-y-2 pt-1">
          <TextElementEditor
            textElements={subQuestion.textElements}
            onAdd={() => actions.addTextElement(cell)}
            onUpdate={actions.updateTextElement}
            onDelete={actions.deleteTextElement}
            vertical={vertical}
          />
          <ImageElementEditor
            imageElements={subQuestion.imageElements ?? []}
            onAdd={(imageElement) =>
              actions.addImageElement(cell, imageElement)
            }
            onUpdate={actions.updateImageElement}
            onDelete={actions.deleteImageElement}
            definitionId={definitionId}
          />
          <ManuscriptPaperSettings
            manuscriptPaper={subQuestion.manuscriptPaper}
            maxColumns={manuscriptMaxColumns}
            verticalLayout={vertical}
            onSetEnabled={(enabled, initialSettings) => {
              actions.setManuscriptPaperEnabled(cell, enabled, initialSettings)
              // 原稿用紙を使い始めたら、横に並ぶよう幅を埋めておく。
              // **別のレコードなので別の意図として送る**（1つの更新に混ぜると
              // 書き込みの単位が2テーブルにまたがる）
              if (enabled && !subQuestion.layoutWidth) {
                onUpdate({ layoutWidth: "1" })
              }
            }}
            onUpdateSettings={actions.updateManuscriptPaper}
            onAddCharGuide={actions.addCharGuide}
            onUpdateCharGuide={actions.updateCharGuide}
            onDeleteCharGuide={actions.deleteCharGuide}
          />
          <OMRCellConfigForm
            config={subQuestion.omrConfig}
            onChange={(config) =>
              config
                ? actions.upsertOmrConfig(cell, config)
                : actions.deleteOmrConfig(cell)
            }
          />
        </div>
      )}

      {/* 枝問リスト */}
      {hasBranches && (
        <div className="space-y-0.5">
          {subQuestion.branchQuestions.map((branchQuestion, branchIndex) => (
            <BranchQuestionForm
              key={branchQuestion.id}
              branchQuestion={branchQuestion}
              showPoints={subQuestion.usesBranchPoints !== false}
              maxGoUp={branchMaxGoUps[branchIndex]}
              definitionId={definitionId}
              actions={actions}
              vertical={vertical}
              manuscriptMaxColumns={maxManuscriptColumns(
                branchManuscriptAreaWidth(
                  settings,
                  subQuestion,
                  branchQuestion
                ),
                manuscriptCellSize(branchQuestion, settings.baseRowHeight)
              )}
              onMoveUp={
                branchIndex > 0
                  ? () =>
                      actions.reorderBranchQuestions(
                        subQuestion.id,
                        movedIds(
                          subQuestion.branchQuestions,
                          branchIndex,
                          branchIndex - 1
                        )
                      )
                  : undefined
              }
              onMoveDown={
                branchIndex < subQuestion.branchQuestions.length - 1
                  ? () =>
                      actions.reorderBranchQuestions(
                        subQuestion.id,
                        movedIds(
                          subQuestion.branchQuestions,
                          branchIndex,
                          branchIndex + 1
                        )
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
