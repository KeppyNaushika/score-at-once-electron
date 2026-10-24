"use client"

import type { Subtotal } from "@prisma/client"
import {
  FileText,
  Group,
  ListOrdered,
  ListTree,
  type LucideIcon,
  RotateCcw,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { CheckboxCellWithFillHandle } from "@/components/exams/shared/CheckboxCellWithFillHandle"
import { useFillHandleDrag } from "@/components/exams/shared/useFillHandleDrag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"
import type { SubtotalGroupWithSubtotals } from "@/electron-src/lib/prisma/subtotalGroup"
import { cn } from "@/lib/utils"

import { useCropSubtotalAssignments } from "../hooks/useCropSubtotalAssignments"

/** 紐付けの種類ごとに変わる見た目と文言 */
interface AssignmentTypePresentation {
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyHint: string
  headerTitle: string
  tableTitle: string
  rowHeading: string
  /** 小計グループの列見出しの配色 */
  groupHeadClassName: string
  groupHeadTextClassName: string
  /** 行見出し（領域名）。ラベルが無いときの既定名も含む */
  renderRowLabel: (cropRegion: CropRegionWithSubtotals) => string
  /** 行見出しの右に添えるバッジ */
  renderRowBadge: (cropRegion: CropRegionWithSubtotals) => ReactNode
  explanationClassName: string
  explanationTitleClassName: string
  explanationTitle: string
  /** 種類固有の説明（フィル操作と自動保存の説明は共通で後ろに続く） */
  explanationItems: ReactNode
}

const PRESENTATION_BY_ASSIGNMENT_TYPE: Record<
  CropSubtotalAssignmentType,
  AssignmentTypePresentation
> = {
  QUESTION_ASSIGNMENT: {
    emptyIcon: FileText,
    emptyTitle: "設問がありません",
    emptyHint: "採点領域から設問を作成してください",
    headerTitle: "設問と小計項目の対応付け",
    tableTitle: "対応表",
    rowHeading: "設問",
    groupHeadClassName: "border-blue-200 bg-blue-50/50",
    groupHeadTextClassName: "text-blue-700",
    renderRowLabel: (cropRegion) =>
      cropRegion.label || `問${cropRegion.orderIndex || 1}`,
    renderRowBadge: (cropRegion) => (
      <Badge variant="outline" className="shrink-0 text-xs">
        {cropRegion.points || 0}
      </Badge>
    ),
    explanationClassName: "bg-muted/50",
    explanationTitleClassName: "",
    explanationTitle: "使い方:",
    explanationItems: (
      <>
        <li>
          • 各設問に対して、対応付けたい小計項目にチェックを入れてください
        </li>
        <li>• 一つの設問は複数の小計項目に対応付けることができます</li>
        <li>• 例: 「問1」を「大問1」と「知識・理解」の両方に対応付け可能</li>
      </>
    ),
  },
  SUBTOTAL_DEFINITION: {
    emptyIcon: ListOrdered,
    emptyTitle: "小計の領域がありません",
    emptyHint: "採点領域から小計の領域を作成してください",
    headerTitle: "小計の領域と小計項目の対応付け",
    tableTitle: "小計点の対応表",
    rowHeading: "小計の領域",
    groupHeadClassName: "border-green-200 bg-green-50/50",
    groupHeadTextClassName: "text-green-700",
    renderRowLabel: (cropRegion) =>
      cropRegion.label || `小計${cropRegion.orderIndex || 1}`,
    renderRowBadge: () => (
      <Badge
        variant="outline"
        className="shrink-0 bg-green-50 text-xs text-green-700"
      >
        小計点
      </Badge>
    ),
    explanationClassName: "bg-green-50",
    explanationTitleClassName: "text-green-800",
    explanationTitle: "計算ロジック:",
    explanationItems: (
      <>
        <li>
          • <strong>グループ内はOR条件</strong>:
          同じグループ内のいずれかの項目に該当する設問の合計
        </li>
        <li>
          • <strong>グループ間はAND条件</strong>:
          複数グループを選択した場合、すべてのグループに該当する設問の合計
        </li>
        <li>
          • 例: 「大問1」OR「大問2」の設問 AND 「知識・理解」の設問 =
          該当する設問の合計点
        </li>
      </>
    ),
  },
}

interface CropSubtotalAssignmentTableProps {
  examId: string
  subtotalGroups: SubtotalGroupWithSubtotals[]
  /** この表が書き込む紐付けの種類。行に並べる領域の種類もこれで決まる */
  assignmentType: CropSubtotalAssignmentType
  /**
   * 行に並べる領域（設問割当なら設問領域 QUESTION_ANSWER、小計定義なら
   * 小計欄領域 SUBTOTAL_SCORE）。割り当ての出所でもある
   */
  cropRegions: CropRegionWithSubtotals[]
  /** 保存済みの割り当てを取り直す */
  onReload: () => void
}

/** 採点領域（設問・小計欄）と小計項目の紐付けを、フィルハンドル付きのチェック表で編集する */
export function CropSubtotalAssignmentTable({
  examId,
  subtotalGroups,
  assignmentType,
  cropRegions,
  onReload,
}: CropSubtotalAssignmentTableProps) {
  const presentation = PRESENTATION_BY_ASSIGNMENT_TYPE[assignmentType]
  const EmptyIcon = presentation.emptyIcon

  // 選択されたセルの状態（rowId-colId形式）
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  // 全ての小計項目をフラットな配列に変換（列データ）
  const allSubtotals = subtotalGroups.flatMap((group) => group.subtotals)

  const { isAssigned, saving, setCellAssignment, fillCells } =
    useCropSubtotalAssignments({
      examId,
      assignmentType,
    })

  // フィルハンドルのドラッグ管理
  const {
    handleFillHandlePointerDown,
    handleCellPointerEnter,
    handlePointerUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: cropRegions,
    cols: allSubtotals,
    onFillComplete: fillCells,
  })

  // セル選択
  const handleCellClick = (rowId: string, colId: string) => {
    const cellKey = `${rowId}-${colId}`
    setSelectedCell(cellKey)
  }

  // セルが選択されているか判定
  const isCellSelected = (rowId: string, colId: string): boolean => {
    return selectedCell === `${rowId}-${colId}`
  }

  if (subtotalGroups.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <ListTree className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点がありません</p>
        <p className="text-sm">まず小計点と項目を作成してください</p>
      </div>
    )
  }

  if (cropRegions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <EmptyIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>{presentation.emptyTitle}</p>
        <p className="text-sm">{presentation.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Group className="h-5 w-5" />
          <span className="font-medium">{presentation.headerTitle}</span>
          {saving && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-xs text-blue-700"
            >
              保存中...
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            リセット
          </Button>
        </div>
      </div>

      {/* 対応表 */}
      <div className="rounded-lg border">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h3 className="text-base font-medium">{presentation.tableTitle}</h3>
        </div>
        <div
          className="relative min-h-96 w-full overflow-auto"
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <Table className="w-auto" style={{ width: "fit-content" }}>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="sticky top-0 left-0 z-30 border-r-2 border-gray-200 bg-white px-2 py-1 text-center"
                  style={{
                    width: "128px",
                    minWidth: "128px",
                    maxWidth: "128px",
                  }}
                >
                  {presentation.rowHeading}
                </TableHead>
                {subtotalGroups.map((group) => (
                  <TableHead
                    key={group.id}
                    className={cn(
                      "sticky top-0 z-20 border-l-2 text-center",
                      presentation.groupHeadClassName
                    )}
                    colSpan={group.subtotals.length}
                  >
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        presentation.groupHeadTextClassName
                      )}
                    >
                      {group.name}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead
                  className="sticky top-10.25 left-0 z-30 border-r-2 border-gray-200 bg-white"
                  style={{
                    width: "128px",
                    minWidth: "128px",
                    maxWidth: "128px",
                  }}
                >
                  {/* 空のセル */}
                </TableHead>
                {subtotalGroups.map((group) =>
                  group.subtotals.map((subtotal: Subtotal) => (
                    <TableHead
                      key={subtotal.id}
                      className="sticky top-10.25 z-20 bg-gray-50/50 px-2 text-center"
                    >
                      <div className="text-xs text-muted-foreground">
                        {subtotal.name}
                      </div>
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cropRegions.map((region, rowIndex) => (
                <TableRow key={region.id}>
                  <TableCell
                    className="sticky left-0 z-10 border-r-2 border-gray-200 bg-white px-2 py-1"
                    style={{
                      width: "128px",
                      minWidth: "128px",
                      maxWidth: "128px",
                    }}
                  >
                    <div className="flex items-center gap-1 overflow-hidden">
                      <div className="flex-1 text-sm font-medium">
                        {presentation.renderRowLabel(region)}
                      </div>
                      {presentation.renderRowBadge(region)}
                    </div>
                  </TableCell>
                  {(() => {
                    let colIndex = 0
                    return subtotalGroups.map((group) =>
                      group.subtotals.map((subtotal: Subtotal) => {
                        const currentColIndex = colIndex++
                        return (
                          <TableCell
                            key={subtotal.id}
                            className="p-0 text-center"
                            onPointerEnter={() =>
                              handleCellPointerEnter({
                                row: region,
                                col: subtotal,
                                rowIndex,
                                colIndex: currentColIndex,
                              })
                            }
                          >
                            <CheckboxCellWithFillHandle
                              checked={isAssigned(region, subtotal)}
                              onChange={(checked) =>
                                setCellAssignment(region, subtotal, checked)
                              }
                              onFillHandleDragStart={(e, initialValue) => {
                                e.preventDefault()
                                handleFillHandlePointerDown(
                                  {
                                    row: region,
                                    col: subtotal,
                                    rowIndex,
                                    colIndex: currentColIndex,
                                  },
                                  initialValue
                                )
                              }}
                              onCellClick={() =>
                                handleCellClick(region.id, subtotal.id)
                              }
                              isSelected={isCellSelected(
                                region.id,
                                subtotal.id
                              )}
                              disabled={saving}
                              isInFillRange={isInFillRange(region, subtotal)}
                              disableFillHandle={false}
                            />
                          </TableCell>
                        )
                      })
                    )
                  })()}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 説明 */}
      <div
        className={cn(
          "rounded-lg p-4 text-sm text-muted-foreground",
          presentation.explanationClassName
        )}
      >
        <h4
          className={cn(
            "mb-2 font-medium",
            presentation.explanationTitleClassName
          )}
        >
          {presentation.explanationTitle}
        </h4>
        <ul className="ml-4 space-y-1">
          {presentation.explanationItems}
          <li>
            •{" "}
            <strong>
              セルの右下角（フィルハンドル）をドラッグして範囲コピーできます
            </strong>
            （Excel風）
          </li>
          <li>
            • <strong>変更は自動で保存されます</strong>（逐次保存）
          </li>
        </ul>
      </div>
    </div>
  )
}
