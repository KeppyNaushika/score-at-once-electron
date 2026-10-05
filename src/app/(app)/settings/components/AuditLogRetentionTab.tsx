"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AUDIT_LOG_RETENTION_DAYS_CHOICES,
  AUDIT_LOG_RETENTION_DAYS_KEY,
  formatAuditLogRetentionDays,
  parseAuditLogRetentionDays,
} from "@/lib/shared/auditLogRetention"
import {
  appPreferenceQuery,
  setAuditLogRetentionDaysMutation,
} from "@/queries/settings"

/**
 * 操作履歴を残す期間の設定。
 *
 * **利用者ごとではなく、DB を共有する全員で1つ**（`AppPreference`）。端末ごとに
 * 違うと、短い方の端末が消した行が同期で全端末から消え、どこまで残るかが定まらない。
 * 短くするときは、消えた履歴が戻らないことを確かめてから保存する。
 */
export function AuditLogRetentionTab() {
  const { data: storedText } = useQuery(
    appPreferenceQuery(AUDIT_LOG_RETENTION_DAYS_KEY)
  )
  const { mutate: saveRetentionDays } = useMutation(
    setAuditLogRetentionDaysMutation()
  )
  // 短くする操作を確かめている間の、選ばれた日数
  const [shorteningDays, setShorteningDays] = useState<number | null>(null)

  const retentionDays = parseAuditLogRetentionDays(storedText ?? null)
  // 保存済みの値が選択肢に無くても（選択肢を後から変えたときなど）そのまま見せる
  const choices: readonly number[] = AUDIT_LOG_RETENTION_DAYS_CHOICES.some(
    (days) => days === retentionDays
  )
    ? AUDIT_LOG_RETENTION_DAYS_CHOICES
    : [...AUDIT_LOG_RETENTION_DAYS_CHOICES, retentionDays].sort(
        (left, right) => left - right
      )

  const change = (days: number) => {
    if (days === retentionDays) return
    if (days < retentionDays) {
      setShorteningDays(days)
      return
    }
    saveRetentionDays(days)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">操作履歴を残す期間</h2>
          <p className="text-sm text-muted-foreground">
            これより古い操作履歴は、起動したときに削除されます。この設定はこの
            データベースを共有する全員で同じものになり、変更したことも操作履歴に残ります。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-36 shrink-0 text-sm">残す期間</Label>
          <Select
            value={String(retentionDays)}
            onValueChange={(value) => change(Number(value))}
          >
            <SelectTrigger className="w-32" aria-label="操作履歴を残す期間">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {formatAuditLogRetentionDays(days)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <AlertDialog
        open={shorteningDays !== null}
        onOpenChange={(open) => {
          if (!open) setShorteningDays(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              残す期間を
              {shorteningDays !== null &&
                formatAuditLogRetentionDays(shorteningDays)}
              に短くしますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              次に起動したときに、それより古い操作履歴が削除されます。削除した履歴は
              元に戻せません。同期している他のPCからも削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (shorteningDays !== null) saveRetentionDays(shorteningDays)
              }}
            >
              短くする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
