"use client"

import ConfirmationModal from "@/components/common/ConfirmationModal"

interface DeleteGradeModalProps {
  /** null のときは閉じている */
  target: {
    id: string
    name: string
    studentCount: number
    gradeItemCount: number
  } | null
  onClose: () => void
  onConfirm: (gradeId: string) => void | Promise<void>
  loading: boolean
}

/**
 * 成績算出の削除確認。一覧の行メニューと概要ページの両方から開く。
 *
 * 成績算出を消すと、評価項目・データソース・成績境界・手直しした成績・確定値まで
 * 一緒に消えて戻せない。元になった試験の採点結果と試験外成績資料は消えないので、
 * それも書いて、何が消えて何が残るかを押す前に分かるようにする。
 */
export function DeleteGradeModal({
  target,
  onClose,
  onConfirm,
  loading,
}: DeleteGradeModalProps) {
  return (
    <ConfirmationModal
      open={target !== null}
      onClose={onClose}
      title="成績算出の削除"
      description="以下の成績算出を完全に削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={
        target
          ? [
              {
                id: target.id,
                display: target.name,
                badges: [
                  {
                    label: `生徒 ${target.studentCount}名`,
                    variant: "secondary",
                  },
                  {
                    label: `評価項目 ${target.gradeItemCount}`,
                    variant: "secondary",
                  },
                ],
              },
            ]
          : []
      }
      warnings={[
        {
          type: "destructive",
          message:
            "この操作は取り消せません。評価項目・データソース・成績境界・手直しした成績・確定した成績もすべて削除されます。",
        },
        {
          type: "info",
          message: "元になった試験の採点結果と試験外成績資料は削除されません。",
        },
      ]}
      onConfirm={() => (target ? onConfirm(target.id) : undefined)}
      loading={loading}
    />
  )
}
