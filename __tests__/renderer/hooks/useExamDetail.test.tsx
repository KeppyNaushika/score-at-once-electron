// @vitest-environment jsdom
/**
 * 試験概要の書き込み（`useExamDetail.updateExam`）の作法。
 *
 * 固定するのは2つ。
 *
 * 1. **成功を知らせない。** 概要ページは1打鍵ごとに書く（`EntityOverviewPage`）ので、
 *    成功トーストを出すと 12 文字打てば 12 枚重なる。成績・資料・解答用紙の同じ操作は
 *    どれも出しておらず、試験だけが例外になっていた
 * 2. **失敗は握り潰さない。** 知らせるのは1箇所（`queryClient.ts` の `MutationCache`）
 *    なので、フックが catch して黙ると誰も知らせないまま保存されなかったことになる
 */

import type { Exam } from "@prisma/client"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// sonner は `vi.mock` の工場から触るので、変数ごと巻き上げる
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: "user-1", name: "採点 太郎" }),
}))

import { useExamDetail } from "@/hooks/useExamDetail"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const EXAM_ID = "exam-1"

/** `update-exam` の呼ばれ方。触った列だけが載る */
type UpdateExamCall = (
  examId: string,
  data: Partial<Pick<Exam, "examName" | "description" | "referenceDate">>
) => Promise<{ id: string }>

const updateExam = vi.fn<UpdateExamCall>()

function mockExamApi() {
  updateExam.mockResolvedValue({ id: EXAM_ID })

  Object.defineProperty(window, "electronAPI", {
    value: {
      fetchExamById: vi.fn().mockResolvedValue({
        id: EXAM_ID,
        examName: "期末考査",
        description: null,
        referenceDate: null,
        examPages: [],
        examTags: [],
      }),
      getStudentsForExam: vi.fn().mockResolvedValue([]),
      getCropRegionsByExamId: vi.fn().mockResolvedValue([]),
      updateExam,
    },
    writable: true,
    configurable: true,
  })
}

function renderExamDetail() {
  return renderHook(() => useExamDetail(EXAM_ID), {
    wrapper: createQueryWrapper(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExamApi()
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
})

describe("試験概要の書き込み", () => {
  it("書けても成功トーストを出さない（1打鍵ごとに書くので積み上がる）", async () => {
    const { result } = renderExamDetail()

    await act(async () => {
      await result.current.updateExam({ examName: "期末考査（数学）" })
    })

    expect(updateExam).toHaveBeenCalledWith(EXAM_ID, {
      examName: "期末考査（数学）",
    })
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("触っていない列は運ばない（説明だけを書き換える）", async () => {
    const { result } = renderExamDetail()

    await act(async () => {
      await result.current.updateExam({ description: "数学I" })
    })

    const [, data] = updateExam.mock.calls[0]
    expect(data).toEqual({ description: "数学I" })
    expect(Object.keys(data)).not.toContain("examName")
  })

  it("書けなかったら握り潰さず、中央のトーストが知らせる", async () => {
    updateExam.mockRejectedValue(new Error("書き込みに失敗"))
    const { result } = renderExamDetail()

    await act(async () => {
      await expect(
        result.current.updateExam({ examName: "期末考査（数学）" })
      ).rejects.toThrow("書き込みに失敗")
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "試験を保存できませんでした",
        expect.objectContaining({ description: "書き込みに失敗" })
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
