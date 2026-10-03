"use client"

import { GitBranch, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { ButtonGroup } from "@/components/ui/button-group"
import { Switch } from "@/components/ui/switch"
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
import {
  DetailToggleButton,
  LayoutWidthField,
  MoveButtons,
  PlacementControls,
  QuestionNumberField,
  QuestionTextField,
} from "./QuestionRowFields"
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

  const hasVisibilityRestricted =
    subQuestion.imageElements?.some(
      (imageElement) =>
        imageElement.visibility && imageElement.visibility !== "both"
    ) ?? false

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

  return (
    <div className="space-y-1 border-l-2 border-primary/30 pl-4">
      {/* 小問ヘッダー */}
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <QuestionTextField
            label="番号"
            ariaLabel="小問番号"
            value={subQuestion.label}
            onChange={(label) => onUpdate({ label })}
          />
          {/* 配点: 枝問なし or 完答モード(usesBranchPoints=false)の時に表示 */}
          {(!hasBranches || subQuestion.usesBranchPoints === false) && (
            <QuestionNumberField
              label="配点"
              value={subQuestion.points}
              min={0}
              max={100}
              onChange={(points) => onUpdate({ points })}
            />
          )}
          {/* 高さ: 枝問なしの時のみ（縦書き時はラベルを「幅」に） */}
          {!hasBranches && (
            <QuestionNumberField
              label={heightLabel}
              value={subQuestion.heightMultiplier}
              min={1}
              max={30}
              step={0.5}
              onChange={(heightMultiplier) => onUpdate({ heightMultiplier })}
            />
          )}
          {/* 幅 (layoutWidth) - 原稿用紙有効時は列数から自動計算のため非表示。縦書き時はラベルを「高さ」に */}
          {!isManuscriptPaper && (
            <LayoutWidthField
              label={widthLabel}
              layoutWidth={subQuestion.layoutWidth}
              onUpdate={onUpdate}
            />
          )}
        </ButtonGroup>
        {/* 改行・戻る（自分自身をN行上に配置）は横に並べるときだけ */}
        {participatesInHorizontal && (
          <PlacementControls
            nextPlacement={subQuestion.nextPlacement}
            goUp={subQuestion.goUp}
            maxGoUp={maxGoUp}
            onUpdate={onUpdate}
          />
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
          <MoveButtons onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          {!hasBranches && (
            <DetailToggleButton
              open={detailOpen}
              onToggle={() => setDetailOpen(!detailOpen)}
              hasContent={hasDetailContent}
              visibilityRestricted={hasVisibilityRestricted}
            />
          )}
          <TooltipButton
            label="枝問を追加"

            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={() => actions.addBranchQuestion(subQuestion.id)}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </TooltipButton>
          <TooltipButton
            label="小問を削除"

            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => actions.deleteSubQuestion(subQuestion.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </TooltipButton>
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
