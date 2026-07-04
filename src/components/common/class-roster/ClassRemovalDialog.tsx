"use client"

import { useEffect, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import type {
  ClassRemovalMode,
  ClassRemovalPreview,
  ClassRosterEntry,
} from "./types"

interface ClassRemovalDialogProps {
  /** 削除対象（null のとき閉じている） */
  entry: ClassRosterEntry | null
  mode: ClassRemovalMode
  /** can-delete-students モードで削除対象になる生徒数を取得 */
  fetchRemovalPreview?: (
    entry: ClassRosterEntry
  ) => Promise<ClassRemovalPreview>
  /** 実行。deleteStudents=true で専属生徒も削除 */
  onConfirm: (entry: ClassRosterEntry, deleteStudents: boolean) => Promise<void>
  onClose: () => void
}

type RemovalChoice = "unlink" | "delete-students"

/**
 * 学級削除の確認ダイアログ（設計3章の2段階モーダル）。
 *
 * - `unlink-only`（試験）: 「登録を解除します（生徒は残る）」の単純確認1段階。
 * - `can-delete-students`（成績・資料）:
 *   1段階目で外し方（登録解除のみ / 専属生徒も削除）を選択。
 *   専属生徒を削除する選択かつ対象が1名以上なら、2段階目で取り消し不可の最終確認。
 */
export function ClassRemovalDialog({
  entry,
  mode,
  fetchRemovalPreview,
  onConfirm,
  onClose,
}: ClassRemovalDialogProps) {
  const [choice, setChoice] = useState<RemovalChoice>("unlink")
  const [exclusiveCount, setExclusiveCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  // 2段階目（取り消し不可の最終確認）を表示中か
  const [finalConfirmEntry, setFinalConfirmEntry] =
    useState<ClassRosterEntry | null>(null)

  // プレビュー取得関数は毎レンダー identity が変わりうるので ref で持ち、
  // useEffect の再発火を「対象(entry)/モードが変わったとき」だけに限定する。
  const fetchRemovalPreviewRef = useRef(fetchRemovalPreview)
  fetchRemovalPreviewRef.current = fetchRemovalPreview

  // 対象が変わるたびに選択をリセットし、削除プレビューを取得
  useEffect(() => {
    if (!entry || mode !== "can-delete-students") {
      setExclusiveCount(null)
      return
    }
    setChoice("unlink")
    setExclusiveCount(null)
    const preview = fetchRemovalPreviewRef.current
    if (!preview) return
    let cancelled = false
    preview(entry)
      .then((removalPreview) => {
        if (!cancelled) setExclusiveCount(removalPreview.exclusiveCount)
      })
      .catch((err) => {
        console.error("Failed to fetch class removal preview:", err)
        // 取得失敗時は null のまま据え置く。これにより「専属生徒も削除」は
        // 確定ボタンが無効化され（件数不明のまま破壊的削除させない）、安全な
        // 「登録解除のみ」だけは実行できる。0 を入れると2段階目の最終確認を
        // 飛ばして専属生徒を確認なしに削除してしまうため避ける。
        if (!cancelled) setExclusiveCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry, mode])

  const runConfirm = async (
    target: ClassRosterEntry,
    deleteStudents: boolean
  ) => {
    setConfirming(true)
    try {
      await onConfirm(target, deleteStudents)
      setFinalConfirmEntry(null)
      onClose()
    } catch (err) {
      console.error("Failed to remove class:", err)
    } finally {
      setConfirming(false)
    }
  }

  // unlink-only（試験）: 単純な確認1段階
  if (mode === "unlink-only") {
    return (
      <AlertDialog
        open={entry !== null}
        onOpenChange={(open) => !open && onClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>学級の登録を解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{entry?.name}
              」の登録を解除します。生徒は受験者に残ります（採点データは削除されません）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirming}
              onClick={(e) => {
                e.preventDefault()
                if (entry) runConfirm(entry, false)
              }}
            >
              登録を解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // can-delete-students（成績・資料）: 2段階
  const willDeleteStudents = choice === "delete-students"
  const deleteCount = exclusiveCount ?? 0

  return (
    <>
      {/* 1段階目: 外し方の選択 */}
      <Dialog
        open={entry !== null && finalConfirmEntry === null}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>学級を外す</DialogTitle>
            <DialogDescription>
              「{entry?.name}」の外し方を選択してください。
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={choice}
            onValueChange={(value) => {
              // as を使わず型ガードで RemovalChoice に絞り込む
              if (value === "unlink" || value === "delete-students")
                setChoice(value)
            }}
            className="gap-3 py-2"
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="unlink" id="removal-unlink" />
              <Label htmlFor="removal-unlink" className="font-normal">
                登録だけ解除（生徒は対象に残す）
                <span className="text-muted-foreground ml-1 text-xs">推奨</span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="delete-students" id="removal-delete" />
              <Label htmlFor="removal-delete" className="font-normal">
                登録を解除し、専属の生徒も削除
                <span className="text-muted-foreground ml-1 block text-xs">
                  {exclusiveCount === null
                    ? "対象生徒数を確認中…"
                    : deleteCount === 0
                      ? "この学級にのみ所属する生徒はいません"
                      : `この学級にのみ所属する ${deleteCount}名 が削除されます`}
                </span>
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={confirming}>
              キャンセル
            </Button>
            <Button
              variant={willDeleteStudents ? "destructive" : "default"}
              // 登録解除のみ（unlink）は常に実行可。専属生徒削除を選んだ場合のみ
              // 対象数の確定を待つ（プレビュー失敗時は catch で 0 が入り詰まらない）。
              disabled={
                confirming || (willDeleteStudents && exclusiveCount === null)
              }
              onClick={() => {
                if (!entry) return
                // 専属生徒を削除する選択かつ対象1名以上 → 2段階目へ
                if (willDeleteStudents && deleteCount > 0) {
                  setFinalConfirmEntry(entry)
                } else {
                  // 登録解除のみ、または削除対象0名はここで実行
                  runConfirm(entry, willDeleteStudents)
                }
              }}
            >
              {willDeleteStudents && deleteCount > 0 ? "次へ" : "登録を解除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2段階目: 取り消し不可の最終確認 */}
      <AlertDialog
        open={finalConfirmEntry !== null}
        onOpenChange={(open) => !open && setFinalConfirmEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>生徒データを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{finalConfirmEntry?.name}」にのみ所属する {deleteCount}名 の
              生徒と、その入力済みデータも削除されます。この操作は取り消せません。
              本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirming}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (finalConfirmEntry) runConfirm(finalConfirmEntry, true)
              }}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
