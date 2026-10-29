"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useNavigationGuardContext } from "@/contexts/NavigationGuardContext"
import {
  courseworkWorkflowTabs,
  examWorkflowTabs,
  findWorkflowStepLabel,
  gradeWorkflowTabs,
} from "@/lib/workflowTabs"
import { answerSheetDefinitionQuery } from "@/queries/answerSheetBuilder"
import { courseworkDetailQuery } from "@/queries/coursework"
import { examDetailQuery } from "@/queries/exam"
import { gradeDetailQuery } from "@/queries/grade"

/** 履歴メニューに表示する1エントリ（ラベル解決済み） */
export interface NavigationMenuEntry {
  /** 履歴の中の位置（戻る側・進む側を分けるのに使う） */
  index: number
  /** 履歴のエントリの識別子（`navigation.traverseTo` の行き先。React の key にも使う） */
  key: string
  label: string
  /** URL先頭セグメント（AppShellと同じセクションアイコンの選択に使う） */
  section: string
  isActive: boolean
}

/** 固有名を持つエンティティの種別（URLから判定） */
type EntityKind = "exam" | "grade" | "coursework" | "asb"

interface RouteLabel {
  base: string
  /**
   * ワークフローのサブステップ名（例: 「4. 小計点」）。段のある詳細ページ配下でのみ付く。
   * 名前は各 layout.tsx と同じ `@/lib/workflowTabs` から引く（写しを持たない）。
   */
  step?: string
  entity?: { kind: EntityKind; id: string }
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
            step: findWorkflowStepLabel(examWorkflowTabs, third),
            entity: { kind: "exam", id: second },
          }
        : { base: "試験" }
    case "answer-sheet-builder":
      return second
        ? { base: "解答用紙作成", entity: { kind: "asb", id: second } }
        : { base: "解答用紙作成" }
    case "grades":
      return second
        ? {
            base: "成績算出",
            step: findWorkflowStepLabel(gradeWorkflowTabs, third),
            entity: { kind: "grade", id: second },
          }
        : { base: "成績算出" }
    case "coursework":
      return second
        ? {
            base: "試験外成績資料",
            step: findWorkflowStepLabel(courseworkWorkflowTabs, third),
            entity: { kind: "coursework", id: second },
          }
        : { base: "試験外成績資料" }
    case "students":
      return { base: "生徒管理" }
    case "classrooms":
      return { base: "学級管理" }
    case "subtotal-groups":
      return { base: "小計点管理" }
    case "score-scales":
      return { base: "類型表管理" }
    case "tags":
      return { base: "タグ管理" }
    case "data-import":
      return { base: "データ読み込み" }
    case "data-export":
      return { base: "データ書き出し" }
    case "pdf-tools":
      return { base: "PDF加工" }
    case "settings":
      return { base: "設定" }
    default:
      return { base: `/${segments.join("/")}` }
  }
}

/**
 * 固有名は各画面が読むものと同じキャッシュから引く。
 *
 * `ensureQueryData` は載っていれば往復せず、無ければ1度だけ取る。かつては
 * このファイルが持つ `Map` に溜めていたが、そちらは**取り直しの手立てが無い**
 * ので、試験の名前を変えても履歴には古い名前が残り続けていた。
 */
async function resolveEntityName(
  queryClient: QueryClient,
  kind: EntityKind,
  id: string
): Promise<string | null> {
  try {
    if (kind === "exam") {
      const exam = await queryClient.ensureQueryData(examDetailQuery(id))
      return exam?.examName ?? null
    }
    if (kind === "grade") {
      const grade = await queryClient.ensureQueryData(gradeDetailQuery(id))
      return grade.name
    }
    if (kind === "coursework") {
      const coursework = await queryClient.ensureQueryData(
        courseworkDetailQuery(id)
      )
      return coursework.name
    }
    const definition = await queryClient.ensureQueryData(
      answerSheetDefinitionQuery(id)
    )
    return definition.name
  } catch {
    return null
  }
}

/** URLから履歴メニュー用のラベルとセクションを組み立てる（固有名が引ければ「セクション｜固有名」） */
async function buildEntry(
  queryClient: QueryClient,
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

  const name = await resolveEntityName(queryClient, entity.kind, entity.id)
  // 「セクション｜ステップ｜固有名」（ステップ・固有名は解決できたものだけ連結）
  const label = [base, step, name].filter(Boolean).join("｜")
  return { label, section }
}

interface UseNavigationHistoryResult {
  canGoBack: boolean
  canGoForward: boolean
  /** 今いるエントリを含む全履歴エントリ（新しい順に反転済み） */
  entries: NavigationMenuEntry[]
  goBack: () => void
  goForward: () => void
  /** 履歴のエントリ（`NavigationMenuEntry.key`）へ移る */
  goToEntry: (key: string) => void
}

/**
 * 窓のセッション履歴を Navigation API（`window.navigation`）で読み、ブラウザ的な
 * 戻る/進む・履歴一覧を提供するフック。Electron の renderer もブラウザも Chromium なので、
 * main に訊かずに同じコードで読める。Navigation API が無い環境（Chromium 以外のブラウザ・
 * テスト環境）では、戻れない・進めない・一覧は空として扱う。
 *
 * 履歴状態は今いるエントリが変わるたび（`currententrychange`）に読み直し、各エントリの
 * ラベルを非同期解決する。Alt+← やマウスの第4ボタンのようにアプリを通さない行き来でも、
 * 履歴そのものを読むのでずれない。
 *
 * **移動は必ず未保存のガードを通す。** ここで `router.back()` を直に呼ぶと書きかけを
 * 黙って捨てる。包んでおけば、このフックを使う画面はどれも確認を通る。
 *
 * ガードは Navigation API の `navigate` でマウスの第4/第5ボタンも止めるが、
 * そちらはスクリプトから起こした移動を取り消せないことがある（画面に触っていない状態で
 * 行き来すると `cancelable` が false になる）。押す前に訊けるこちらを通す。
 */
export function useNavigationHistory(): UseNavigationHistoryResult {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { guardedTraverse } = useNavigationGuardContext()
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [entries, setEntries] = useState<NavigationMenuEntry[]>([])

  useEffect(() => {
    // Chromium 以外（`next dev` を素のブラウザで開いたとき）とテスト環境には無い
    if (typeof window.navigation === "undefined") return
    const navigation = window.navigation
    let cancelled = false

    const refresh = async () => {
      setCanGoBack(navigation.canGoBack)
      setCanGoForward(navigation.canGoForward)

      const activeKey = navigation.currentEntry?.key
      const labeled = await Promise.all(
        navigation
          .entries()
          .filter((entry) => entry.url !== null)
          .map(async (entry) => {
            const { label, section } = await buildEntry(
              queryClient,
              entry.url ?? ""
            )
            return {
              index: entry.index,
              key: entry.key,
              label,
              section,
              isActive: entry.key === activeKey,
            }
          })
      )
      if (cancelled) return

      // 新しい履歴を上に表示する（ブラウザの履歴メニューに倣う）
      setEntries(labeled.reverse())
    }

    // Next.js はルーターの URL を `useInsertionEffect` の中の `history.pushState` で
    // 書き込み、それが同期的に `currententrychange` を起こす。その場で setState すると
    // React に「useInsertionEffect must not schedule updates」で止められるので、
    // コミットが終わってから読み直す
    const handleCurrentEntryChange = () => {
      queueMicrotask(() => {
        if (cancelled) return
        void refresh()
      })
    }
    void refresh()
    navigation.addEventListener("currententrychange", handleCurrentEntryChange)
    return () => {
      cancelled = true
      navigation.removeEventListener(
        "currententrychange",
        handleCurrentEntryChange
      )
    }
  }, [queryClient])

  const goToEntry = useCallback(
    (key: string) =>
      guardedTraverse(() => {
        // 一覧は Navigation API があるときしか作らないので、ここに来るなら在る
        if (typeof window.navigation === "undefined") return
        // 行き先が既に履歴から消えていれば拒否される。押したのに何も起きない画面にしない
        void window.navigation.traverseTo(key).committed?.catch(() => {
          toast.error("履歴を移動できませんでした")
        })
      }),
    [guardedTraverse]
  )

  const goBack = useCallback(
    () => guardedTraverse(() => router.back()),
    [guardedTraverse, router]
  )

  const goForward = useCallback(
    () => guardedTraverse(() => router.forward()),
    [guardedTraverse, router]
  )

  return {
    canGoBack,
    canGoForward,
    entries,
    goBack,
    goForward,
    goToEntry,
  }
}
