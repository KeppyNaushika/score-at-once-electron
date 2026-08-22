/**
 * ASB（解答用紙定義）アーカイブ バージョン変換チェーンのユニットテスト
 *
 * 旧バージョン形状をチェーンに通し、最新形式へ正しく変換されることを検証する。
 */

import { describe, expect, test } from "vitest"

import {
  detectAsbVersion,
  transformAsbToLatest,
} from "../../../electron-src/lib/import/asb-transformers"
import type {
  AsbArchiveData,
  AsbArchiveManifest,
} from "../../../src/types/asbArchive.types"

const TIMESTAMP = "2026-01-01T00:00:00.000Z"

function createCounts(overrides: Record<string, number> = {}) {
  return {
    headerFields: 0,
    majorQuestions: 0,
    subQuestions: 0,
    branchQuestions: 0,
    textElements: 0,
    imageElements: 0,
    charGuides: 0,
    omrConfigs: 0,
    images: 0,
    tags: 0,
    ...overrides,
  }
}

function createManifest(version: string): AsbArchiveManifest {
  return {
    version,
    appVersion: "test",
    exportedAt: TIMESTAMP,
    definitionName: "テスト解答用紙",
    paperSize: "A4",
    orientation: "portrait",
    counts: createCounts(),
  }
}

function createDefinition() {
  return {
    id: "def-1",
    name: "テスト解答用紙",
    renderMode: "print",
    settings: {
      paperSize: "A4",
      orientation: "portrait",
      headerFields: [],
    },
    majorQuestions: [],
  }
}

/** v1.1.0（タグ非対応）形状: manifest に tags カウント無し、tagsData 無し */
function createV1_1_0_ArchiveData(): AsbArchiveData {
  const raw = {
    manifest: {
      version: "1.1.0",
      appVersion: "test",
      exportedAt: TIMESTAMP,
      definitionName: "テスト解答用紙",
      paperSize: "A4",
      orientation: "portrait",
      counts: createCounts(),
    },
    definition: createDefinition(),
  }
  return raw as unknown as AsbArchiveData
}

/**
 * v1.3.0 形状: 原稿用紙は小問の入れ子で、id を持たない。
 *
 * 「有効なときだけ入れ子が在る」形なので `enabled` すら書かれていないことがあり、
 * 未指定の項目はキーごと欠けている。枝問には原稿用紙が付かない。
 */
function createV1_3_0_ArchiveData(): AsbArchiveData {
  const raw = {
    manifest: {
      version: "1.3.0",
      appVersion: "test",
      exportedAt: TIMESTAMP,
      definitionName: "テスト解答用紙",
      paperSize: "A4",
      orientation: "portrait",
      counts: createCounts({
        majorQuestions: 1,
        subQuestions: 2,
        charGuides: 1,
      }),
    },
    definition: {
      ...createDefinition(),
      majorQuestions: [
        {
          id: "major-1",
          label: "1",
          subQuestions: [
            {
              id: "sub-1",
              label: "(1)",
              branchQuestions: [],
              heightMultiplier: 1,
              points: 10,
              textElements: [],
              imageElements: [],
              manuscriptPaper: {
                enabled: true,
                columns: 25,
                rows: 15,
                guidePosition: "top-right",
                charGuides: [{ id: "cg-1", atChar: 80, label: "80" }],
              },
            },
            {
              id: "sub-2",
              label: "(2)",
              branchQuestions: [],
              heightMultiplier: 1,
              points: 5,
              textElements: [],
              imageElements: [],
            },
          ],
        },
      ],
    },
    tagsData: [],
    asbDefinitionTags: [],
  }
  return raw as unknown as AsbArchiveData
}

/** v1.2.0（タグ対応）形状: tagsData と asbDefinitionTags を同梱 */
function createV1_2_0_ArchiveData(): AsbArchiveData {
  const raw = {
    manifest: {
      version: "1.2.0",
      appVersion: "test",
      exportedAt: TIMESTAMP,
      definitionName: "テスト解答用紙",
      paperSize: "A4",
      orientation: "portrait",
      counts: createCounts({ tags: 2 }),
    },
    definition: createDefinition(),
    tagsData: [
      { id: "tag-1", name: "数学", order: 0, color: "#ff0000" },
      { id: "tag-2", name: "中間試験", order: 1, color: null },
    ],
    asbDefinitionTags: [{ tagId: "tag-1" }, { tagId: "tag-2" }],
  }
  return raw as unknown as AsbArchiveData
}

/** v1.4.0 形状: 解答用紙に使用日も説明も無い */
function createV1_4_0_ArchiveData(): AsbArchiveData {
  const raw = {
    manifest: {
      version: "1.4.0",
      appVersion: "test",
      exportedAt: TIMESTAMP,
      definitionName: "テスト解答用紙",
      paperSize: "A4",
      orientation: "portrait",
      counts: createCounts(),
    },
    definition: createDefinition(),
    tagsData: [],
    asbDefinitionTags: [],
  }
  return raw as unknown as AsbArchiveData
}

describe("ASB transformer chain", () => {
  test("detectAsbVersion は範囲内バージョンを認識する", () => {
    expect(detectAsbVersion(createManifest("1.1.0"))).toBe("1.1.0")
    expect(detectAsbVersion(createManifest("1.2.0"))).toBe("1.2.0")
    expect(detectAsbVersion(createManifest("9.9.9-broken"))).toBe("unknown")
  })

  test("v1.1.0 → 最新: タグ情報が空配列で補完される（no-op）", () => {
    const result = transformAsbToLatest(createV1_1_0_ArchiveData())

    expect(result.finalVersion).toBe("1.5.0")
    expect(result.data.manifest.version).toBe("1.5.0")
    expect(result.data.manifest.counts.tags).toBe(0)
    expect(result.data.tagsData).toEqual([])
    expect(result.data.asbDefinitionTags).toEqual([])
  })

  test("v1.2.0 → 最新: 解答用紙が持っていた描き分けは落ちる", () => {
    const result = transformAsbToLatest(createV1_2_0_ArchiveData())

    // renderMode は利用者の設定（asbRenderMode）へ移した。書き込み先の列がもう無い
    expect(result.data.definition).not.toHaveProperty("renderMode")
    // 落とすのはその1つだけで、他はそのまま残る
    expect(result.data.definition.name).toBe("テスト解答用紙")
    expect(result.data.definition.majorQuestions).toEqual([])
  })

  test("v1.3.0 → 最新: 原稿用紙が id と null 揃いの行になる", () => {
    const result = transformAsbToLatest(createV1_3_0_ArchiveData())

    expect(result.finalVersion).toBe("1.5.0")
    const [withPaper, withoutPaper] =
      result.data.definition.majorQuestions[0].subQuestions
    // 旧形式は「有効なときだけ入れ子が在る」形。値はそのまま移り、
    // 未指定だった項目は null（DB の列が持つ姿）になる
    expect(withPaper.manuscriptPaper).toMatchObject({
      enabled: true,
      columns: 25,
      rows: 15,
      guidePosition: "top-right",
      guideFontSize: null,
      guidePadding: null,
    })
    expect(withPaper.manuscriptPaper?.charGuides).toEqual([
      { id: "cg-1", atChar: 80, label: "80" },
    ])
    // id は行の主キーになるので、無かったものには振る
    expect(withPaper.manuscriptPaper?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    // 原稿用紙を使っていない小問には行を作らない
    expect(withoutPaper.manuscriptPaper).toBeUndefined()
  })

  test("v1.2.0: タグ情報がそのまま保持される（往復）", () => {
    const result = transformAsbToLatest(createV1_2_0_ArchiveData())

    expect(result.finalVersion).toBe("1.5.0")
    expect(result.data.tagsData).toEqual([
      { id: "tag-1", name: "数学", order: 0, color: "#ff0000" },
      { id: "tag-2", name: "中間試験", order: 1, color: null },
    ])
    expect(result.data.asbDefinitionTags).toEqual([
      { tagId: "tag-1" },
      { tagId: "tag-2" },
    ])
    expect(result.data.manifest.counts.tags).toBe(2)
  })

  test("v1.4.0 → 1.5.0: 使用日と説明が null で補われる", () => {
    const result = transformAsbToLatest(createV1_4_0_ArchiveData())

    expect(result.originalVersion).toBe("1.4.0")
    expect(result.finalVersion).toBe("1.5.0")
    // 旧版には入力する画面が無かったので、失われた値というものが無い＝警告も出さない
    expect(result.warnings).toEqual([])
    expect(result.data.definition.referenceDate).toBeNull()
    expect(result.data.definition.description).toBeNull()
  })

  test("既に 1.5.0 の値を持つ解答用紙は書き換えられない（冪等）", () => {
    const archive = createV1_4_0_ArchiveData()
    const withValues = {
      ...archive,
      manifest: { ...archive.manifest, version: "1.4.0" },
      definition: {
        ...archive.definition,
        referenceDate: "2026-03-01T00:00:00.000Z",
        description: "1学期期末の用紙",
      },
    }

    const result = transformAsbToLatest(withValues)

    expect(result.data.definition.referenceDate).toBe(
      "2026-03-01T00:00:00.000Z"
    )
    expect(result.data.definition.description).toBe("1学期期末の用紙")
  })
})
