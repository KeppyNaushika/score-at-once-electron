// @vitest-environment jsdom
/**
 * プロンプトの編集の「問題の画像」の欄（07 の AI 採点。docs/vlm-grading-design.md §3-1）。
 *
 * ここで固定すること:
 * - ファイルを選ぶと切り出しの画面が開き、取り込むと末尾に足される（全体なら元のバイト列を送る）
 * - 外す・前へ・後へのボタンと、サムネイルの上のキー（Alt＋← →・Delete）で並びが変わる
 * - 編集で開くと元の版の画像を並び順のまま引き継ぎ、保存で並べた順のパスを渡す
 *
 * window.electronAPI は偽物で、ファイルにも実データにも触れない。画像は合成したバイト列。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AiPromptEditorDialog } from "@/components/exams/07-score-at-once/AiGrading/AiPromptEditorDialog"
import { AiQuestionImagesField } from "@/components/exams/07-score-at-once/AiGrading/AiQuestionImagesField"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  EXAM_PAGE_ID,
  makePrompt,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const IMAGE_DIRECTORY = "exams/exam-1/ai-question-images"
const FIRST_PATH = `${IMAGE_DIRECTORY}/first.png`
const SECOND_PATH = `${IMAGE_DIRECTORY}/second.png`
const IMPORTED_PATH = `${IMAGE_DIRECTORY}/imported.png`

/** 合成した PNG の先頭（中身は見ない。種類と大きさだけで受け付ける） */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

function installFakeElectronApi() {
  const aiGrading = {
    importQuestionImage: vi.fn(async () => ({ imagePath: IMPORTED_PATH })),
    createPrompt: vi.fn(async () => makePrompt({ id: "prompt-new" })),
    listPrompts: vi.fn(async () => []),
  }
  Object.defineProperty(window, "electronAPI", {
    value: {
      aiGrading,
      resolveFileProtocolPath: vi.fn(
        async (relativePath: string) => `appimg:///${relativePath}`
      ),
      answerSheetBuilder: { listDefinitions: vi.fn(async () => []) },
    },
    writable: true,
    configurable: true,
  })
  return aiGrading
}

function renderWithProviders(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(<QueryWrapper>{children}</QueryWrapper>)
}

/** 欄の並びを外から見えるように持つ（呼び出し側と同じ持ち方） */
function FieldHarness({ initialPaths }: { initialPaths: string[] }) {
  const [imagePaths, setImagePaths] = useState(initialPaths)
  return (
    <>
      <AiQuestionImagesField
        cropRegionId={CROP_REGION_ID}
        imagePaths={imagePaths}
        onImagePathsChange={setImagePaths}
      />
      <output data-testid="image-paths">{imagePaths.join(",")}</output>
    </>
  )
}

const currentPaths = () =>
  screen.getByTestId("image-paths").textContent?.split(",").filter(Boolean)

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:synthetic")
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("問題の画像の欄", () => {
  it("ファイルを選ぶと切り出しの画面が開き、全体のまま取り込むと元のバイト列を送って末尾に足す", async () => {
    const aiGrading = installFakeElectronApi()
    const user = userEvent.setup()
    renderWithProviders(<FieldHarness initialPaths={[FIRST_PATH]} />)

    await user.upload(
      screen.getByTestId("ai-question-image-file-input"),
      new File([PNG_BYTES], "問題.png", { type: "image/png" })
    )
    const cropDialog = await screen.findByRole("dialog")
    expect(
      within(cropDialog).getByText(/問題の画像を切り出す（問題.png）/)
    ).toBeTruthy()
    await user.click(
      within(cropDialog).getByRole("button", { name: "取り込む" })
    )

    await waitFor(() =>
      expect(currentPaths()).toEqual([FIRST_PATH, IMPORTED_PATH])
    )
    expect(aiGrading.importQuestionImage).toHaveBeenCalledWith({
      cropRegionId: CROP_REGION_ID,
      imageBytes: PNG_BYTES,
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("受け付けない種類のファイルは取り込まない", async () => {
    const aiGrading = installFakeElectronApi()
    const user = userEvent.setup({ applyAccept: false })
    renderWithProviders(<FieldHarness initialPaths={[]} />)

    await user.upload(
      screen.getByTestId("ai-question-image-file-input"),
      new File(["text"], "メモ.txt", { type: "text/plain" })
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(aiGrading.importQuestionImage).not.toHaveBeenCalled()
  })

  it("外す・前へ・後へのボタンで並びが変わる", async () => {
    installFakeElectronApi()
    const user = userEvent.setup()
    renderWithProviders(
      <FieldHarness initialPaths={[FIRST_PATH, SECOND_PATH, IMPORTED_PATH]} />
    )

    await user.click(screen.getByRole("button", { name: "2枚目を後へ" }))
    expect(currentPaths()).toEqual([FIRST_PATH, IMPORTED_PATH, SECOND_PATH])

    await user.click(screen.getByRole("button", { name: "2枚目を前へ" }))
    expect(currentPaths()).toEqual([IMPORTED_PATH, FIRST_PATH, SECOND_PATH])

    await user.click(screen.getByRole("button", { name: "1枚目を外す" }))
    expect(currentPaths()).toEqual([FIRST_PATH, SECOND_PATH])
    expect(screen.getByRole("button", { name: "1枚目を前へ" })).toHaveProperty(
      "disabled",
      true
    )
  })

  it("サムネイルの上で Alt＋← → で並べ替え、Delete で外す", async () => {
    installFakeElectronApi()
    const user = userEvent.setup()
    renderWithProviders(
      <FieldHarness initialPaths={[FIRST_PATH, SECOND_PATH]} />
    )

    screen.getByRole("button", { name: /^問題の画像 1枚目/ }).focus()
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}")
    expect(currentPaths()).toEqual([SECOND_PATH, FIRST_PATH])

    screen.getByRole("button", { name: /^問題の画像 2枚目/ }).focus()
    await user.keyboard("{Delete}")
    expect(currentPaths()).toEqual([SECOND_PATH])
  })
})

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  scoringMethod: "points",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  cropSubtotals: [],
}

const questionImageRow = (imagePath: string, sortOrder: number) => ({
  id: `question-image-${sortOrder}`,
  promptId: "prompt-1",
  imagePath,
  sortOrder,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})

describe("プロンプトの編集", () => {
  it("元の版の画像を並び順のまま引き継ぎ、並べ替えて保存すると、その順のパスを渡す", async () => {
    const aiGrading = installFakeElectronApi()
    const user = userEvent.setup()
    renderWithProviders(
      <AiPromptEditorDialog
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        basePrompt={makePrompt({
          questionImages: [
            questionImageRow(FIRST_PATH, 0),
            questionImageRow(SECOND_PATH, 1),
          ],
        })}
        defaultAnnotationInstruction=""
        onCreated={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "2枚目を前へ" }))
    await user.click(screen.getByRole("button", { name: "新しい版として保存" }))

    await waitFor(() => expect(aiGrading.createPrompt).toHaveBeenCalled())
    expect(aiGrading.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        parentPromptId: "prompt-1",
        questionImagePaths: [SECOND_PATH, FIRST_PATH],
      })
    )
  })
})
