"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import type { ClassroomRemovalMode, ClassroomRosterEntry } from "./types"

interface ClassroomRemovalDialogProps {
  /** 削除対象（null のとき閉じている） */
  entry: ClassroomRosterEntry | null
  mode: ClassroomRemovalMode
  /** can-delete-students モードで、巻き添えになるものを数える */
  fetchRemovalPreview?: (
    entry: ClassroomRosterEntry
  ) => Promise<ConfirmedDeletionCount[]>
  /**
   * 実行。deleteStudents=true で専属生徒も削除。
   * 利用者に見せた件数を添えて渡す（消す直前に main が数え直す。段階26）
   */
  onConfirm: (
    entry: ClassroomRosterEntry,
    deleteStudents: boolean,
    confirmedCounts: ConfirmedDeletionCount[]
  ) => Promise<void>
  /**
   * 専属生徒を削除したときに連動して消えるものの列挙。
   * 生徒の削除は対象者ごと消すので、その子データも DB の cascade で失われる（#962）。
   */
  deletionLosses?: string[]
  onClose: () => void
}

type RemovalChoice = "unlink" | "delete-students"

/** 巻き添えになる人数の合計（この画面が数えるのは生徒だけ） */
function sumDeletionCounts(
  deletionCounts: ConfirmedDeletionCount[] | null
): number {
  return (deletionCounts ?? []).reduce(
    (total, deletionCount) => total + deletionCount.shownCount,
    0
  )
}

/** 「◯◯ 3名 が削除されます」の文言を、数えたものの名前から組み立てる */
function describeDeletionCounts(
  deletionCounts: ConfirmedDeletionCount[]
): string {
  const details = deletionCounts
    .map(
      (deletionCount) =>
        `${deletionCount.countedName} ${deletionCount.shownCount}名`
    )
    .join("、")
  return `${details} が削除されます`
}

interface RemovalChoiceFormProps {
  entry: ClassroomRosterEntry
  confirming: boolean
  /** 巻き添えになるものの件数。取得前は null（件数不明のまま破壊的削除させない） */
  deletionCounts: ConfirmedDeletionCount[] | null
  /** 外し方の選択。2段階目から戻ったときに選び直させないよう外側で持つ */
  choice: RemovalChoice
  onChoiceChange: (choice: RemovalChoice) => void
  onCancel: () => void
  /** 専属生徒を削除する選択かつ対象1名以上のとき、2段階目へ渡す */
  onProceedToFinalConfirm: (entry: ClassroomRosterEntry) => void
  onConfirm: () => void
  /** 数え直しで増えていて中止されたときの文言 */
  refusalMessage: string | null
}

/** 1段階目の本体（外し方の選択）。件数の取得は外側が持つ */
function RemovalChoiceForm({
  entry,
  confirming,
  deletionCounts,
  choice,
  onChoiceChange,
  onCancel,
  onProceedToFinalConfirm,
  onConfirm,
  refusalMessage,
}: RemovalChoiceFormProps) {
  const willDeleteStudents = choice === "delete-students"
  const deleteCount = sumDeletionCounts(deletionCounts)

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
              {deletionCounts === null
                ? "対象生徒数を確認中…"
                : deleteCount === 0
                  ? "この学級にのみ所属する生徒はいません"
                  : describeDeletionCounts(deletionCounts)}
            </span>
          </Label>
        </div>
      </RadioGroup>

      {/* 数えた後に他の教員が加えていれば main が中止する。閉じずに数え直した
          結果を見せ、利用者にもう一度決めてもらう */}
      {refusalMessage && (
        <p className="rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {refusalMessage}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
          キャンセル
        </Button>
        <Button
          variant={willDeleteStudents ? "destructive" : "default"}
          // 登録解除のみ（unlink）は常に実行可。専属生徒削除を選んだ場合のみ
          // 対象数の確定を待つ（プレビュー失敗時は catch で 0 が入り詰まらない）。
          disabled={
            confirming || (willDeleteStudents && deletionCounts === null)
          }
          onClick={() => {
            // 専属生徒を削除する選択かつ対象1名以上 → 2段階目へ
            if (willDeleteStudents && deletionCounts && deleteCount > 0) {
              onProceedToFinalConfirm(entry)
            } else {
              // 登録解除のみ、または削除対象0名はここで実行
              onConfirm()
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
  const [choice, setChoice] = useState<RemovalChoice>("unlink")
  // 巻き添えの件数は「どの学級に対する件数か」を対で持つ。対象が変われば一致しなく
  // なるので前の学級の件数が残らず、2段階目を往復しても取り直さずに済む
  const [preview, setPreview] = useState<{
    entry: ClassroomRosterEntry
    deletionCounts: ConfirmedDeletionCount[]
  } | null>(null)
  const deletionCounts =
    preview !== null && preview.entry === entry ? preview.deletionCounts : null

  // プレビュー取得関数は毎レンダー identity が変わりうるので ref で持ち、
  // useEffect の再発火を「対象(entry)が変わったとき」だけに限定する。
  const fetchRemovalPreviewRef = useRef(fetchRemovalPreview)
  useEffect(() => {
    fetchRemovalPreviewRef.current = fetchRemovalPreview
  })

  /**
   * 巻き添えになるものを数える。取得失敗時は件数不明のまま据え置く。これにより
   * 「専属生徒も削除」は確定ボタンが無効化され（件数不明のまま破壊的削除させない）、
   * 安全な「登録解除のみ」だけは実行できる。0 を入れると2段階目の最終確認を
   * 飛ばして専属生徒を確認なしに削除してしまうため避ける。
   */
  const countRemovalImpact = useCallback(
    async (target: ClassroomRosterEntry) => {
      const fetchPreview = fetchRemovalPreviewRef.current
      if (!fetchPreview) return
      try {
        setPreview({
          entry: target,
          deletionCounts: await fetchPreview(target),
        })
      } catch (err) {
        console.error("Failed to fetch class removal preview:", err)
      }
    },
    []
  )

  useEffect(() => {
    if (!entry || mode !== "can-delete-students") return
    void countRemovalImpact(entry)
  }, [countRemovalImpact, entry, mode])

  // 2段階目（取り消し不可の最終確認）に居る学級。**件数は持たない** —
  // 進むときに固定すると、中止されて数え直したあとも本文が古い件数を出し続け、
  // 読んだ数と消える数が食い違う（段階40）。件数は常に preview から読む
  const [finalConfirmEntry, setFinalConfirmEntry] =
    useState<ClassroomRosterEntry | null>(null)

  // 閉じたら選択を初期値へ戻す（次に開いたときに前回の選択を引きずらない）
  const handleClose = () => {
    setChoice("unlink")
    onClose()
  }

  // 登録解除だけなら巻き添えは無い（数え直す対象も無いので空配列を添える）
  const willDeleteStudents =
    mode === "can-delete-students" && choice === "delete-students"
  const confirmedCounts = willDeleteStudents ? deletionCounts : []

  const { canConfirm, isDeleting, refusalMessage, confirmDeletion } =
    useConfirmedDeletion({
      confirmedCounts,
      deleteWithConfirmedCounts: useCallback(
        async (counts: ConfirmedDeletionCount[]) => {
          if (!entry) return
          await onConfirm(entry, willDeleteStudents, counts)
        },
        [entry, onConfirm, willDeleteStudents]
      ),
      recount: useCallback(
        async () => (entry ? await countRemovalImpact(entry) : undefined),
        [countRemovalImpact, entry]
      ),
    })
  const confirming = isDeleting

  const runConfirm = async () => {
    if (!(await confirmDeletion())) return
    setFinalConfirmEntry(null)
    handleClose()
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
                void runConfirm()
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
        open={entry !== null && finalConfirmEntry === null}
        onOpenChange={(open) => !open && handleClose()}
      >
        <DialogContent>
          {entry && (
            <RemovalChoiceForm
              entry={entry}
              confirming={confirming}
              deletionCounts={deletionCounts}
              choice={choice}
              onChoiceChange={setChoice}
              onCancel={handleClose}
              onProceedToFinalConfirm={setFinalConfirmEntry}
              onConfirm={() => void runConfirm()}
              refusalMessage={refusalMessage}
            />
          )}
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
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                「{finalConfirmEntry?.name}」にのみ所属する{" "}
                {sumDeletionCounts(deletionCounts)}名 を
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
              {/* 数えた後に他の教員が加えていれば main が中止する。閉じずに
                  数え直した結果を見せ、利用者にもう一度決めてもらう */}
              {refusalMessage && (
                <span className="block rounded bg-amber-50 p-3 font-medium text-amber-900">
                  {refusalMessage}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void runConfirm()
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
