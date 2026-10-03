"use client"

import { Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  AsbBranchQuestionAttributes,
  BranchQuestion,
} from "@/types/answerSheetDefinition.types"

import type { AsbEditorActions } from "../../types"
import { ImageElementEditor } from "./ImageElementEditor"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import {
  DetailToggleButton,
  LayoutWidthField,
  MoveButtons,
  PlacementControls,
  QuestionNumberField,
  QuestionTextField,
} from "./QuestionRowFields"
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

  const hasVisibilityRestricted =
    branchQuestion.imageElements?.some(
      (imageElement) =>
        imageElement.visibility && imageElement.visibility !== "both"
    ) ?? false

  return (
    <div className="ml-4 space-y-1 border-l-2 border-muted-foreground/20 py-1 pl-4">
      {/* 基本設定行 */}
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <QuestionTextField
            label="番号"
            ariaLabel="枝問番号"
            value={branchQuestion.label}
            onChange={(label) => onUpdate({ label })}
          />
          {showPoints && (
            <QuestionNumberField
              label="配点"
              value={branchQuestion.points}
              min={0}
              max={100}
              onChange={(points) => onUpdate({ points })}
            />
          )}
          <QuestionNumberField
            label={heightLabel}
            value={branchQuestion.heightMultiplier}
            min={1}
            max={30}
            step={0.5}
            onChange={(heightMultiplier) => onUpdate({ heightMultiplier })}
          />
          <LayoutWidthField
            label={widthLabel}
            layoutWidth={branchQuestion.layoutWidth}
            onUpdate={onUpdate}
          />
        </ButtonGroup>
        {/* 改行・戻る（自分自身をN行上に配置）は横に並べるときだけ */}
        {branchQuestion.layoutWidth && (
          <PlacementControls
            nextPlacement={branchQuestion.nextPlacement}
            goUp={branchQuestion.goUp}
            maxGoUp={maxGoUp}
            onUpdate={onUpdate}
          />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <MoveButtons onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          <DetailToggleButton
            open={detailOpen}
            onToggle={() => setDetailOpen(!detailOpen)}
            hasContent={hasDetailContent}
            visibilityRestricted={hasVisibilityRestricted}
          />
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
