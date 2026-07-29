"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

/** 履歴メニューに表示する1エントリ（ラベル解決済み） */
export interface NavigationMenuEntry {
  index: number
  label: string
  /** URL先頭セグメント（AppShellと同じセクションアイコンの選択に使う） */
  section: string
  isActive: boolean
}

/** 固有名を持つエンティティの種別（URLから判定） */
type EntityKind = "exam" | "grade" | "coursework" | "asb"

interface RouteLabel {
  base: string
  /** ワークフローのサブステップ名（例: 「4. 小計点」）。試験詳細ページ配下でのみ付く */
  step?: string
  entity?: { kind: EntityKind; id: string }
}

// 各ワークフローのステップフォルダ→表示名（対応する [id]/layout.tsx のステップ定義と揃える）
const EXAM_STEP_LABELS: Record<string, string> = {
  "01-upload": "1. 模範解答",
  "02-template": "2. 採点領域",
  "03-region-info": "3. 領域情報",
  "04-question-group": "4. 小計点",
  "05-students": "5. 受験生徒",
  "06-student-answers": "6. 生徒答案",
  "07-score-at-once": "7. 採点",
  "08-export": "8. 結果",
}

const GRADE_STEP_LABELS: Record<string, string> = {
  "01-setup": "1. 基本設定",
  "02-students": "2. 生徒管理",
  "03-data-sources": "3. データソース",
  "04-manual-scores": "4. 外部成績",
  "05-boundaries": "5. 成績境界",
  "06-results": "6. 結果",
  "07-export": "7. 出力",
}

const COURSEWORK_STEP_LABELS: Record<string, string> = {
  "01-setup": "1. 基本設定",
  "02-students": "2. 生徒管理",
  "03-items": "3. 評価項目",
  "04-scores": "4. 点数入力",
  "05-results": "5. 結果",
}

/** pathname を「セクション名」と（あれば）ステップ名・固有名を引くためのエンティティ情報へ変換する */
function routeToLabel(pathname: string): RouteLabel {
  const segments = pathname.split("/").filter(Boolean)
  const [first, second, third] = segments

  switch (first) {
    case undefined:
    case "login":
      return { base: "ログイン" }
    case "dashboard":
      return { base: "ダッシュボード" }
    case "exams":
      return second
        ? {
            base: "試験",
            step: EXAM_STEP_LABELS[third],
            entity: { kind: "exam", id: second },
          }
        : { base: "試験一覧" }
    case "answer-sheet-builder":
      return second
        ? { base: "解答用紙作成", entity: { kind: "asb", id: second } }
        : { base: "解答用紙作成" }
    case "grades":
      return second
        ? {
            base: "成績算出",
            step: GRADE_STEP_LABELS[third],
            entity: { kind: "grade", id: second },
          }
        : { base: "成績算出" }
    case "coursework":
      return second
        ? {
            base: "試験外成績資料",
            step: COURSEWORK_STEP_LABELS[third],
            entity: { kind: "coursework", id: second },
          }
        : { base: "試験外成績資料" }
    case "students":
      return { base: "生徒管理" }
    case "classrooms":
      return { base: "学級管理" }
    case "subtotal-groups":
      return { base: "小計点管理" }
    case "tags":
      return { base: "タグ管理" }
    case "pdf-tools":
      return { base: "PDF加工" }
    case "settings":
      return { base: "設定" }
    default:
      return { base: `/${segments.join("/")}` }
  }
}

// 固有名はセッション中変化が稀なため、モジュールスコープでキャッシュする
const entityNameCache = new Map<string, string>()

async function resolveEntityName(
  kind: EntityKind,
  id: string
): Promise<string | null> {
  const cacheKey = `${kind}:${id}`
  const cached = entityNameCache.get(cacheKey)
  if (cached !== undefined) return cached

  try {
    let name: string | null = null
    if (kind === "exam") {
      const exam = await window.electronAPI.getExam(id)
      name = exam?.examName ?? null
    } else if (kind === "grade") {
      const result = await window.electronAPI.grade.getById(id)
      name = result.grade?.name ?? null
    } else if (kind === "coursework") {
      const result = await window.electronAPI.coursework.getById(id)
      name = result.coursework?.name ?? null
    } else if (kind === "asb") {
      const result =
        await window.electronAPI.answerSheetBuilder.loadDefinition(id)
      name = result.data?.name ?? null
    }
    if (name) entityNameCache.set(cacheKey, name)
    return name
  } catch {
    return null
  }
}

/** URLから履歴メニュー用のラベルとセクションを組み立てる（固有名が引ければ「セクション｜固有名」） */
async function buildEntry(
  url: string
): Promise<{ label: string; section: string }> {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    pathname = url
  }

  const section = pathname.split("/").filter(Boolean)[0] ?? "login"
  const { base, step, entity } = routeToLabel(pathname)
  if (!entity) return { label: base, section }

  const name = await resolveEntityName(entity.kind, entity.id)
  // 「セクション｜ステップ｜固有名」（ステップ・固有名は解決できたものだけ連結）
  const label = [base, step, name].filter(Boolean).join("｜")
  return { label, section }
}

interface UseNavigationHistoryResult {
  canGoBack: boolean
  canGoForward: boolean
  /** activeIndex を含む全履歴エントリ（新しい順に反転済み） */
  entries: NavigationMenuEntry[]
  goBack: () => void
  goForward: () => void
  goToIndex: (index: number) => void
}

/**
 * Electron のセッション履歴を用いてブラウザ的な戻る/進む・履歴一覧を提供するフック。
 * 履歴状態は遷移（pathname 変化）ごとに再取得し、各エントリのラベルを非同期解決する。
 */
export function useNavigationHistory(): UseNavigationHistoryResult {
  const router = useRouter()
  const pathname = usePathname()
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [entries, setEntries] = useState<NavigationMenuEntry[]>([])

  const refresh = useCallback(() => {
    let cancelled = false

    const run = async () => {
      const api = window.electronAPI?.navigation
      if (!api) return

      const state = await api.getState()
      if (cancelled) return

      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)

      const labeled = await Promise.all(
        state.entries.map(async (entry) => {
          const { label, section } = await buildEntry(entry.url)
          return {
            index: entry.index,
            label,
            section,
            isActive: entry.index === state.activeIndex,
          }
        })
      )
      if (cancelled) return

      // 新しい履歴を上に表示する（ブラウザの履歴メニューに倣う）
      setEntries(labeled.reverse())
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  // 遷移ごとに履歴状態を再取得する
  useEffect(() => {
    const cleanup = refresh()
    return cleanup
  }, [pathname, refresh])

  const goToIndex = useCallback((index: number) => {
    void window.electronAPI?.navigation?.goToIndex(index)
  }, [])

  return {
    canGoBack,
    canGoForward,
    entries,
    goBack: () => router.back(),
    goForward: () => router.forward(),
    goToIndex,
  }
}
