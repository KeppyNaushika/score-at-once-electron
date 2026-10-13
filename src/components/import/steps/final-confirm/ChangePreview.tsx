"use client"

import { ListTree, School, Users } from "lucide-react"

import {
  existingRowsById,
  resolveIdIntegrationRows,
} from "@/components/import/idIntegrationRows"
import { Card, CardContent } from "@/components/ui/card"
import type {
  CategoryIdIntegrationConfig,
  FileOverviewData,
  PreMatchingResult,
} from "@/types/examArchive.types"
import type { ImportAction } from "@/types/importAction.types"

/**
 * この取り込みで書き換わる値の一覧（読み取り専用）
 *
 * **選ぶ画面ではない。** どうするかは取り込みの最初に選んだ方針で決まっていて、
 * ここは「その結果、何がどう変わるか」を実行前に見せるだけ。
 * かつてここは項目ごとに「このPC／ファイル／新しい方」を選ばせる画面だったが、
 * 1回の取り込みに複数の規則が混ざる原因だったので、方針の一本化とともに畳んだ。
 */

/** 値が変わる1項目 */
interface FieldChange {
  fieldLabel: string
  currentValue: unknown
  newValue: unknown
}

/** 値が変わる1行 */
interface ChangedRow {
  importId: string
  displayLabel: string
  fieldChanges: FieldChange[]
}

type ChangeCategory = "student" | "classroom" | "subtotalGroup"

/** 列の見出し（人が読む名前）。ここに無い列は一覧に出さない */
const FIELD_LABELS: Record<ChangeCategory, Record<string, string>> = {
  student: {
    lastName: "姓",
    firstName: "名",
    lastNameKana: "姓カナ",
    firstNameKana: "名カナ",
    studentNumber: "学籍番号",
    enrollmentYear: "入学年度",
  },
  classroom: {
    name: "学級名",
    classroomCode: "学級コード",
    grade: "学年",
    description: "説明",
    isVisible: "表示設定",
  },
  subtotalGroup: {
    name: "グループ名",
  },
}

/** 表示用の文字列にする（空は「（なし）」、真偽は表示/非表示の言い方に寄せる） */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "（なし）"
  if (typeof value === "boolean") return value ? "表示する" : "表示しない"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  return "（表示できない値）"
}

/** アーカイブと既存で食い違う列を拾う */
function detectFieldChanges(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown> | undefined,
  category: ChangeCategory
): FieldChange[] {
  if (!existingData) return []

  const changes: FieldChange[] = []
  for (const [field, fieldLabel] of Object.entries(FIELD_LABELS[category])) {
    const importValue = importData[field]
    const existingValue = existingData[field]
    if (importValue === existingValue) continue

    // 空同士（null / undefined / 空文字）の違いは変更として数えない
    const importEmpty =
      importValue === null || importValue === undefined || importValue === ""
    const existingEmpty =
      existingValue === null ||
      existingValue === undefined ||
      existingValue === ""
    if (importEmpty && existingEmpty) continue

    changes.push({
      fieldLabel,
      currentValue: existingValue,
      newValue: importValue,
    })
  }
  return changes
}

/** 時刻の値（Date または ISO 文字列）をミリ秒にする。読めなければ null */
function timeOf(moment: unknown): number | null {
  const parsed =
    moment instanceof Date
      ? moment
      : typeof moment === "string"
        ? new Date(moment)
        : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null
}

/** アーカイブの行が既存の行より後に書かれているか（統合するときの判定） */
function isArchiveNewer(linked: LinkedRow): boolean {
  const importUpdatedAt = timeOf(linked.importData.updatedAt)
  const existingUpdatedAt = timeOf(linked.existingData?.updatedAt)
  if (importUpdatedAt === null) return false
  if (existingUpdatedAt === null) return true
  return importUpdatedAt > existingUpdatedAt
}

/** 同じ実体だと決まった（＝既存の行に書き込む）組み合わせ */
interface LinkedRow {
  importId: string
  displayLabel: string
  importData: Record<string, unknown>
  existingData: Record<string, unknown> | undefined
}

/** 同じ実体だと決まった組み合わせを集める（取り込み時と同じ決まり） */
function collectLinkedItems(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig
): LinkedRow[] {
  const existingRows = existingRowsById(preMatch)
  return [
    ...preMatch.byId.map((match) => ({
      importId: match.importId,
      displayLabel: match.displayLabel,
      importData: match.importData,
      existingData: match.existingData,
    })),
    ...resolveIdIntegrationRows(preMatch, config).flatMap((row) =>
      row.decision.decisionType === "same_person" && row.decision.existingId
        ? [
            {
              importId: row.importId,
              displayLabel: row.displayLabel,
              importData: row.importData,
              existingData: existingRows.get(row.decision.existingId),
            },
          ]
        : []
    ),
  ]
}

/** 実際に書き換わる行だけを返す */
function collectChangedRows(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig,
  category: ChangeCategory,
  action: ImportAction
): ChangedRow[] {
  // 「別で追加する」は今あるものに手を触れない
  if (action === "separate") return []

  const rows: ChangedRow[] = []
  for (const match of collectLinkedItems(preMatch, config)) {
    if (action === "merge" && !isArchiveNewer(match)) continue

    const fieldChanges = detectFieldChanges(
      match.importData,
      match.existingData,
      category
    )
    if (fieldChanges.length === 0) continue

    rows.push({
      importId: match.importId,
      displayLabel: match.displayLabel,
      fieldChanges,
    })
  }
  return rows
}

interface ChangePreviewProps {
  fileOverviewData: FileOverviewData
  studentConfig: CategoryIdIntegrationConfig
  classroomConfig: CategoryIdIntegrationConfig
  subtotalGroupConfig: CategoryIdIntegrationConfig
  action: ImportAction
}

export function ChangePreview({
  fileOverviewData,
  studentConfig,
  classroomConfig,
  subtotalGroupConfig,
  action,
}: ChangePreviewProps) {
  const sections = [
    {
      category: "student" as const,
      icon: <Users className="h-5 w-5" />,
      title: "生徒",
      rows: collectChangedRows(
        fileOverviewData.student,
        studentConfig,
        "student",
        action
      ),
    },
    {
      category: "classroom" as const,
      icon: <School className="h-5 w-5" />,
      title: "学級",
      rows: collectChangedRows(
        fileOverviewData.classroom,
        classroomConfig,
        "classroom",
        action
      ),
    },
    {
      category: "subtotalGroup" as const,
      icon: <ListTree className="h-5 w-5" />,
      title: "小計点グループ",
      rows: collectChangedRows(
        fileOverviewData.subtotalGroup,
        subtotalGroupConfig,
        "subtotalGroup",
        action
      ),
    },
  ].filter((section) => section.rows.length > 0)

  if (sections.length === 0) return null

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h4 className="font-medium">このPCの情報が書き換わるもの</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {action === "overwrite"
              ? "「上書きする」を選んだので、時刻を見ずに取り込む内容へ置き換えます。"
              : "「新しい方を残す」を選んだので、取り込む方が後に書かれているものだけ置き換えます。"}
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.category} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-muted-foreground">{section.icon}</span>
              {section.title}（{section.rows.length}件）
            </div>
            <ul className="space-y-1 text-sm">
              {section.rows.map((row) => (
                <li key={row.importId} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {row.displayLabel}
                  </span>
                  {": "}
                  {row.fieldChanges
                    .map(
                      (fieldChange) =>
                        `${fieldChange.fieldLabel} ${formatValue(fieldChange.currentValue)} → ${formatValue(fieldChange.newValue)}`
                    )
                    .join(" / ")}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
