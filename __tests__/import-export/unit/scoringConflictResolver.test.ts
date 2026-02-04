/**
 * scoringConflictResolver のユニットテスト
 *
 * テスト対象: electron-src/lib/import/merge/scoringConflictResolver.ts
 * 4つの競合解決戦略（import_wins, existing_wins, newer_wins, manual）をテスト
 */

import { describe, expect, it } from "vitest"

import { resolveScoringConflict } from "../../../electron-src/lib/import/merge/scoringConflictResolver"
import {
  createScoringConflict,
  createScoringConflictConfig,
} from "../../helpers/testDataFactory"

describe("resolveScoringConflict", () => {
  describe("import_wins 戦略", () => {
    it("常にインポートデータを採用する", () => {
      const conflict = createScoringConflict()
      const config = createScoringConflictConfig({ strategy: "import_wins" })

      const result = resolveScoringConflict(conflict, config)

      expect(result).toBe("import")
    })

    it("既存データの方が新しくてもインポートを採用する", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-01-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-12-31").toISOString(),
        },
      })
      const config = createScoringConflictConfig({ strategy: "import_wins" })

      expect(resolveScoringConflict(conflict, config)).toBe("import")
    })
  })

  describe("existing_wins 戦略", () => {
    it("常に既存データを維持する", () => {
      const conflict = createScoringConflict()
      const config = createScoringConflictConfig({ strategy: "existing_wins" })

      const result = resolveScoringConflict(conflict, config)

      expect(result).toBe("existing")
    })

    it("インポートデータの方が新しくても既存を維持する", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-12-31").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-01-01").toISOString(),
        },
      })
      const config = createScoringConflictConfig({ strategy: "existing_wins" })

      expect(resolveScoringConflict(conflict, config)).toBe("existing")
    })
  })

  describe("newer_wins 戦略", () => {
    it("インポートデータの方が新しい場合、インポートを採用する", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-07-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-06-01").toISOString(),
        },
      })
      const config = createScoringConflictConfig({ strategy: "newer_wins" })

      expect(resolveScoringConflict(conflict, config)).toBe("import")
    })

    it("既存データの方が新しい場合、既存を維持する", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-06-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-07-01").toISOString(),
        },
      })
      const config = createScoringConflictConfig({ strategy: "newer_wins" })

      expect(resolveScoringConflict(conflict, config)).toBe("existing")
    })

    it("同じ日時の場合、既存を維持する", () => {
      const sameDate = new Date("2025-07-01").toISOString()
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: sameDate,
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: sameDate,
        },
      })
      const config = createScoringConflictConfig({ strategy: "newer_wins" })

      expect(resolveScoringConflict(conflict, config)).toBe("existing")
    })
  })

  describe("manual 戦略", () => {
    it("手動設定がある場合、その設定に従う（import）", () => {
      const conflict = createScoringConflict()
      const config = createScoringConflictConfig({
        strategy: "manual",
        manualResolutions: {
          [conflict.importScoreId]: "import",
        },
      })

      expect(resolveScoringConflict(conflict, config)).toBe("import")
    })

    it("手動設定がある場合、その設定に従う（existing）", () => {
      const conflict = createScoringConflict()
      const config = createScoringConflictConfig({
        strategy: "manual",
        manualResolutions: {
          [conflict.importScoreId]: "existing",
        },
      })

      expect(resolveScoringConflict(conflict, config)).toBe("existing")
    })

    it("手動設定がない場合、newer_winsと同じ動作をする", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-07-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-06-01").toISOString(),
        },
      })
      const config = createScoringConflictConfig({
        strategy: "manual",
        manualResolutions: {},
      })

      expect(resolveScoringConflict(conflict, config)).toBe("import")
    })
  })

  describe("デフォルト動作", () => {
    it("configが未定義の場合、newer_winsとして動作する", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-07-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-06-01").toISOString(),
        },
      })

      expect(resolveScoringConflict(conflict, undefined)).toBe("import")
    })

    it("configが未定義で既存が新しい場合、existingを返す", () => {
      const conflict = createScoringConflict({
        importScore: {
          status: "correct",
          partialScore: 10,
          updatedAt: new Date("2025-01-01").toISOString(),
        },
        existingScore: {
          status: "incorrect",
          partialScore: 0,
          updatedAt: new Date("2025-12-31").toISOString(),
        },
      })

      expect(resolveScoringConflict(conflict, undefined)).toBe("existing")
    })
  })
})
