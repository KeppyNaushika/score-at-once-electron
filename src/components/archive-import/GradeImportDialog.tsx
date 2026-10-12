"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { executeGradeImportMutation } from "@/queries/grade"
import type { GradeArchiveImportPreview } from "@/types/gradeArchive.types"

import { CourseworkDecisionList } from "./CourseworkDecisionList"
import { useCourseworkImportDecisions } from "./hooks/useCourseworkImportDecisions"
import { ImportWarningList } from "./ImportWarningList"
import { LegacyArchiveImportDialogFrame } from "./LegacyArchiveImportDialogFrame"
import { toastImportWarnings } from "./toastImportWarnings"

interface GradeImportDialogProps {
  /** 取り込むファイル。中身は持たず、実行時に main が読み直す */
  archivePath: string
  /** 一覧の「読み込み」でファイルを読んだときの照合の結果 */
  preview: GradeArchiveImportPreview
  /** 取り込んだとき・やめたとき */
  onClose: () => void
}

/**
 * 成績アーカイブのインポート確認ウィザード
 *
 * 学級/試験/生徒の照合結果を提示し、埋め込み資料（Coursework）ごとに
 * 「既存に取り込む（uuid一致 / 名前候補）」か「新規作成」かをユーザーに判断させる。
 * uuid一致があれば既定で統合、無ければ新規作成を初期選択にする。
 *
 * 一覧の「読み込み」で .grade を選んだときに開く（ファイルは選び終えている）。
 * 取り込んだら、その成績算出の概要へ移る。
 */
export function GradeImportDialog({
  archivePath,
  preview,
  onClose,
}: GradeImportDialogProps) {
  const router = useRouter()
  const executeImport = useMutation(executeGradeImportMutation())
  const importing = executeImport.isPending
  const { effectiveSelections, selectArchive, buildDecisions } =
    useCourseworkImportDecisions(preview.courseworkMatches)

  const classroomMatched = preview.classroomMatches.filter(
    (classroomMatch) => classroomMatch.found
  ).length
  const examMatched = preview.examMatches.filter(
    (examMatch) => examMatch.found
  ).length

  const handleConfirm = async () => {
    // 試験参照のマッピング（examName → 既存examId）を照合結果から構築
    const examMapping: Record<string, string> = {}
    for (const examMatch of preview.examMatches) {
      if (examMatch.found && examMatch.examId)
        examMapping[examMatch.examName] = examMatch.examId
    }
    try {
      const importResult = await executeImport.mutateAsync({
        archivePath,
        options: { examMapping, courseworkDecisions: buildDecisions() },
      })
      toastImportWarnings(importResult.warnings)
      router.push(`/grades/${importResult.gradeId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
    onClose()
  }

  return (
    <LegacyArchiveImportDialogFrame
      title="成績アーカイブの取り込み"
      description="照合結果を確認し、試験外成績資料の取り込み方法を選択してください。"
      importing={importing}
      onConfirm={() => void handleConfirm()}
      onClose={onClose}
    >
      <ScrollArea className="max-h-[60vh] pr-4">
        {/* 照合サマリ */}
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">
            学級 {classroomMatched}/{preview.classroomMatches.length} 一致
          </Badge>
          <Badge variant="outline">
            試験 {examMatched}/{preview.examMatches.length} 一致
          </Badge>
          <Badge variant="outline">生徒 {preview.studentMatchCount} 一致</Badge>
          {preview.studentCreateCount > 0 && (
            <Badge variant="secondary">
              生徒 {preview.studentCreateCount} 名を新規登録
            </Badge>
          )}
          {preview.classroomCreateCount > 0 && (
            <Badge variant="secondary">
              学級 {preview.classroomCreateCount} 件を新規登録
            </Badge>
          )}
          {preview.studentSkipCount > 0 && (
            <Badge variant="destructive">
              生徒 {preview.studentSkipCount} 名が見つかりません
            </Badge>
          )}
        </div>

        {/* 生徒マスタ・学級マスタへ書き込むことは事前に明示する。
              取り込みは成績を作るだけでなく、既存に無い生徒・学級を登録する */}
        {(preview.studentCreateCount > 0 ||
          preview.classroomCreateCount > 0) && (
          <div className="mb-4 rounded border border-border/60 bg-muted/40 p-3 text-sm">
            <div className="mb-1 font-medium">
              この取り込みで生徒・学級が追加されます
            </div>
            <p className="text-muted-foreground">
              既存の生徒・学級に一致しなかったものを新しく登録します
              {preview.studentCreateCount > 0 && (
                <>（生徒 {preview.studentCreateCount} 名</>
              )}
              {preview.studentCreateCount > 0 &&
                preview.classroomCreateCount > 0 &&
                " / "}
              {preview.classroomCreateCount > 0 && (
                <>学級 {preview.classroomCreateCount} 件</>
              )}
              {(preview.studentCreateCount > 0 ||
                preview.classroomCreateCount > 0) && <>）</>}
              。学籍番号・学級名が既存と重なる場合は末尾に連番を付けて登録します。
            </p>
          </div>
        )}

        {preview.studentSkipCount > 0 && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
            <div className="mb-1 font-medium text-amber-800 dark:text-amber-300">
              生徒 {preview.studentSkipCount} 名は取り込めません
            </div>
            <p className="text-muted-foreground">
              古い形式のアーカイブは生徒の氏名を持たないため、この生徒は登録できません。
              先に生徒を登録してから取り込み直すと、その生徒の成績も一緒に戻ります。
            </p>
          </div>
        )}

        {/* 変換で失われるデータの警告（取り込み前に見せる） */}
        <ImportWarningList
          warnings={preview.warnings}
          heading="取り込み時に失われるデータがあります"
        />
        {/* 資料ごとの判断 */}
        <CourseworkDecisionList
          courseworkMatches={preview.courseworkMatches}
          effectiveSelections={effectiveSelections}
          onSelect={selectArchive}
          heading="試験外成績資料の取り込み"
        />
      </ScrollArea>
    </LegacyArchiveImportDialogFrame>
  )
}
