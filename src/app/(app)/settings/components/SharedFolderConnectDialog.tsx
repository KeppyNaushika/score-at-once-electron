"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { SharedFolderInspection } from "@/electron-src/lib/sync/sharedFolder"
import type { SharedFolderConnectAction } from "@/electron-src/lib/sync/storageModeService"

/** 選んだ共有フォルダと、それを見た結果 */
export interface InspectedSharedFolder {
  sharedFolderPath: string
  inspection: SharedFolderInspection
}

interface SharedFolderConnectDialogProps {
  inspected: InspectedSharedFolder | null
  /** このPCで登録済みの共有フォルダの識別 id（合流でなく、パスの書き換えになる） */
  knownSharedFolderIds: string[]
  isConnecting: boolean
  onConnect: (action: SharedFolderConnectAction) => void
  onClose: () => void
}

/**
 * 共有フォルダを選んだあとの確認。
 *
 * - 空の共有フォルダ: ローカルのデータを移して始めるか、空のプロファイルで始めるかを選ぶ
 * - 既に共有されているフォルダ: 合流する。このPCのローカルのデータとは統合しない
 */
export function SharedFolderConnectDialog({
  inspected,
  knownSharedFolderIds,
  isConnecting,
  onConnect,
  onClose,
}: SharedFolderConnectDialogProps) {
  const inspection = inspected?.inspection ?? null
  const isOpen =
    inspection !== null &&
    (inspection.kind === "empty" || inspection.kind === "shared")
  const isKnown =
    inspection !== null &&
    inspection.kind === "shared" &&
    knownSharedFolderIds.includes(inspection.sharedFolderId)

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isConnecting) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {inspection?.kind === "empty"
              ? "この共有フォルダには、共有しているデータがありません"
              : "この共有フォルダは、既に共有されています"}
          </AlertDialogTitle>
          <AlertDialogDescription className="break-all whitespace-pre-line">
            {inspected?.sharedFolderPath}
            {"\n\n"}
            {inspection?.kind === "empty"
              ? "このPCのローカルモードのデータ（データベースと画像）を写して共有を始めるか、空の共有プロファイルとして始めるかを選んでください。ローカルモードのデータはそのまま残ります。"
              : isKnown
                ? "このPCで登録済みの共有フォルダです。このパスで使うように登録し直します。"
                : "共有フォルダのデータから、このPCの控えを作ります。このPCのローカルモードのデータとは統合しません（ローカルモードのデータはそのまま残ります）。統合したい場合は、アーカイブの書き出しと取り込みを使ってください。"}
            {"\n\n"}
            設定は、再起動したときに効きます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConnecting}>やめる</AlertDialogCancel>
          {inspection?.kind === "empty" ? (
            <>
              <Button
                variant="outline"
                disabled={isConnecting}
                onClick={() => onConnect("create-empty")}
              >
                空のプロファイルで始める
              </Button>
              <Button
                disabled={isConnecting}
                onClick={() => onConnect("migrate-local")}
              >
                {isConnecting && <Spinner className="mr-2" />}
                ローカルのデータを移して始める
              </Button>
            </>
          ) : (
            <Button disabled={isConnecting} onClick={() => onConnect("join")}>
              {isConnecting && <Spinner className="mr-2" />}
              {isKnown ? "登録し直す" : "合流する"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
