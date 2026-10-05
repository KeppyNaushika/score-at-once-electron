"use client"

import {
  Circle,
  Eye,
  Minus,
  Plus,
  RectangleHorizontal,
  Star,
  Type,
} from "lucide-react"

import { TooltipButton } from "@/components/common/TooltipButton"
import { useScoringAnonymity } from "@/components/exams/07-score-at-once/anonymity/ScoringAnonymityContext"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

import type { AnnotationDisplayItem } from "./hooks/useAnnotationBrowser"

// アノテーションタイプのアイコン
function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "text":
      return <Type className="h-3.5 w-3.5" />
    case "line":
      return <Minus className="h-3.5 w-3.5" />
    case "rectangle":
      return <RectangleHorizontal className="h-3.5 w-3.5" />
    case "ellipse":
      return <Circle className="h-3.5 w-3.5" />
    default:
      return null
  }
}

// アノテーションの説明テキスト
function getDescription(annotation: AnnotationWithContext): string {
  if (annotation.type === "text") {
    const text = annotation.text || ""
    return text.length > 20 ? text.substring(0, 20) + "…" : text || "(空)"
  }
  const typeNames: Record<string, string> = {
    line: "直線",
    rectangle: "長方形",
    ellipse: "楕円",
  }
  return typeNames[annotation.type] || annotation.type
}

// ソース情報（設問 + 生徒）。生徒の呼び方は匿名採点かどうかで変わるので外から受ける
function getSourceInfo(
  annotation: AnnotationWithContext,
  studentLabel: string | null
): string {
  const parts: string[] = []
  if (annotation.questionScore?.cropRegion?.label) {
    parts.push(annotation.questionScore.cropRegion.label)
  }
  if (studentLabel) {
    parts.push(studentLabel)
  }
  return parts.join(" / ") || "—"
}

/** 手書きの一覧の1行（種類・説明・出どころ・お気に入り・移動・追加） */
export function AnnotationBrowserItem({
  item,
  allAnnotations,
  onToggleFavorite,
  onNavigateTo,
  onAdd,
}: {
  item: AnnotationDisplayItem
  allAnnotations: AnnotationWithContext[]
  onToggleFavorite: (annotationId: string, isFavorite: boolean) => void
  onNavigateTo?: (examStudentId: string, cropRegionId: string) => void
  onAdd: (item: AnnotationDisplayItem) => void
}) {
  const { isAnonymous, pseudonymOf } = useScoringAnonymity()
  /**
   * 手書きの出どころの生徒の呼び方。匿名採点のあいだは仮の名前だけを出す
   * （番号を出すと名簿と突き合わせられる）
   */
  const studentLabelOf = (
    annotation: AnnotationWithContext,
    withStudentNumber: boolean
  ): string | null => {
    const examStudent = annotation.questionScore?.examStudent
    if (!examStudent?.student) return null
    if (isAnonymous) return pseudonymOf(examStudent.id)
    const { student } = examStudent
    const name = `${student.lastName}${student.firstName}`
    return withStudentNumber ? `${student.studentNumber} ${name}` : name
  }

  return (
    <div
      key={item.representative.id}
      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
    >
      {/* タイプアイコン */}
      <div className="shrink-0 text-gray-500">
        <TypeIcon type={item.representative.type} />
      </div>

      {/* 説明 + ソース */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">
          {getDescription(item.representative)}
        </div>
        <div className="truncate text-xs text-gray-400">
          {getSourceInfo(
            item.representative,
            studentLabelOf(item.representative, false)
          )}
        </div>
      </div>

      {/* 色ドット */}
      <div
        className="h-3 w-3 shrink-0 rounded-full border border-gray-200"
        style={{ backgroundColor: item.representative.color }}
      />

      {/* 件数バッジ */}
      {item.count > 1 && (
        <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
          ×{item.count}
        </span>
      )}

      {/* 星アイコン */}
      <button
        className="shrink-0 text-gray-400 hover:text-yellow-500"
        onClick={() =>
          onToggleFavorite(item.representative.id, item.isFavorite)
        }
      >
        <Star
          className={cn(
            "h-3.5 w-3.5",
            item.isFavorite && "fill-yellow-400 text-yellow-400"
          )}
        />
      </button>

      {/* 移動ボタン（左クリック: 代表に移動, 右クリック: 生徒選択メニュー） */}
      {onNavigateTo &&
        item.representative.questionScore?.examStudentId &&
        item.representative.questionScore?.cropRegionId &&
        (item.count > 1 ? (
          <ContextMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-blue-500"
                    aria-label="クリック: 移動 / 右クリック: 生徒選択"
                    onClick={() =>
                      onNavigateTo(
                        item.representative.questionScore!.examStudentId!,
                        item.representative.questionScore!.cropRegionId!
                      )
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                クリック: 移動 / 右クリック: 生徒選択
              </TooltipContent>
            </Tooltip>
            <ContextMenuContent>
              {item.allIds
                .map((id) =>
                  allAnnotations.find((annotation) => annotation.id === id)
                )
                .filter(
                  (annotation): annotation is AnnotationWithContext =>
                    !!annotation?.questionScore?.examStudentId &&
                    !!annotation?.questionScore?.cropRegionId
                )
                .map((annotation) => {
                  const label =
                    studentLabelOf(annotation, true) ??
                    annotation.questionScore!.examStudentId!.slice(0, 8)
                  const question =
                    annotation.questionScore!.cropRegion?.label ?? ""
                  return (
                    <ContextMenuItem
                      key={annotation.id}
                      onClick={() =>
                        onNavigateTo(
                          annotation.questionScore!.examStudentId!,
                          annotation.questionScore!.cropRegionId!
                        )
                      }
                    >
                      {label}
                      {question && (
                        <span className="text-xs text-gray-400">
                          {question}
                        </span>
                      )}
                    </ContextMenuItem>
                  )
                })}
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          <TooltipButton
            label="この生徒・設問に移動"

            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-blue-500"
            onClick={() =>
              onNavigateTo(
                item.representative.questionScore!.examStudentId!,
                item.representative.questionScore!.cropRegionId!
              )
            }
          >
            <Eye className="h-3.5 w-3.5" />
          </TooltipButton>
        ))}

      {/* 追加ボタン */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-1.5"
        onClick={() => onAdd(item)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
