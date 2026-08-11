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
  ClassroomRemovalMode,
  ClassroomRemovalPreview,
  ClassroomRosterEntry,
} from "./types"

interface ClassroomRemovalDialogProps {
  /** 削除対象（null のとき閉じている） */
  entry: ClassroomRosterEntry | null
  mode: ClassroomRemovalMode
  /** can-delete-students モードで削除対象になる生徒数を取得 */
  fetchRemovalPreview?: (
    entry: ClassroomRosterEntry
  ) => Promise<ClassroomRemovalPreview>
  /** 実行。deleteStudents=true で専属生徒も削除 */
  onConfirm: (
    entry: ClassroomRosterEntry,
    deleteStudents: boolean
  ) => Promise<void>
  /**
   * 専属生徒を削除したときに連動して消えるものの列挙。
   * 生徒の削除は対象者ごと消すので、その子データも DB の cascade で失われる（#962）。
   */
  deletionLosses?: string[]
  onClose: () => void
}

type RemovalChoice = "unlink" | "delete-students"

interface RemovalChoiceFormProps {
  entry: ClassroomRosterEntry
  confirming: boolean
  /** 専属生徒の数。取得前は null（件数不明のまま破壊的削除させない） */
  exclusiveCount: number | null
  /** 外し方の選択。2段階目から戻ったときに選び直させないよう外側で持つ */
  choice: RemovalChoice
  onChoiceChange: (choice: RemovalChoice) => void
  onCancel: () => void
  /** 専属生徒を削除する選択かつ対象1名以上のとき、2段階目へ渡す */
  onProceedToFinalConfirm: (
    entry: ClassroomRosterEntry,
    deleteCount: number
  ) => void
  onConfirm: (entry: ClassroomRosterEntry, deleteStudents: boolean) => void
}

/** 1段階目の本体（外し方の選択）。件数の取得は外側が持つ */
function RemovalChoiceForm({
  entry,
  confirming,
  exclusiveCount,
  choice,
  onChoiceChange,
  onCancel,
  onProceedToFinalConfirm,
  onConfirm,
}: RemovalChoiceFormProps) {
  const willDeleteStudents = choice === "delete-students"
  const deleteCount = exclusiveCount ?? 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>学級を外す</DialogTitle>
        <DialogDescription>
          「{entry.name}」の外し方を選択してください。
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={choice}
        onValueChange={(value) => {
          // as を使わず型ガードで RemovalChoice に絞り込む
          if (value === "unlink" || value === "delete-students")
            onChoiceChange(value)
        }}
        className="gap-3 py-2"
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem value="unlink" id="removal-unlink" />
          <Label htmlFor="removal-unlink" className="font-normal">
            登録だけ解除（生徒は対象に残す）
            <span className="ml-1 text-xs text-muted-foreground">推奨</span>
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="delete-students" id="removal-delete" />
          <Label htmlFor="removal-delete" className="font-normal">
            登録を解除し、専属の生徒も削除
            <span className="ml-1 block text-xs text-muted-foreground">
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
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
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
            // 専属生徒を削除する選択かつ対象1名以上 → 2段階目へ
            if (willDeleteStudents && deleteCount > 0) {
              onProceedToFinalConfirm(entry, deleteCount)
            } else {
              // 登録解除のみ、または削除対象0名はここで実行
              onConfirm(entry, willDeleteStudents)
            }
          }}
        >
          {willDeleteStudents && deleteCount > 0 ? "次へ" : "登録を解除"}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * 学級削除の確認ダイアログ（設計3章の2段階モーダル）。
 *
 * - `unlink-only`（試験）: 「登録を解除します（生徒は残る）」の単純確認1段階。
 * - `can-delete-students`（成績・資料）:
 *   1段階目で外し方（登録解除のみ / 専属生徒も削除）を選択。
 *   専属生徒を削除する選択かつ対象が1名以上なら、2段階目で取り消し不可の最終確認。
 */
export function ClassroomRemovalDialog({
  entry,
  mode,
  fetchRemovalPreview,
  onConfirm,
  deletionLosses,
  onClose,
}: ClassroomRemovalDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const [choice, setChoice] = useState<RemovalChoice>("unlink")
  // 専属生徒数は「どの学級に対する件数か」を対で持つ。対象が変われば一致しなく
  // なるので前の学級の件数が残らず、2段階目を往復しても取り直さずに済む
  const [preview, setPreview] = useState<{
    entry: ClassroomRosterEntry
    exclusiveCount: number
  } | null>(null)
  const exclusiveCount =
    preview !== null && preview.entry === entry ? preview.exclusiveCount : null

  // プレビュー取得関数は毎レンダー identity が変わりうるので ref で持ち、
  // useEffect の再発火を「対象(entry)が変わったとき」だけに限定する。
  const fetchRemovalPreviewRef = useRef(fetchRemovalPreview)
  useEffect(() => {
    fetchRemovalPreviewRef.current = fetchRemovalPreview
  })

  useEffect(() => {
    if (!entry || mode !== "can-delete-students") return
    const fetchPreview = fetchRemovalPreviewRef.current
    if (!fetchPreview) return
    let cancelled = false
    fetchPreview(entry)
      .then((removalPreview) => {
        if (!cancelled) {
          setPreview({ entry, exclusiveCount: removalPreview.exclusiveCount })
        }
      })
      .catch((err) => {
        console.error("Failed to fetch class removal preview:", err)
        // 取得失敗時は件数不明のまま据え置く。これにより「専属生徒も削除」は
        // 確定ボタンが無効化され（件数不明のまま破壊的削除させない）、安全な
        // 「登録解除のみ」だけは実行できる。0 を入れると2段階目の最終確認を
        // 飛ばして専属生徒を確認なしに削除してしまうため避ける。
      })
    return () => {
      cancelled = true
    }
  }, [entry, mode])
  // 2段階目（取り消し不可の最終確認）の対象と削除件数。1段階目を閉じると
  // 件数を持っていた本体が外れるので、進むときに一緒に受け取っておく
  const [finalConfirm, setFinalConfirm] = useState<{
    entry: ClassroomRosterEntry
    deleteCount: number
  } | null>(null)

  // 閉じたら選択を初期値へ戻す（次に開いたときに前回の選択を引きずらない）
  const handleClose = () => {
    setChoice("unlink")
    onClose()
  }

  const runConfirm = async (
    target: ClassroomRosterEntry,
    deleteStudents: boolean
  ) => {
    setConfirming(true)
    try {
      await onConfirm(target, deleteStudents)
      setFinalConfirm(null)
      handleClose()
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
        onOpenChange={(open) => !open && handleClose()}
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
  return (
    <>
      {/* 1段階目: 外し方の選択 */}
      <Dialog
        open={entry !== null && finalConfirm === null}
        onOpenChange={(open) => !open && handleClose()}
      >
        <DialogContent>
          {entry && (
            <RemovalChoiceForm
              entry={entry}
              confirming={confirming}
              exclusiveCount={exclusiveCount}
              choice={choice}
              onChoiceChange={setChoice}
              onCancel={handleClose}
              onProceedToFinalConfirm={(target, deleteCount) =>
                setFinalConfirm({ entry: target, deleteCount })
              }
              onConfirm={runConfirm}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 2段階目: 取り消し不可の最終確認 */}
      <AlertDialog
        open={finalConfirm !== null}
        onOpenChange={(open) => !open && setFinalConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>生徒データを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                「{finalConfirm?.entry.name}」にのみ所属する{" "}
                {finalConfirm?.deleteCount}名 を
                対象から外します。連動して以下も削除されます：
              </span>
              <span className="block pl-4 text-muted-foreground">
                {(deletionLosses ?? ["その生徒の入力済みデータ"]).map(
                  (loss) => (
                    <span key={loss} className="block">
                      ・{loss}
                    </span>
                  )
                )}
              </span>
              <span className="block font-medium">
                この操作は取り消せません。本当に削除しますか？
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirming}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (finalConfirm) runConfirm(finalConfirm.entry, true)
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
