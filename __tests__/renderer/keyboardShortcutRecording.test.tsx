// @vitest-environment jsdom
/**
 * 設定画面の**キー記録**が、採点画面の**キー突き合わせ**と同じ綴りを作ることの検査。
 *
 * 記録側は `event.key` をそのまま保存していた。Shift を押しながら `d` を記録すると
 * `"D"` が保存され、押す側が作る `"Shift+d"`（`normalizeKey`）とは**元々一致しない**
 * ——つまり修飾キー付きの割り当ては、記録の時点で壊れていた。macOS の Option は
 * さらに悪く、`event.key` が `"Dead"` になるので `"Dead"` という割り当てが保存される。
 *
 * ここで押す側の期待値を文字列で書き写さず `normalizeKey` から作るのは、**規則を
 * 2つ書かない**ことがこの修正の本体だから。記録側が自前の綴りへ戻れば、この検査は
 * 押す側との食い違いとして落ちる。
 */

import "./setup"

import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useKeyboardSettings } from "@/app/(app)/settings/hooks/useKeyboardSettings"
import { DEFAULT_KEYBINDINGS } from "@/components/exams/07-score-at-once/constants/scoringKeybindings"
// 押す側（`ShortcutProvider` の keydown）が突き合わせに使っている当のもの
import { normalizeKey } from "@/components/exams/07-score-at-once/ScoringMain/utils/normalizeKey"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../helpers/queryWrapper"

const currentUser: PublicUser = {
  id: "user-1",
  username: "testuser",
  name: "テストユーザー",
  role: "admin",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const getUserKeyboardShortcuts = vi.fn()
const saveUserKeyboardShortcuts = vi.fn()

beforeEach(() => {
  getUserKeyboardShortcuts.mockReset()
  saveUserKeyboardShortcuts.mockReset()
  // 利用者はまだ何も変えていない（既定のまま）
  getUserKeyboardShortcuts.mockResolvedValue({})
  saveUserKeyboardShortcuts.mockResolvedValue(undefined)
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: { getUserKeyboardShortcuts, saveUserKeyboardShortcuts },
    },
    writable: true,
    configurable: true,
  })
})

function renderKeyboardSettings() {
  const QueryWrapper = createQueryWrapper()
  return renderHook(() => useKeyboardSettings(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryWrapper>
        <CurrentUserProvider user={currentUser}>{children}</CurrentUserProvider>
      </QueryWrapper>
    ),
  })
}

/** 実際に押されたキーを1つ作る（押す側の期待値も同じ物から作る） */
function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  })
}

describe("設定画面のキー記録", () => {
  it("Shift+d を記録すると、押す側が作る鍵と一致する", () => {
    const { result } = renderKeyboardSettings()

    act(() => result.current.handleKeyEdit("navigation.nextQuestion"))

    const shiftD = keydown({ key: "D", code: "KeyD", shiftKey: true })
    act(() => {
      window.dispatchEvent(shiftD)
    })

    expect(result.current.pendingKey).toBe(normalizeKey(shiftD))
    // 綴りそのもの（押す側の実装が変わったことを検査が黙って追随しないように）
    expect(result.current.pendingKey).toBe("Shift+d")
  })

  it("macOS の Option はデッドキーではなく本体のキーで記録する", () => {
    const { result } = renderKeyboardSettings()

    act(() => result.current.handleKeyEdit("filter.toggleUnscored"))

    // Option+Q は `event.key` が "Dead" になる。押す側は `code` から読み替える
    const altQ = keydown({ key: "Dead", code: "KeyQ", altKey: true })
    act(() => {
      window.dispatchEvent(altQ)
    })

    expect(result.current.pendingKey).toBe(normalizeKey(altQ))
    expect(result.current.pendingKey).toBe("Alt+q")
  })

  it("修飾キーなしの記録はこれまで通り", () => {
    const { result } = renderKeyboardSettings()

    act(() => result.current.handleKeyEdit("scoring.correct"))

    const plainD = keydown({ key: "d", code: "KeyD" })
    act(() => {
      window.dispatchEvent(plainD)
    })

    expect(result.current.pendingKey).toBe(normalizeKey(plainD))
    expect(result.current.pendingKey).toBe("d")
  })

  it("保存される割り当ても押す側と同じ綴りになる", async () => {
    const { result } = renderKeyboardSettings()

    act(() => result.current.handleKeyEdit("scoring.correct"))

    // 既定のどれとも重ならないキー（重複チェックで弾かれると保存まで届かない）
    const shiftZ = keydown({ key: "Z", code: "KeyZ", shiftKey: true })
    act(() => {
      window.dispatchEvent(shiftZ)
    })

    await act(async () => {
      await result.current.handleKeySave()
    })

    await waitFor(() => expect(saveUserKeyboardShortcuts).toHaveBeenCalled())
    const [userId, savedShortcuts] = saveUserKeyboardShortcuts.mock.calls[0]
    expect(userId).toBe(currentUser.id)
    expect(savedShortcuts["scoring.correct"]).toBe(normalizeKey(shiftZ))
    expect(savedShortcuts["scoring.correct"]).toBe("Shift+z")
    // 触っていない割り当ては既定のまま
    expect(savedShortcuts["navigation.nextQuestion"]).toBe(
      DEFAULT_KEYBINDINGS["navigation.nextQuestion"]
    )
  })
})
