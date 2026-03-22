"use client"

interface TemplateStatusProps {
  /** 読み込み状態 */
  isLoading: boolean
  /** 試験IDの有無 */
  hasExamId: boolean
}

/**
 * テンプレートページの状態表示コンポーネント
 * 読み込み中とエラー状態を表示
 */
export function TemplateStatus({ isLoading, hasExamId }: TemplateStatusProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>採点枠情報を読み込み中...</p>
      </div>
    )
  }

  if (!hasExamId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>試験情報がありません。</p>
      </div>
    )
  }

  return null
}
