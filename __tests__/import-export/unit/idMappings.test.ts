/**
 * IDマッピング管理のユニットテスト
 *
 * テスト対象: electron-src/lib/import/merge/types.ts
 * IdMappings型とcreateEmptyCounts関数のテスト
 */

import { describe, expect, it } from "vitest"

import { createEmptyCounts } from "../../../electron-src/lib/import/merge/types"
import {
  createEmptyIdMappings,
  createEmptyImportCounts,
  generateId,
} from "../../helpers/testDataFactory"

describe("IdMappings", () => {
  describe("createEmptyIdMappings", () => {
    it("全カテゴリの空マッピングを生成する", () => {
      const mappings = createEmptyIdMappings()

      const expectedCategories = [
        "student",
        "class",
        "subtotalGroup",
        "subtotal",
        "project",
        "projectPage",
        "cropRegion",
        "masterImage",
        "studentAnswerImage",
        "projectStudent",
        "userProject",
        "projectSubtotalGroup",
        "cropSubtotal",
        "questionScore",
        "drawingAnnotation",
        "membership",
      ]

      for (const category of expectedCategories) {
        expect(
          mappings[category as keyof typeof mappings],
          `${category}が空オブジェクトであること`
        ).toEqual({})
      }
    })

    it("マッピングにエントリを追加できる", () => {
      const mappings = createEmptyIdMappings()
      const importId = generateId()
      const existingId = generateId()

      mappings.student[importId] = existingId

      expect(mappings.student[importId]).toBe(existingId)
      expect(Object.keys(mappings.student)).toHaveLength(1)
    })

    it("複数のカテゴリに独立してマッピングを追加できる", () => {
      const mappings = createEmptyIdMappings()
      const studentImportId = generateId()
      const studentExistingId = generateId()
      const classImportId = generateId()
      const classExistingId = generateId()

      mappings.student[studentImportId] = studentExistingId
      mappings.class[classImportId] = classExistingId

      expect(mappings.student[studentImportId]).toBe(studentExistingId)
      expect(mappings.class[classImportId]).toBe(classExistingId)
      expect(Object.keys(mappings.student)).toHaveLength(1)
      expect(Object.keys(mappings.class)).toHaveLength(1)
    })
  })

  describe("IDマッピングの上書き", () => {
    it("同じimportIdに対して上書きできる", () => {
      const mappings = createEmptyIdMappings()
      const importId = generateId()
      const firstExistingId = generateId()
      const secondExistingId = generateId()

      mappings.student[importId] = firstExistingId
      expect(mappings.student[importId]).toBe(firstExistingId)

      mappings.student[importId] = secondExistingId
      expect(mappings.student[importId]).toBe(secondExistingId)
    })
  })

  describe("IDマッピングの逆引き", () => {
    it("既存IDからインポートIDを検索できる", () => {
      const mappings = createEmptyIdMappings()
      const importId = generateId()
      const existingId = generateId()

      mappings.student[importId] = existingId

      // idChangeExecutor.tsで使用されるパターン
      const foundImportId = Object.entries(mappings.student).find(
        ([, mappedId]) => mappedId === existingId
      )?.[0]

      expect(foundImportId).toBe(importId)
    })

    it("複数のマッピングで正しく逆引きできる", () => {
      const mappings = createEmptyIdMappings()
      const entries = Array.from({ length: 5 }, () => ({
        importId: generateId(),
        existingId: generateId(),
      }))

      for (const entry of entries) {
        mappings.student[entry.importId] = entry.existingId
      }

      for (const entry of entries) {
        const found = Object.entries(mappings.student).find(
          ([, mappedId]) => mappedId === entry.existingId
        )?.[0]
        expect(found).toBe(entry.importId)
      }
    })
  })
})

describe("createEmptyCounts", () => {
  it("全カウンタがゼロで初期化される", () => {
    const counts = createEmptyCounts()

    expect(counts.students).toBe(0)
    expect(counts.classes).toBe(0)
    expect(counts.users).toBe(0)
    expect(counts.pages).toBe(0)
    expect(counts.regions).toBe(0)
    expect(counts.scores).toBe(0)
    expect(counts.annotations).toBe(0)
    expect(counts.subtotalGroups).toBe(0)
    expect(counts.masterImages).toBe(0)
    expect(counts.answerSheetImages).toBe(0)
  })
})

describe("ImportCounts", () => {
  it("4つのカテゴリ全てが空カウントで初期化される", () => {
    const importCounts = createEmptyImportCounts()

    expect(importCounts.created.students).toBe(0)
    expect(importCounts.updated.students).toBe(0)
    expect(importCounts.skipped.students).toBe(0)
    expect(importCounts.unchanged.students).toBe(0)
  })

  it("カウントをインクリメントできる", () => {
    const importCounts = createEmptyImportCounts()

    importCounts.created.students++
    importCounts.created.students++
    importCounts.updated.classes++
    importCounts.skipped.scores += 5

    expect(importCounts.created.students).toBe(2)
    expect(importCounts.updated.classes).toBe(1)
    expect(importCounts.skipped.scores).toBe(5)
    expect(importCounts.unchanged.students).toBe(0)
  })
})
