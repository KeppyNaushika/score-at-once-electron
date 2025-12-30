"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

/** プロジェクト情報の最小型（存在チェックのみに使用） */
interface ProjectInfo {
  id: string
  examName: string
}

interface ScoringStatesProps {
  loading: boolean
  project?: ProjectInfo | null
  answerSheetsLength: number
  cropRegionsLength: number
  projectId: string
}

export function ScoringLoadingState() {
  return (
    <div className="flex flex-1">
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner text="採点データを読み込み中..." />
      </div>
    </div>
  )
}

export function ScoringErrorState({
  project,
  answerSheetsLength,
  cropRegionsLength,
  projectId,
}: Pick<
  ScoringStatesProps,
  "project" | "answerSheetsLength" | "cropRegionsLength" | "projectId"
>) {
  const router = useRouter()

  return (
    <div className="flex flex-1">
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold text-gray-700">
            採点を開始できません
          </h2>
          <div className="space-y-1 text-sm text-gray-500">
            {!project && <p>• プロジェクト情報が見つかりません</p>}
            {answerSheetsLength === 0 && (
              <p>• 答案がアップロードされていません</p>
            )}
            {cropRegionsLength === 0 && <p>• 採点領域が設定されていません</p>}
          </div>
          <Button
            onClick={() => router.push(`/projects/${projectId}`)}
            variant="outline"
          >
            プロジェクト詳細に戻る
          </Button>
        </div>
      </div>
    </div>
  )
}
