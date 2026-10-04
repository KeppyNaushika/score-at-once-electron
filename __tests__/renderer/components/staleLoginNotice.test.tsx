// @vitest-environment jsdom
/**
 * ログイン中の利用者が他のPCで削除されたときの知らせ（#1140）。
 *
 * 利用者一覧を読み直して、トークンが指す利用者が消えていると分かったら、トークンを
 * 捨ててログイン画面へ戻る。黙って戻すと何が起きたか分からないので、閉じるまで残る
 * 知らせを出す。
 *
 * 固定すること:
 * - トークンの利用者が一覧に無ければ、知らせを出してトークンを捨てる
 * - 一覧に居れば出さない。誰もログインしていなければ出さない
 * - 自分でログアウトしたときは出さない
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { createAppQueryClient } from "@/queries/queryClient"
import type { PublicUser } from "@/queries/user"

import {
  cleanupMockElectronAPI,
  createMockElectronAPI,
} from "../helpers/mockElectronAPI"

const loggedInUser: PublicUser = {
  id: "user-1",
  username: "teacher1",
  name: "教員1",
  role: "teacher",
  passcodeType: "none",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const otherUser: PublicUser = {
  ...loggedInUser,
  id: "user-2",
  username: "teacher2",
  name: "教員2",
}

function ShowLogin() {
  const { user, isLoading, logout } = useAuth()
  if (isLoading) return <span>読み込み中</span>
  return (
    <>
      <span data-testid="login-user">{user?.name ?? "未ログイン"}</span>
      <button onClick={logout}>ログアウト</button>
    </>
  )
}

function renderAuth() {
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <AuthProvider>
        <ShowLogin />
      </AuthProvider>
    </QueryClientProvider>
  )
}

/** トークンと利用者一覧を差し込む。トークンを捨てたら null を返すようにする */
function setUpElectronAPI(authUserId: string | null, users: PublicUser[]) {
  const { mockElectronAPI } = createMockElectronAPI()
  let storedToken = authUserId
  mockElectronAPI.getAuthToken.mockImplementation(async () => storedToken)
  mockElectronAPI.fetchUsers.mockResolvedValue(users)
  mockElectronAPI.clearAuthToken.mockImplementation(async () => {
    storedToken = null
  })
  return mockElectronAPI
}

describe("ログイン中の利用者が消えたときの知らせ", () => {
  beforeEach(() => {
    vi.mocked(toast.warning).mockClear()
  })

  afterEach(() => {
    cleanupMockElectronAPI()
  })

  it("トークンの利用者が一覧に無ければ、知らせを出してトークンを捨てる", async () => {
    const electronAPI = setUpElectronAPI(loggedInUser.id, [otherUser])

    renderAuth()

    await waitFor(() => expect(electronAPI.clearAuthToken).toHaveBeenCalled())
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toContain(
      "ログイン中の利用者は、他のPCで削除されたためログアウトしました"
    )
    // 閉じるまで残す
    expect(vi.mocked(toast.warning).mock.calls[0][1]).toMatchObject({
      duration: Infinity,
      closeButton: true,
    })
    expect(await screen.findByText("未ログイン")).toBeInTheDocument()
  })

  it("利用者が一覧に居れば出さない", async () => {
    const electronAPI = setUpElectronAPI(loggedInUser.id, [
      loggedInUser,
      otherUser,
    ])

    renderAuth()

    expect(await screen.findByText("教員1")).toBeInTheDocument()
    expect(electronAPI.clearAuthToken).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("誰もログインしていなければ出さない", async () => {
    const electronAPI = setUpElectronAPI(null, [loggedInUser])

    renderAuth()

    expect(await screen.findByText("未ログイン")).toBeInTheDocument()
    expect(electronAPI.clearAuthToken).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("自分でログアウトしたときは出さない", async () => {
    const electronAPI = setUpElectronAPI(loggedInUser.id, [loggedInUser])

    renderAuth()
    expect(await screen.findByText("教員1")).toBeInTheDocument()

    fireEvent.click(screen.getByText("ログアウト"))

    expect(await screen.findByText("未ログイン")).toBeInTheDocument()
    expect(electronAPI.clearAuthToken).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
  })
})
