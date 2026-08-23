import {
  Download,
  FilePlus2,
  FileX2,
  History,
  Pencil,
  Upload,
} from "lucide-react"

import type {
  AuditCategory,
  AuditVerb,
} from "@/electron-src/lib/prisma/auditActions"

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  exam: "試験",
  grade: "成績",
  answer_sheet: "解答用紙",
  student: "生徒・学級",
  user: "ユーザー",
  system: "システム",
}

/**
 * 選択肢が渡してくる素の文字列を、カテゴリの集合と突き合わせて絞る。
 *
 * 「すべて」を表す値もここで弾かれて `undefined`（絞り込みなし）になる。
 */
export const isAuditCategory = (value: string): value is AuditCategory =>
  value in CATEGORY_LABELS

export const VERB_META: Record<
  AuditVerb,
  { label: string; className: string; Icon: typeof Pencil }
> = {
  create: { label: "作成", className: "text-emerald-600", Icon: FilePlus2 },
  update: { label: "更新", className: "text-blue-600", Icon: Pencil },
  delete: { label: "削除", className: "text-red-600", Icon: FileX2 },
  export: { label: "出力", className: "text-violet-600", Icon: Download },
  import: { label: "取込", className: "text-amber-600", Icon: Upload },
  other: { label: "操作", className: "text-muted-foreground", Icon: History },
}

/** 1ページに並べる件数を、表示領域の高さから決める指定 */
export const AUTO_PAGE_SIZE = "auto"

/** 1ページに並べる件数の選択肢（「自動」は別枠） */
export const AUDIT_LOG_PAGE_SIZES = [10, 20, 50, 100] as const

/**
 * 「自動」で高さから件数を割り出すときの、1行の見積もり（px）。
 *
 * 1行は「誰が何をした」と補足の2段（`AuditLogItem`）。実測より少し大きめに取り、
 * はみ出すより余らせる（足りない分はスクロールできるが、余白は操作できない）。
 */
export const AUDIT_LOG_ROW_HEIGHT = 60

/** 高さがまだ測れていないときに使う件数 */
export const FALLBACK_AUDIT_LOG_PAGE_SIZE = 10
