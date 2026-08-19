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

describe("ASB transformer chain", () => {
  test("detectAsbVersion は範囲内バージョンを認識する", () => {
    expect(detectAsbVersion(createManifest("1.1.0"))).toBe("1.1.0")
    expect(detectAsbVersion(createManifest("1.2.0"))).toBe("1.2.0")
    expect(detectAsbVersion(createManifest("9.9.9-broken"))).toBe("unknown")
  })

  test("v1.1.0 → 最新: タグ情報が空配列で補完される（no-op）", () => {
    const result = transformAsbToLatest(createV1_1_0_ArchiveData())

    expect(result.finalVersion).toBe("1.3.0")
    expect(result.data.manifest.version).toBe("1.3.0")
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

  test("v1.2.0: タグ情報がそのまま保持される（往復）", () => {
    const result = transformAsbToLatest(createV1_2_0_ArchiveData())

    expect(result.finalVersion).toBe("1.3.0")
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
})
