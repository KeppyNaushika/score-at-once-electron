"use client"

import ConfirmationModal from "@/components/common/ConfirmationModal"

interface DeleteCourseworkModalProps {
  /** null のときは閉じている */
  target: {
    id: string
    name: string
    studentCount: number
    itemCount: number
  } | null
  onClose: () => void
  onConfirm: (courseworkId: string) => void | Promise<void>
  loading: boolean
}

/**
 * 試験外成績資料の削除確認。一覧の行メニューと概要ページの両方から開く。
 *
 * 資料を消すと、対象生徒・評価項目（文字評価の変換表を含む）・入力した点数や評価・
 * 加減点・コメントまで一緒に消えて戻せない（schema.prisma の Cascade）。
 * 生徒・学級・タグそのものは資料との結び付きが外れるだけで消えないので、それも書いて、
 * 何が消えて何が残るかを押す前に分かるようにする（DeleteGradeModal と同じ作り）。
 */
export function DeleteCourseworkModal({
  target,
  onClose,
  onConfirm,
  loading,
}: DeleteCourseworkModalProps) {
  return (
    <ConfirmationModal
      open={target !== null}
      onClose={onClose}
      title="試験外成績資料の削除"
      description="以下の試験外成績資料を完全に削除します。"
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
                    label: `評価項目 ${target.itemCount}`,
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
            "この操作は取り消せません。対象生徒の登録・評価項目（文字評価の変換表を含む）・入力した点数や評価・加減点とその理由・成績通知書に載せるコメントもすべて削除されます。",
        },
        {
          type: "info",
          message:
            "生徒・学級の名簿とタグそのものは削除されません（この資料との結び付きだけが外れます）。",
        },
      ]}
      onConfirm={() => (target ? onConfirm(target.id) : undefined)}
      loading={loading}
    />
  )
}
