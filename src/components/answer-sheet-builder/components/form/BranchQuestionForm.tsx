"use client"

import { ChevronDown, ChevronUp, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
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
import type {
  AsbBranchQuestionAttributes,
  BranchQuestion,
} from "@/types/answerSheetDefinition.types"

import type { AsbEditorActions } from "../../types"
import { ImageElementEditor } from "./ImageElementEditor"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import { TextElementEditor } from "./TextElementEditor"

interface BranchQuestionFormProps {
  branchQuestion: BranchQuestion
  showPoints?: boolean
  maxGoUp: number
  definitionId: string
  actions: AsbEditorActions
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** 縦書きレイアウトか（高さ/幅ラベルの表示を入れ替える） */
  vertical?: boolean
  /** この枝問の原稿用紙が段の幅に収められる最大列数 */
  manuscriptMaxColumns: number
}

export function BranchQuestionForm({
  branchQuestion,
  showPoints = true,
  maxGoUp,
  definitionId,
  actions,
  onMoveUp,
  onMoveDown,
  vertical = false,
  manuscriptMaxColumns,
}: BranchQuestionFormProps) {
  const cell = { branchQuestionId: branchQuestion.id }
  const onUpdate = (data: Partial<AsbBranchQuestionAttributes>) =>
    actions.updateBranchQuestion(branchQuestion.id, data)
  // 縦書きでは見た目の高さ/幅が入れ替わるためラベルだけ入れ替える（内部値は不変）
  const heightLabel = vertical ? "幅" : "高さ"
  const widthLabel = vertical ? "高さ" : "幅"
  const [detailOpen, setDetailOpen] = useState(false)

  const hasDetailContent =
    branchQuestion.textElements.length > 0 ||
    (branchQuestion.imageElements?.length ?? 0) > 0 ||
    !!branchQuestion.manuscriptPaper?.enabled

  const hasVisibilityRestricted = branchQuestion.imageElements?.some(
    (imageElement) =>
      imageElement.visibility && imageElement.visibility !== "both"
  )

  const goUpActive = branchQuestion.goUp != null
  const goUpLabel =
    maxGoUp < 1 ? "戻れる行がありません" : `N行上に戻して配置 (最大${maxGoUp})`
  const isGoUpInvalid =
    goUpActive &&
    (!Number.isInteger(branchQuestion.goUp) ||
      branchQuestion.goUp! < 1 ||
      branchQuestion.goUp! > maxGoUp)

  return (
    <div className="ml-4 space-y-1 border-l-2 border-muted-foreground/20 py-1 pl-4">
      {/* 基本設定行 */}
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <InputGroup className="h-7 w-auto has-focus-visible:z-10">
            <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
              番号
            </InputGroupAddon>
            <InputGroupInput
              className="h-full w-12 flex-none px-0.5 py-0 text-center text-xs md:text-xs"
              value={branchQuestion.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder=""
            />
          </InputGroup>
          {showPoints && (
            <InputGroup className="h-7 w-auto has-focus-visible:z-10">
              <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
                配点
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                className="h-full w-11 flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={branchQuestion.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </InputGroup>
          )}
          <InputGroup className="h-7 w-auto has-focus-visible:z-10">
            <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
              {heightLabel}
            </InputGroupAddon>
            <InputGroupInput
              type="number"
              aria-label={heightLabel}
              className="h-full w-11 flex-none [appearance:textfield] px-0.5 py-0 text-center text-xs md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={branchQuestion.heightMultiplier}
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
          {/* 幅 (layoutWidth) */}
          <InputGroup className="h-7 w-auto has-focus-visible:z-10">
            <InputGroupAddon className="py-0 pl-1.5 text-xs font-normal">
              {widthLabel}
            </InputGroupAddon>
            <InputGroupInput
              aria-label={widthLabel}
              className="h-full w-12 flex-none px-0.5 py-0 text-center text-xs md:text-xs"
              value={branchQuestion.layoutWidth ?? ""}
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
        </ButtonGroup>
        {/* 改行ボタン */}
        {branchQuestion.layoutWidth && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="改行"
                variant="outline"
                size="icon"
                className={`h-7 w-7 text-xs ${branchQuestion.nextPlacement === "break" ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"}`}
                onClick={() => {
                  if (branchQuestion.nextPlacement === "break") {
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
        {branchQuestion.layoutWidth && (
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
                        goUpActive && branchQuestion.goUp! > 0
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
                value={branchQuestion.goUp || ""}
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
                    branchQuestion.goUp == null ||
                    !Number.isInteger(branchQuestion.goUp) ||
                    branchQuestion.goUp < 1 ||
                    branchQuestion.goUp > maxGoUp
                  ) {
                    onUpdate({ goUp: undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault()
                    const cur = branchQuestion.goUp ?? 0
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="枝問を削除"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => actions.deleteBranchQuestion(branchQuestion.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>枝問を削除</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 詳細設定（展開コンテンツ） */}
      {detailOpen && (
        <div className="space-y-2 pt-1">
          <TextElementEditor
            textElements={branchQuestion.textElements}
            onAdd={() => actions.addTextElement(cell)}
            onUpdate={actions.updateTextElement}
            onDelete={actions.deleteTextElement}
            vertical={vertical}
          />
          <ImageElementEditor
            imageElements={branchQuestion.imageElements ?? []}
            onAdd={(imageElement) =>
              actions.addImageElement(cell, imageElement)
            }
            onUpdate={actions.updateImageElement}
            onDelete={actions.deleteImageElement}
            definitionId={definitionId}
          />
          <ManuscriptPaperSettings
            manuscriptPaper={branchQuestion.manuscriptPaper}
            maxColumns={manuscriptMaxColumns}
            verticalLayout={vertical}
            onSetEnabled={(enabled, initialSettings) => {
              actions.setManuscriptPaperEnabled(cell, enabled, initialSettings)
              // 原稿用紙を使い始めたら、横に並ぶよう幅を埋めておく
              if (enabled && !branchQuestion.layoutWidth) {
                onUpdate({ layoutWidth: "1" })
              }
            }}
            onUpdateSettings={actions.updateManuscriptPaper}
            onAddCharGuide={actions.addCharGuide}
            onUpdateCharGuide={actions.updateCharGuide}
            onDeleteCharGuide={actions.deleteCharGuide}
          />
          <OMRCellConfigForm
            config={branchQuestion.omrConfig}
            onChange={(config) =>
              config
                ? actions.upsertOmrConfig(cell, config)
                : actions.deleteOmrConfig(cell)
            }
          />
        </div>
      )}
    </div>
  )
}
