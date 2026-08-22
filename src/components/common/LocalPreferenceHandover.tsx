"use client"

import { useMutation } from "@tanstack/react-query"
import { useEffect } from "react"

import type { SidebarBehaviorPreferenceKey } from "@/components/layout/sidebarBehavior"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  isOneOf,
  SCORING_OPERATION_MODES,
  SIDEBAR_BEHAVIORS,
} from "@/lib/userPreferences"
import type { SetUserPreferenceInput } from "@/queries/settings"
import { setUserPreferenceMutation } from "@/queries/settings"

/**
 * `localStorage` に残っている設定を、利用者の設定（`UserPreference`）へ一度だけ写す。
 * 描くものは無い。
 *
 * サイドバーの動作と採点モードは端末に付いていたが、どちらも利用者に付く性質のもので、
 * 段階55 で DB へ寄せた。**寄せただけでは、既に設定していた人が設定し直す羽目になる**
 * ので、最初にこの部品が写す。
 *
 * **旧い鍵を知っているのはここだけ。** 生きている側（`sidebarBehavior.ts` /
 * `useScoringMode.ts`）は DB の鍵しか持たない。写し終えれば鍵は消えるので、この部品も
 * いつか消せる。
 *
 * 置き場所が `(app)` の直下なのは、写す先が利用者に付くから。関門の外には写す相手が
 * 居ない。
 */

/** 区分ごとのサイドバー動作。旧い鍵と、写す先の設定キー */
const LEGACY_SIDEBAR_STORAGE_KEYS: {
  preferenceKey: SidebarBehaviorPreferenceKey
  storageKey: string
}[] = [
  {
    preferenceKey: "sidebarBehaviorExams",
    storageKey: "sidebarBehavior_exams",
  },
  {
    preferenceKey: "sidebarBehaviorAnswerSheetBuilder",
    storageKey: "sidebarBehavior_answerSheetBuilder",
  },
  {
    preferenceKey: "sidebarBehaviorPdfTools",
    storageKey: "sidebarBehavior_pdfTools",
  },
  {
    preferenceKey: "sidebarBehaviorGrades",
    storageKey: "sidebarBehavior_grades",
  },
]

/** 区分ごとに分ける前の、全区分に効いていた鍵 */
const LEGACY_SHARED_SIDEBAR_STORAGE_KEY = "sidebarBehaviorOnWorkPage"
const LEGACY_SCORING_MODE_STORAGE_KEY = "scoring-operation-mode"
const LEGACY_SCORING_MODE_REMEMBER_STORAGE_KEY =
  "scoring-operation-mode-remember"

interface LegacyPreferences {
  /** DB へ写す値 */
  inputs: SetUserPreferenceInput[]
  /** 写し終えたら消す鍵。**写す値が無くても、役目を終えた鍵はここに入る** */
  storageKeys: string[]
}

function readLocalStorageText(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    // 使えない環境では「保存が無い」とみなす（写すものも無い）
    return null
  }
}

function removeLocalStorageText(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // 消せない環境では読むこともできないので、次の起動でも写しに来ない
  }
}

function collectLegacyPreferences(): LegacyPreferences {
  const inputs: SetUserPreferenceInput[] = []
  const storageKeys: string[] = []

  const sharedBehaviorText = readLocalStorageText(
    LEGACY_SHARED_SIDEBAR_STORAGE_KEY
  )
  if (sharedBehaviorText !== null) {
    storageKeys.push(LEGACY_SHARED_SIDEBAR_STORAGE_KEY)
  }

  for (const legacySidebar of LEGACY_SIDEBAR_STORAGE_KEYS) {
    const behaviorText = readLocalStorageText(legacySidebar.storageKey)
    if (behaviorText !== null) storageKeys.push(legacySidebar.storageKey)

    // 区分ごとの設定が無ければ全区分の鍵を見る（読み替えの順は移す前と同じ）
    const behavior = behaviorText ?? sharedBehaviorText
    if (behavior !== null && isOneOf(SIDEBAR_BEHAVIORS, behavior)) {
      inputs.push({ key: legacySidebar.preferenceKey, value: behavior })
    }
  }

  const modeText = readLocalStorageText(LEGACY_SCORING_MODE_STORAGE_KEY)
  const rememberText = readLocalStorageText(
    LEGACY_SCORING_MODE_REMEMBER_STORAGE_KEY
  )
  if (modeText !== null) storageKeys.push(LEGACY_SCORING_MODE_STORAGE_KEY)
  if (rememberText !== null) {
    storageKeys.push(LEGACY_SCORING_MODE_REMEMBER_STORAGE_KEY)
  }

  // 憶えていた人だけを写す。憶えていなければ DB の既定と同じ意味なので、鍵を捨てるだけ
  if (
    rememberText === "true" &&
    modeText !== null &&
    isOneOf(SCORING_OPERATION_MODES, modeText)
  ) {
    inputs.push({ key: "scoringOperationMode", value: modeText })
    inputs.push({ key: "scoringOperationModeRemembered", value: true })
  }

  return { inputs, storageKeys }
}

/**
 * 写した利用者。**同じ窓で二度書かないための印。**
 *
 * 写し終えれば鍵が消えるので、次に開いたときは鍵が無いところで止まる。この印が要るのは
 * その前——同じ窓の中で effect が二度走る場合（開発時の二重描画など）で、鍵はまだ
 * 消えていないため判定を素通りしてしまう。
 */
const handedOverUserIds = new Set<string>()

export function LocalPreferenceHandover() {
  const userId = useCurrentUser().id
  const { mutateAsync } = useMutation(setUserPreferenceMutation(userId))

  useEffect(() => {
    if (handedOverUserIds.has(userId)) return

    const { inputs, storageKeys } = collectLegacyPreferences()
    if (storageKeys.length === 0) return

    // 走らせる前に印を付ける。書き終わりを待って付けると、その間に来た2度目が走る
    handedOverUserIds.add(userId)

    void (async () => {
      try {
        // 1キーずつ書く（同じ `scope` なのでどのみち直列に走る）。**全部書けてから
        // 鍵を消す**ので、途中で失敗した回は何も消えず、次の起動でもう一度写せる
        for (const input of inputs) {
          await mutateAsync(input)
        }
      } catch {
        // 書けなかった。鍵を残して次の起動へ譲る（この窓では二度と試さない）
        return
      }
      for (const storageKey of storageKeys) {
        removeLocalStorageText(storageKey)
      }
    })()
  }, [userId, mutateAsync])

  return null
}
