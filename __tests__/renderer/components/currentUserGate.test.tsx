// @vitest-environment jsdom
/**
 * 関門（`AuthGate`）が保証している「利用者は必ず居る」を、型ではなく**動きで**固定する。
 *
 * `(app)` の中では `useCurrentUser()` が `PublicUser` を返す。ここが崩れると、
 * 呼び出し側は `userId ?? ""` のような詰め物を戻すしかなくなる。空文字は
 * `User.id` として存在しないので、本当に渡れば FK 違反で落ちる。
 *
 * 固定するのは3つ:
 * - 関門の外で `useCurrentUser()` を呼べば例外になる（気づかず素通りしない）
 * - 関門が絞り込んだ利用者が、そのまま子へ届く
 * - 利用者が居ない・読み込み中は子を描かない（＝上の保証が成り立つ理由）
 */

import "../setup"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import AuthGate from "@/components/auth/AuthGate"
import { useAuth } from "@/contexts/AuthContext"
import {
  CurrentUserProvider,
  useCurrentUser,
} from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

const testUser: PublicUser = {
  id: "user-1",
  username: "testuser",
  name: "テストユーザー",
  role: "admin",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

function ShowCurrentUserId() {
  const currentUser = useCurrentUser()
  return <span data-testid="current-user-id">{currentUser.id}</span>
}

describe("useCurrentUser", () => {
  it("関門の外で呼ぶと例外を投げる", () => {
    // React が投げた例外をコンソールへ書き出すのを黙らせる（落ちること自体は検証する）
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    try {
      expect(() => render(<ShowCurrentUserId />)).toThrow(
        "useCurrentUser must be used within a CurrentUserProvider"
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("Provider の中では利用者をそのまま返す", () => {
    render(
      <CurrentUserProvider user={testUser}>
        <ShowCurrentUserId />
      </CurrentUserProvider>
    )
    expect(screen.getByTestId("current-user-id")).toHaveTextContent("user-1")
  })
})

describe("AuthGate", () => {
  it("ログイン済みなら子を描き、その子へ利用者を配る", () => {
    mockUseAuth.mockReturnValue({
      user: testUser,
      isLoading: false,
      quickLogin: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGate>
        <ShowCurrentUserId />
      </AuthGate>
    )
    expect(screen.getByTestId("current-user-id")).toHaveTextContent("user-1")
  })

  it("読み込み中は子を描かない", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      quickLogin: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGate>
        <ShowCurrentUserId />
      </AuthGate>
    )
    expect(screen.queryByTestId("current-user-id")).toBeNull()
  })

  it("未ログインなら子を描かない", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      quickLogin: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGate>
        <ShowCurrentUserId />
      </AuthGate>
    )
    expect(screen.queryByTestId("current-user-id")).toBeNull()
  })
})
