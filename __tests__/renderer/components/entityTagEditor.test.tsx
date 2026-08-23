// @vitest-environment jsdom
/**
 * 概要ページのタグ欄（`EntityTagEditor`）の検査。
 *
 * 見るのは**取り直しが遅れている間の振る舞い**の2つ。
 *
 * 1. **続けて2つ付けても、先に付けた方が消えないこと。** 付け替えは置き換え
 *    （`setTags(entityId, tagIds)`）なので、いま付いているタグを読んで組み立てる。
 *    `mutateAsync` は取り直しを待たずに解決する（`queryClient.ts` の
 *    `void client.invalidateQueries(…)`）ので、そこで押せるようにすると
 *    2つ目が `[…1往復前のタグ, 2つ目]` になり1つ目が消える
 * 2. **塞がっている間に打った文字が、付かないまま消えないこと**
 *
 * **本物の取得・書き込みを通す。** 見たいのが「取り直しが着地する前の隙間」なので、
 * `onReplace` を差し替えた作り物では隙間そのものが再現できない。解答用紙のタグ
 * （`answerSheetDefinitionTagsQuery` / `setAnswerSheetDefinitionTagsMutation`）を
 * 実際に通し、`window.electronAPI` の側で取り直しを止めて隙間を作る。
 */

import "../setup"

import { useMutation, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EntityTagEditor } from "@/components/common/EntityTagEditor"
import {
  answerSheetDefinitionTagsQuery,
  setAnswerSheetDefinitionTagsMutation,
} from "@/queries/tag"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const DEFINITION_ID = "definition-1"

const TAGS = [
  { id: "tag-english", name: "英語" },
  { id: "tag-japanese", name: "国語" },
  { id: "tag-math", name: "数学" },
] as const

function tagRow(tagId: string) {
  const tag = TAGS.find((candidate) => candidate.id === tagId)
  if (!tag) throw new Error(`知らないタグ: ${tagId}`)
  return {
    ...tag,
    order: 0,
    color: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  }
}

/** DB の側。付け替えの書き込みがここを書き、取り直しがここを読む */
let attachedTagIds: string[] = []
/** 取り直しを止めておくか（着地前の隙間を作る） */
let holdsReload = false
/** 止めてある取り直しを進めるための取っ手 */
let releaseReload: (() => void) | null = null

const setDefinitionTags = vi.fn()
const getDefinitionTags = vi.fn()

function mockTagApi() {
  attachedTagIds = ["tag-english"]
  holdsReload = false
  releaseReload = null

  getDefinitionTags.mockImplementation(async () => {
    if (holdsReload) {
      await new Promise<void>((resolve) => {
        releaseReload = resolve
      })
    }
    return attachedTagIds.map((tagId) => ({
      id: `link-${tagId}`,
      asbDefinitionId: DEFINITION_ID,
      tagId,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      tag: tagRow(tagId),
    }))
  })
  setDefinitionTags.mockImplementation(
    async (_definitionId: string, tagIds: string[]) => {
      attachedTagIds = [...tagIds]
    }
  )

  Object.defineProperty(window, "electronAPI", {
    value: {
      tagGetAll: vi
        .fn()
        .mockImplementation(async () => TAGS.map((tag) => tagRow(tag.id))),
      tagFindOrCreate: vi.fn().mockImplementation(async (name: string) => {
        const found = TAGS.find((tag) => tag.name === name)
        if (!found) throw new Error(`知らないタグ名: ${name}`)
        return tagRow(found.id)
      }),
      asbDefinitionTagGetByDefinitionId: getDefinitionTags,
      asbDefinitionTagSetDefinitionTags: setDefinitionTags,
      asbListDefinitions: vi.fn().mockResolvedValue([]),
    },
    writable: true,
    configurable: true,
  })
}

/** 概要ページと同じ配線（取得の `isFetching` をそのままタグ欄へ渡す） */
function TagEditorHarness() {
  const { data: definitionTags = [], isFetching } = useQuery(
    answerSheetDefinitionTagsQuery(DEFINITION_ID)
  )
  const replaceTags = useMutation(
    setAnswerSheetDefinitionTagsMutation(DEFINITION_ID)
  )
  return (
    <EntityTagEditor
      tags={definitionTags.map((definitionTag) => definitionTag.tag)}
      isReloading={isFetching}
      onReplace={async (tagIds) => {
        await replaceTags.mutateAsync(tagIds)
      }}
    />
  )
}

/** タグ欄を載せ、最初のタグが出て編集の口が開くまで待つ */
async function renderTagEditor() {
  const user = userEvent.setup()
  render(<TagEditorHarness />, { wrapper: createQueryWrapper() })
  await screen.findByText("英語")
  await user.click(screen.getByLabelText("タグを編集"))
  await screen.findByPlaceholderText("タグを追加...")
  return user
}

/**
 * 候補一覧（付いていないタグが並ぶ）の中の1件。付いているタグの側は「〈名前〉を
 * 外す」なので、名前そのものを持つボタンは候補だけである。
 */
function suggestion(name: string) {
  return screen.getByRole("button", { name })
}

/** 外す口が出た＝そのタグが付いた姿で取り直しが着地した */
async function waitForAttached(name: string) {
  await screen.findByLabelText(`${name} を外す`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTagApi()
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
})

describe("タグ欄: 取り直しが着地する前の隙間", () => {
  it("続けて2つ付けても、先に付けたタグが消えない", async () => {
    const user = await renderTagEditor()

    // 1つ目。これで取り直しが走るが、着地させずに止めておく
    holdsReload = true
    await user.click(suggestion("国語"))
    await waitFor(() => {
      expect(setDefinitionTags).toHaveBeenCalledWith(DEFINITION_ID, [
        "tag-english",
        "tag-japanese",
      ])
    })

    // 着地前に2つ目を押しても受け取らない（ここで受けると、読んでいる
    // `tags` が1往復ぶん古いので国語が落ちた組が送られる）
    await user.click(suggestion("数学"))
    expect(setDefinitionTags).toHaveBeenCalledTimes(1)

    // 着地したら、いま付いている2つの上に足せる
    holdsReload = false
    releaseReload?.()
    await waitForAttached("国語")
    await user.click(suggestion("数学"))
    await waitFor(() => {
      expect(setDefinitionTags).toHaveBeenLastCalledWith(DEFINITION_ID, [
        "tag-english",
        "tag-japanese",
        "tag-math",
      ])
    })
    expect(attachedTagIds).toEqual(["tag-english", "tag-japanese", "tag-math"])
  })

  it("塞がっている間に打った文字は、付かないまま消えたりしない", async () => {
    const user = await renderTagEditor()

    holdsReload = true
    await user.click(suggestion("国語"))
    await waitFor(() => expect(setDefinitionTags).toHaveBeenCalledTimes(1))

    // 取り直しの着地を待っている間に打って Enter（入力欄そのものは塞がない）
    const tagInput = screen.getByPlaceholderText("タグを追加...")
    await user.type(tagInput, "数学{Enter}")

    expect(setDefinitionTags).toHaveBeenCalledTimes(1)
    // 打った文字は残る。消すと「付いたのか消えたのか」が分からなくなる
    expect(tagInput).toHaveValue("数学")

    // 着地したら、そのまま Enter で付けられる
    holdsReload = false
    releaseReload?.()
    await waitForAttached("国語")
    await user.type(tagInput, "{Enter}")
    await waitFor(() => {
      expect(setDefinitionTags).toHaveBeenLastCalledWith(DEFINITION_ID, [
        "tag-english",
        "tag-japanese",
        "tag-math",
      ])
    })
    expect(tagInput).toHaveValue("")
  })
})
