// @vitest-environment jsdom
/**
 * 利用者の設定を `localStorage` から `UserPreference` へ移した（段階55）ことの検査。
 *
 * 設定画面の中で、画面消灯は DB・サイドバーの動作だけが `localStorage` という割れ方を
 * していた。採点モードも同じ性格（端末ではなく利用者に付く）で外に残っていた。
 *
 * 固定するのは3点。
 *
 * 1. **保存先が DB になった。** 読みも書きも `UserPreference` の行を通り、設定画面の
 *    書き込みがサイドバー本体へ届く。取得は非同期なので、読めるまでは既定で描く。
 * 2. **既にある値を捨てない。** `LocalPreferenceHandover` が旧い鍵を一度だけ写し、
 *    写し終えてから鍵を消す。**二度は書かず、書けなかった回は鍵を残す**（次の起動で
 *    もう一度写せる）。
 * 3. **「憶えない」の意味が変わらない。** 憶えないときは既定へ戻すので、次に採点画面へ
 *    入れば選択が出る（鍵を消していた頃と同じ）。
 */

import "./setup"

import { act, render, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LocalPreferenceHandover } from "@/components/common/LocalPreferenceHandover"
import { useScoringMode } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMode"
import {
  SIDEBAR_SECTIONS,
  useSidebarBehavior,
} from "@/components/layout/sidebarBehavior"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import { serializePreference } from "@/lib/userPreferences"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../helpers/queryWrapper"

/** DB の代わり。`${userId}:${key}` で1行 */
const storedPreferences = new Map<string, string>()
const getUserPreference = vi.fn()
const setUserPreference = vi.fn()

/**
 * 写しは「一度だけ」を窓ごとに憶えている（モジュールの印）。テストごとに別の利用者を
 * 使い、前の検査の印を引きずらない
 */
let userSerialNumber = 0
function nextUserId(): string {
  userSerialNumber += 1
  return `user-${userSerialNumber}`
}

function testUser(userId: string): PublicUser {
  return {
    id: userId,
    username: "testuser",
    name: "テストユーザー",
    role: "admin",
    passcodeType: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }
}

beforeEach(() => {
  localStorage.clear()
  storedPreferences.clear()
  getUserPreference.mockReset()
  setUserPreference.mockReset()
  getUserPreference.mockImplementation((userId: string, key: string) =>
    Promise.resolve(storedPreferences.get(`${userId}:${key}`) ?? null)
  )
  setUserPreference.mockImplementation(
    (userId: string, key: string, value: string) => {
      storedPreferences.set(`${userId}:${key}`, value)
      return Promise.resolve()
    }
  )
  Object.defineProperty(window, "electronAPI", {
    value: { settings: { getUserPreference, setUserPreference } },
    writable: true,
    configurable: true,
  })
})

/** DB に既に入っている値を置く */
function seedPreference(
  userId: string,
  key: Parameters<typeof serializePreference>[0],
  storedText: string
) {
  storedPreferences.set(`${userId}:${key}`, storedText)
}

/** 写しを1回走らせ、落ち着くまで待つ */
async function renderHandover(userId: string) {
  const QueryWrapper = createQueryWrapper()
  const view = render(
    <QueryWrapper>
      <CurrentUserProvider user={testUser(userId)}>
        <LocalPreferenceHandover />
      </CurrentUserProvider>
    </QueryWrapper>
  )
  await act(async () => {
    await Promise.resolve()
  })
  return view
}

describe("useSidebarBehavior", () => {
  it("保存された動作を DB から読む", async () => {
    const userId = nextUserId()
    const section = SIDEBAR_SECTIONS[0]
    seedPreference(
      userId,
      section.preferenceKey,
      serializePreference(section.preferenceKey, "collapse")
    )

    const { result } = renderHook(() => useSidebarBehavior(userId, section), {
      wrapper: createQueryWrapper(),
    })

    // 取得は非同期。読めるまでは「変更しない」で描く
    expect(result.current.behavior).toBe("none")
    await waitFor(() => expect(result.current.behavior).toBe("collapse"))
  })

  it("設定画面の書き込みがサイドバー側へ届く", async () => {
    const userId = nextUserId()
    const section = SIDEBAR_SECTIONS[1]
    const QueryWrapper = createQueryWrapper()
    const settingsRow = renderHook(() => useSidebarBehavior(userId, section), {
      wrapper: QueryWrapper,
    })
    const appShell = renderHook(() => useSidebarBehavior(userId, section), {
      wrapper: QueryWrapper,
    })

    act(() => {
      settingsRow.result.current.setBehavior("expand")
    })

    await waitFor(() => expect(appShell.result.current.behavior).toBe("expand"))
    expect(setUserPreference).toHaveBeenCalledWith(
      userId,
      section.preferenceKey,
      serializePreference(section.preferenceKey, "expand")
    )
  })
})

describe("LocalPreferenceHandover", () => {
  it("区分ごとの旧い鍵を写し、写し終えてから消す", async () => {
    const userId = nextUserId()
    localStorage.setItem("sidebarBehavior_exams", "collapse")
    localStorage.setItem("sidebarBehavior_grades", "expand")

    await renderHandover(userId)

    await waitFor(() =>
      expect(storedPreferences.get(`${userId}:sidebarBehaviorExams`)).toBe(
        serializePreference("sidebarBehaviorExams", "collapse")
      )
    )
    expect(storedPreferences.get(`${userId}:sidebarBehaviorGrades`)).toBe(
      serializePreference("sidebarBehaviorGrades", "expand")
    )
    expect(localStorage.getItem("sidebarBehavior_exams")).toBeNull()
    expect(localStorage.getItem("sidebarBehavior_grades")).toBeNull()
  })

  it("区分ごとの設定が無ければ、全区分に効いていた旧い鍵を写す", async () => {
    const userId = nextUserId()
    localStorage.setItem("sidebarBehaviorOnWorkPage", "collapse")
    localStorage.setItem("sidebarBehavior_pdfTools", "none")

    await renderHandover(userId)

    await waitFor(() =>
      expect(storedPreferences.get(`${userId}:sidebarBehaviorExams`)).toBe(
        serializePreference("sidebarBehaviorExams", "collapse")
      )
    )
    // 区分ごとの設定は旧い鍵より強い
    expect(storedPreferences.get(`${userId}:sidebarBehaviorPdfTools`)).toBe(
      serializePreference("sidebarBehaviorPdfTools", "none")
    )
    expect(localStorage.getItem("sidebarBehaviorOnWorkPage")).toBeNull()
  })

  it("憶えていた採点モードは写し、憶えていなければ鍵を捨てるだけ", async () => {
    const rememberedUserId = nextUserId()
    localStorage.setItem("scoring-operation-mode", "mouse")
    localStorage.setItem("scoring-operation-mode-remember", "true")

    await renderHandover(rememberedUserId)

    await waitFor(() =>
      expect(
        storedPreferences.get(`${rememberedUserId}:scoringOperationMode`)
      ).toBe(serializePreference("scoringOperationMode", "mouse"))
    )
    expect(
      storedPreferences.get(
        `${rememberedUserId}:scoringOperationModeRemembered`
      )
    ).toBe(serializePreference("scoringOperationModeRemembered", true))
    expect(localStorage.getItem("scoring-operation-mode")).toBeNull()

    const forgottenUserId = nextUserId()
    localStorage.setItem("scoring-operation-mode", "mouse")

    await renderHandover(forgottenUserId)

    await waitFor(() =>
      expect(localStorage.getItem("scoring-operation-mode")).toBeNull()
    )
    expect(
      storedPreferences.has(`${forgottenUserId}:scoringOperationMode`)
    ).toBe(false)
  })

  it("二度は書かない（写したあとも、旧い鍵が無いときも）", async () => {
    const userId = nextUserId()
    localStorage.setItem("sidebarBehavior_exams", "collapse")

    const first = await renderHandover(userId)
    await waitFor(() =>
      expect(localStorage.getItem("sidebarBehavior_exams")).toBeNull()
    )
    first.unmount()
    setUserPreference.mockClear()

    // 同じ窓でもう一度載っても走らない
    await renderHandover(userId)
    expect(setUserPreference).not.toHaveBeenCalled()

    // 旧い鍵が無ければ、別の利用者でも書かない
    await renderHandover(nextUserId())
    expect(setUserPreference).not.toHaveBeenCalled()
  })

  it("書けなかった回は鍵を残す", async () => {
    const userId = nextUserId()
    localStorage.setItem("sidebarBehavior_exams", "collapse")
    setUserPreference.mockRejectedValue(new Error("書けない"))

    await renderHandover(userId)

    await waitFor(() => expect(setUserPreference).toHaveBeenCalled())
    expect(localStorage.getItem("sidebarBehavior_exams")).toBe("collapse")
  })
})

describe("useScoringMode", () => {
  /** 採点モードのフックを1つ載せる */
  function renderScoringMode(userId: string) {
    return renderHook(() => useScoringMode(userId), {
      wrapper: createQueryWrapper(),
    })
  }

  it("読み終わるまで選択は出さず、憶えていなければ出す", async () => {
    const userId = nextUserId()
    const { result } = renderScoringMode(userId)

    // 読めていない間に出すと、憶えている人にも一瞬見えて勝手に閉じる
    expect(result.current.showModeSelectionModal).toBe(false)
    await waitFor(() =>
      expect(result.current.showModeSelectionModal).toBe(true)
    )
    expect(result.current.scoringOperationMode).toBe("keyboard")
  })

  it("憶えていればそのモードで始まり、選択は出さない", async () => {
    const userId = nextUserId()
    seedPreference(
      userId,
      "scoringOperationMode",
      serializePreference("scoringOperationMode", "mouse")
    )
    seedPreference(
      userId,
      "scoringOperationModeRemembered",
      serializePreference("scoringOperationModeRemembered", true)
    )

    const { result } = renderScoringMode(userId)

    await waitFor(() =>
      expect(result.current.scoringOperationMode).toBe("mouse")
    )
    expect(result.current.showModeSelectionModal).toBe(false)
  })

  it("憶える選択は DB に残る", async () => {
    const userId = nextUserId()
    const { result } = renderScoringMode(userId)
    await waitFor(() =>
      expect(result.current.showModeSelectionModal).toBe(true)
    )

    act(() => {
      result.current.selectMode("mouse", true)
    })

    await waitFor(() =>
      expect(storedPreferences.get(`${userId}:scoringOperationMode`)).toBe(
        serializePreference("scoringOperationMode", "mouse")
      )
    )
    expect(
      storedPreferences.get(`${userId}:scoringOperationModeRemembered`)
    ).toBe(serializePreference("scoringOperationModeRemembered", true))
    expect(result.current.scoringOperationMode).toBe("mouse")
    expect(result.current.showModeSelectionModal).toBe(false)
  })

  it("憶えない選択は既定へ戻す（次に入れば選択が出る）", async () => {
    const userId = nextUserId()
    seedPreference(
      userId,
      "scoringOperationMode",
      serializePreference("scoringOperationMode", "mouse")
    )
    seedPreference(
      userId,
      "scoringOperationModeRemembered",
      serializePreference("scoringOperationModeRemembered", true)
    )
    const { result } = renderScoringMode(userId)
    await waitFor(() =>
      expect(result.current.scoringOperationMode).toBe("mouse")
    )

    act(() => {
      result.current.selectMode("mouse", false)
    })

    await waitFor(() =>
      expect(
        storedPreferences.get(`${userId}:scoringOperationModeRemembered`)
      ).toBe(serializePreference("scoringOperationModeRemembered", false))
    )
    expect(storedPreferences.get(`${userId}:scoringOperationMode`)).toBe(
      serializePreference("scoringOperationMode", "keyboard")
    )
    // この画面ではマウスのまま採点する（憶えないだけ）
    expect(result.current.scoringOperationMode).toBe("mouse")

    // 次に採点画面へ入った人には、また選択が出る
    const next = renderScoringMode(userId)
    await waitFor(() =>
      expect(next.result.current.showModeSelectionModal).toBe(true)
    )
  })

  it("憶えていない人の切り替えは書かない", async () => {
    const userId = nextUserId()
    const { result } = renderScoringMode(userId)
    await waitFor(() =>
      expect(result.current.showModeSelectionModal).toBe(true)
    )
    setUserPreference.mockClear()

    act(() => {
      result.current.setScoringOperationMode("mouse")
    })

    expect(result.current.scoringOperationMode).toBe("mouse")
    expect(setUserPreference).not.toHaveBeenCalled()
  })
})
