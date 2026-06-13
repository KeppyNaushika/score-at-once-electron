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
import { Switch } from "@/components/ui/switch"
import type {
  BranchQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import { BranchQuestionForm } from "./BranchQuestionForm"
import { ImageElementEditor } from "./ImageElementEditor"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import { TextElementEditor } from "./TextElementEditor"

/** 簡易分数パース (例: "1/3" → 0.333) */
function parseFractionSimple(s: string): number {
  const m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return parseInt(m[1]) / parseInt(m[2])
  const n = parseFloat(s)
  return isNaN(n) ? 1 : n
}

/** 各枝問の maxGoUp (= その枝問の goUp 適用前の行インデックス) を計算 */
function calcBranchMaxGoUps(branches: BranchQuestion[]): number[] {
  const result: number[] = []
  let row = 0
  let curX = 0
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]
    const w = parseFractionSimple(b.layoutWidth ?? "1")

    // auto-break
    if (curX > 1e-9 && curX + w > 1 + 1e-9) {
      row++
      curX = 0
    }

    // maxGoUp = goUp 適用前の行インデックス
    result.push(row)

    // goUp 適用
    if (b.goUp != null && b.goUp > 0) {
      row = Math.max(0, row - b.goUp)
      curX = 0.5
    }

    curX += w

    if (b.nextPlacement === "break") {
      row++
      curX = 0
    }
  }
  return result
}

interface SubQuestionFormProps {
  sub: SubQuestion
  majorIndex: number
  subIndex: number
  totalSubCount: number
  maxGoUp: number
  definitionId: string
  onUpdate: (data: Partial<SubQuestion>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onAddBranch: () => void
  onUpdateBranch: (branchIndex: number, data: Partial<BranchQuestion>) => void
  onDeleteBranch: (branchIndex: number) => void
  onReorderBranch: (fromIndex: number, toIndex: number) => void
  /** 縦書きレイアウトか（高さ/幅ラベルの表示を入れ替える） */
  vertical?: boolean
}

export function SubQuestionForm({
  sub,
  maxGoUp,
  definitionId,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
  onReorderBranch,
  vertical = false,
}: SubQuestionFormProps) {
  const hasBranches = sub.branchQuestions.length > 0
  const [detailOpen, setDetailOpen] = useState(false)
  // 縦書きでは見た目の高さ/幅が入れ替わるためラベルだけ入れ替える（内部値は不変）
  const heightLabel = vertical ? "幅" : "高さ"
  const widthLabel = vertical ? "高さ" : "幅"

  const hasDetailContent =
    sub.textElements.length > 0 ||
    (sub.imageElements?.length ?? 0) > 0 ||
    !!sub.manuscriptPaper?.enabled

  const hasVisibilityRestricted = sub.imageElements?.some(
    (ie) => ie.visibility && ie.visibility !== "both"
  )

  const branchMaxGoUps = useMemo(
    () => calcBranchMaxGoUps(sub.branchQuestions),
    [sub.branchQuestions]
  )

  const isManuscriptPaper = !!sub.manuscriptPaper?.enabled && !hasBranches
  const participatesInHorizontal = !!sub.layoutWidth || isManuscriptPaper

  const goUpActive = sub.goUp != null
  const isGoUpInvalid =
    goUpActive &&
    (!Number.isInteger(sub.goUp) || sub.goUp! < 1 || sub.goUp! > maxGoUp)

  return (
    <div className="border-primary/30 space-y-1 border-l-2 pl-4">
      {/* 小問ヘッダー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-7 items-center divide-x overflow-hidden rounded-md border text-xs">
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="text-muted-foreground">番号</span>
            <input
              className="focus:bg-accent/50 w-10 bg-transparent px-0.5 text-center outline-none"
              value={sub.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              aria-label="小問番号"
            />
          </div>
          {/* 配点: 枝問なし or 完答モード(usesBranchPoints=false)の時に表示 */}
          {(!hasBranches || sub.usesBranchPoints === false) && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">配点</span>
              <input
                type="number"
                aria-label="配点"
                className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={sub.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </div>
          )}
          {/* 高さ: 枝問なしの時のみ（縦書き時はラベルを「幅」に） */}
          {!hasBranches && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">{heightLabel}</span>
              <input
                type="number"
                aria-label={heightLabel}
                className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={sub.heightMultiplier}
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
            </div>
          )}
          {/* 幅 (layoutWidth) - 原稿用紙有効時は列数から自動計算のため非表示。縦書き時はラベルを「高さ」に */}
          {!isManuscriptPaper && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">{widthLabel}</span>
              <input
                aria-label={widthLabel}
                className="focus:bg-accent/50 w-10 bg-transparent px-0.5 text-center outline-none"
                value={sub.layoutWidth ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (v === "") {
                    onUpdate({
                      layoutWidth: undefined,
                      nextPlacement: undefined,
                      goUp: undefined,
                    })
                  } else {
                    onUpdate({ layoutWidth: v })
                  }
                }}
                placeholder="—"
              />
            </div>
          )}
        </div>
        {/* 改行ボタン */}
        {participatesInHorizontal && (
          <Button
            variant="outline"
            size="icon"
            className={`h-7 w-7 text-xs ${sub.nextPlacement === "break" ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20" : "text-muted-foreground"}`}
            onClick={() => {
              if (sub.nextPlacement === "break") {
                onUpdate({ nextPlacement: undefined })
              } else {
                onUpdate({ nextPlacement: "break" })
              }
            }}
            title="改行"
          >
            ↵
          </Button>
        )}
        {/* 戻るボタン（自分自身をN行上に配置） */}
        {participatesInHorizontal && (
          <div className="inline-flex items-center gap-0">
            <Button
              variant="outline"
              size="icon"
              className={`h-7 w-7 text-xs ${goUpActive && sub.goUp! > 0 ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20" : "text-muted-foreground"} ${goUpActive ? "rounded-r-none" : ""}`}
              onClick={() => {
                if (goUpActive) {
                  onUpdate({ goUp: undefined })
                } else {
                  onUpdate({ goUp: Math.min(1, maxGoUp) })
                }
              }}
              disabled={!goUpActive && maxGoUp < 1}
              title={
                maxGoUp < 1
                  ? "戻れる行がありません"
                  : `N行上に戻して配置 (最大${maxGoUp})`
              }
            >
              ↑
            </Button>
            {goUpActive && (
              <input
                type="number"
                aria-label="戻り行数"
                className={`border-primary/50 h-7 w-8 [appearance:textfield] rounded-r-md border border-l-0 px-0.5 text-center text-xs outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isGoUpInvalid ? "bg-red-100 dark:bg-red-900/30" : "bg-transparent"}`}
                value={sub.goUp || ""}
                min={1}
                max={maxGoUp}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "") {
                    onUpdate({ goUp: 0 })
                  } else {
                    onUpdate({ goUp: Number(v) })
                  }
                }}
                onBlur={() => {
                  if (
                    sub.goUp == null ||
                    !Number.isInteger(sub.goUp) ||
                    sub.goUp < 1 ||
                    sub.goUp > maxGoUp
                  ) {
                    onUpdate({ goUp: undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault()
                    const cur = sub.goUp ?? 0
                    const next = e.key === "ArrowUp" ? cur + 1 : cur - 1
                    if (next >= 1 && next <= maxGoUp) {
                      onUpdate({ goUp: next })
                    }
                  }
                }}
              />
            )}
          </div>
        )}

        {/* 枝問配点スイッチ（枝問がある場合のみ） */}
        {hasBranches && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              枝問配点
            </span>
            <Switch
              className="scale-75"
              checked={sub.usesBranchPoints !== false}
              onCheckedChange={(v) => onUpdate({ usesBranchPoints: v })}
            />
          </div>
        )}

        {/* アクションボタン */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-7 w-7 rounded-r-none"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="上へ移動"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-7 w-7 rounded-l-none border-l"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              title="下へ移動"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!hasBranches && (
            <Button
              variant="ghost"
              size="icon"
              className={`relative h-7 w-7 ${hasVisibilityRestricted ? "text-orange-500" : detailOpen ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setDetailOpen(!detailOpen)}
              title="詳細設定"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {hasDetailContent && (
                <span
                  className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${hasVisibilityRestricted ? "bg-orange-500" : "bg-primary"}`}
                />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary h-7 w-7"
            onClick={onAddBranch}
            title="枝問を追加"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={onDelete}
            title="小問を削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 枝問なし: 詳細設定（展開コンテンツ） */}
      {!hasBranches && detailOpen && (
        <div className="space-y-2 pt-1">
          <TextElementEditor
            textElements={sub.textElements}
            onUpdate={(elements) => onUpdate({ textElements: elements })}
            vertical={vertical}
          />
          <ImageElementEditor
            imageElements={sub.imageElements ?? []}
            onUpdate={(elements) => onUpdate({ imageElements: elements })}
            definitionId={definitionId}
          />
          <ManuscriptPaperSettings
            config={sub.manuscriptPaper}
            onUpdate={(config) => {
              const updates: Partial<SubQuestion> = { manuscriptPaper: config }
              // 原稿用紙有効化時にlayoutWidthが未設定なら自動設定（横配置参加のため）
              if (config.enabled && !sub.layoutWidth) {
                updates.layoutWidth = "1"
              }
              onUpdate(updates)
            }}
          />
          <OMRCellConfigForm
            config={sub.omrConfig}
            onChange={(config) => onUpdate({ omrConfig: config })}
          />
        </div>
      )}

      {/* 枝問リスト */}
      {hasBranches && (
        <div className="space-y-0.5">
          {sub.branchQuestions.map((branch, bi) => (
            <BranchQuestionForm
              key={branch.id}
              branch={branch}
              branchIndex={bi}
              totalBranchCount={sub.branchQuestions.length}
              showPoints={sub.usesBranchPoints !== false}
              maxGoUp={branchMaxGoUps[bi]}
              definitionId={definitionId}
              onUpdate={(data) => onUpdateBranch(bi, data)}
              onDelete={() => onDeleteBranch(bi)}
              onMoveUp={bi > 0 ? () => onReorderBranch(bi, bi - 1) : undefined}
              onMoveDown={
                bi < sub.branchQuestions.length - 1
                  ? () => onReorderBranch(bi, bi + 1)
                  : undefined
              }
              vertical={vertical}
            />
          ))}
        </div>
      )}
    </div>
  )
}
