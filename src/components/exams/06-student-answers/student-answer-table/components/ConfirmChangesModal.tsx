"use client"

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { useMemo, useState } from "react"

import type { PendingChange } from "@/components/exams/06-student-answers/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { PlacementScorePolicy } from "@/electron-src/lib/prisma/studentAnswer/placementApply"

interface ConfirmChangesModalProps {
  isOpen: boolean
  onClose: () => void
  pendingChanges: PendingChange[]
  onConfirm: (policies: Record<string, PlacementScorePolicy>) => Promise<void>
  onReset?: () => Promise<void>
}

/** ページが変わる移動か（＝採点は追従不可・破棄一択） */
function isPageChange(change: PendingChange): boolean {
  return change.fromPosition.pageNumber !== change.toPosition.pageNumber
}

/**
 * 変更適用の確認モーダル（ハイブリッド方式）。
 * - 追従(carry)のみの①は摩擦なく流す。
 * - 破棄を伴う項目（②③のページ変化・①の破棄選択）は行ごとにチェック必須＋最終確認1回。
 */
export function ConfirmChangesModal({
  isOpen,
  onClose,
  pendingChanges,
  onConfirm,
  onReset,
}: ConfirmChangesModalProps) {
  // 同一ページ変更の方針（既定 carry）。ページ変化は常に discard で state に持たない。
  const [samePagePolicies, setSamePagePolicies] = useState<
    Record<string, PlacementScorePolicy>
  >({})
  const [ackedDiscards, setAckedDiscards] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<"list" | "confirm">("list")
  const [isApplying, setIsApplying] = useState(false)

  const effectivePolicy = (change: PendingChange): PlacementScorePolicy =>
    isPageChange(change) ? "discard" : (samePagePolicies[change.id] ?? "carry")

  const discardChanges = useMemo(
    () =>
      pendingChanges.filter((change) => effectivePolicy(change) === "discard"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingChanges, samePagePolicies]
  )
  const carryCount = pendingChanges.length - discardChanges.length
  const unackedCount = discardChanges.filter(
    (change) => !ackedDiscards.has(change.id)
  ).length
  const allAcked = unackedCount === 0

  const buildPolicies = (): Record<string, PlacementScorePolicy> => {
    const policies: Record<string, PlacementScorePolicy> = {}
    for (const change of pendingChanges) {
      policies[change.id] = effectivePolicy(change)
    }
    return policies
  }

  const resetLocalState = () => {
    setSamePagePolicies({})
    setAckedDiscards(new Set())
    setPhase("list")
  }

  const handleClose = () => {
    resetLocalState()
    onClose()
  }

  const handleProceed = () => {
    // 破棄があれば2段階目の最終確認へ。追従のみなら直接適用。
    if (discardChanges.length > 0) {
      setPhase("confirm")
    } else {
      void applyNow()
    }
  }

  const applyNow = async () => {
    setIsApplying(true)
    try {
      await onConfirm(buildPolicies())
      resetLocalState()
      onClose()
    } catch (error) {
      console.error("変更の適用に失敗しました:", error)
    } finally {
      setIsApplying(false)
    }
  }

  const setPolicy = (changeId: string, policy: PlacementScorePolicy) => {
    setSamePagePolicies((prev) => ({ ...prev, [changeId]: policy }))
    // discard→carry に戻したら ack もクリア
    if (policy === "carry") {
      setAckedDiscards((prev) => {
        const next = new Set(prev)
        next.delete(changeId)
        return next
      })
    }
  }

  const toggleAck = (changeId: string) => {
    setAckedDiscards((prev) => {
      const next = new Set(prev)
      if (next.has(changeId)) next.delete(changeId)
      else next.add(changeId)
      return next
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pendingChanges.length}件の配置変更を反映
          </DialogTitle>
          <DialogDescription>
            追従 {carryCount}件 / 破棄 {discardChanges.length}件
            {discardChanges.length > 0 &&
              "（破棄は対象生徒の再採点が必要です）"}
          </DialogDescription>
        </DialogHeader>

        {/* 変更リスト（固定高スクロール。フッタは常時可視） */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {pendingChanges.map((change, index) => {
            const pageChange = isPageChange(change)
            const policy = effectivePolicy(change)
            const isSwap = change.targetFileId !== null
            const needsAck = policy === "discard"
            const acked = ackedDiscards.has(change.id)

            return (
              <div
                key={change.id}
                className={`rounded-lg border p-3 ${
                  policy === "discard"
                    ? "border-red-200 bg-red-50"
                    : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-6 font-mono text-xs text-gray-500">
                    #{index + 1}
                  </span>
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <span className="font-medium">
                      {change.fromPosition.studentName || "未割当"}
                      <span className="ml-1 text-gray-500">
                        P{change.fromPosition.pageNumber}
                      </span>
                    </span>
                    {isSwap ? (
                      <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium">
                      {change.toPosition.studentName || "未割当"}
                      <span className="ml-1 text-gray-500">
                        P{change.toPosition.pageNumber}
                      </span>
                    </span>
                    {isSwap && (
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs text-gray-600">
                        入れ替え
                      </span>
                    )}
                  </div>

                  {/* 同一ページのみ carry/discard を選べる */}
                  {!pageChange ? (
                    <label className="flex shrink-0 items-center gap-2 text-xs text-gray-700">
                      採点を移す
                      <Switch
                        checked={policy === "carry"}
                        onCheckedChange={(checked) =>
                          setPolicy(change.id, checked ? "carry" : "discard")
                        }
                      />
                    </label>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      ページ変更→破棄
                    </span>
                  )}
                </div>

                {/* 破棄項目は了解チェック必須 */}
                {needsAck && (
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-red-700">
                    <Checkbox
                      checked={acked}
                      onCheckedChange={() => toggleAck(change.id)}
                    />
                    {change.toPosition.studentName || "対象生徒"}
                    の採点を破棄することを了解
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs">
            {phase === "confirm" ? (
              <span className="font-medium text-red-700">
                破棄を伴います。よろしいですか？（{discardChanges.length}
                件を破棄）
              </span>
            ) : (
              !allAcked && (
                <span className="text-red-600">
                  未了解 {unackedCount}件（破棄項目を全てチェックしてください）
                </span>
              )
            )}
          </div>
          <div className="flex gap-2">
            {phase === "confirm" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setPhase("list")}
                  disabled={isApplying}
                >
                  戻る
                </Button>
                <Button
                  onClick={applyNow}
                  disabled={isApplying}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isApplying && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  破棄して反映
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isApplying}
                >
                  キャンセル
                </Button>
                {onReset && (
                  <Button
                    variant="outline"
                    onClick={onReset}
                    disabled={isApplying}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    リセット
                  </Button>
                )}
                <Button
                  onClick={handleProceed}
                  disabled={isApplying || !allAcked}
                >
                  {isApplying && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  反映
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
