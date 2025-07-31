"use client"

interface TemplateStatusProps {
  /** 読み込み状態 */
  isLoading: boolean
  /** プロジェクトIDの有無 */
  hasProjectId: boolean
}

/**
 * テンプレートページの状態表示コンポーネント
 * 読み込み中とエラー状態を表示
 */
export function TemplateStatus({
  isLoading,
  hasProjectId,
}: TemplateStatusProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>採点枠情報を読み込み中...</p>
      </div>
    )
  }

  if (!hasProjectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>プロジェクト情報がありません。</p>
      </div>
    )
  }

  return null
}
