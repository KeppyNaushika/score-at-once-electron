// @vitest-environment jsdom
/**
 * useImportWizard フックのテスト
 *
 * レンダラ側のインポートウィザード状態管理ロジックを検証する
 */

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { initialState } from "@/hooks/import/constants"
import { useImportWizard } from "@/hooks/import/useImportWizard"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  createMockFileOverviewData,
  createMockScoringConflictData,
} from "../helpers/mockData"
import {
  cleanupMockElectronAPI,
  createMockElectronAPI,
  type MockArchive,
} from "../helpers/mockElectronAPI"

// 関門（AuthGate）の内側なので、利用者は必ず居る
vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(),
}))

const mockUseCurrentUser = vi.mocked(useCurrentUser)

describe("useImportWizard", () => {
  let mockArchive: MockArchive

  beforeEach(() => {
    const mocks = createMockElectronAPI()
    mockArchive = mocks.mockArchive

    mockUseCurrentUser.mockReturnValue({
      id: "test-user-id",
      username: "testuser",
      name: "テストユーザー",
      role: "admin",
      passcodeType: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  })

  afterEach(() => {
    cleanupMockElectronAPI()
    vi.clearAllMocks()
  })

  // =========================================================================
  // 初期状態
  // =========================================================================

  describe("初期状態", () => {
    it("IW-1: 初期状態が正しく設定される", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })
      expect(result.current.state).toEqual(initialState)
    })

    it("IW-2: currentStepがfile_selectで初期化される", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })
      expect(result.current.state.currentStep).toBe("file_select")
    })

    it("IW-3: isProcessingがfalseで初期化される", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })
      expect(result.current.state.isProcessing).toBe(false)
    })

    it("IW-4: idIntegrationConfigがデフォルト値で初期化される", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })
      const config = result.current.state.idIntegrationConfig
      expect(config.student.strategy).toBe("by_student_number")
      expect(config.classroom.strategy).toBe("by_name")
      expect(config.subtotalGroup.strategy).toBe("by_name")
      expect(config.student.decisions).toEqual([])
    })
  })

  // =========================================================================
  // selectFile
  // =========================================================================

  describe("selectFile - ファイル選択", () => {
    it("IW-10: ファイル選択成功時にcurrentStepがfile_overviewに遷移する", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      expect(result.current.state.currentStep).toBe("file_overview")
    })

    it("IW-11: ファイル選択成功時にarchivePathが設定される", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      expect(result.current.state.archivePath).toBe("/path/to/test.score")
    })

    it("IW-12: ファイル選択成功時にmanifestが設定される", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      expect(result.current.state.manifest).not.toBeNull()
      expect(result.current.state.manifest?.examName).toBe("テスト試験")
    })

    it("IW-13: ファイル選択成功時にfileOverviewDataが設定される", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      expect(result.current.state.fileOverviewData).not.toBeNull()
      expect(result.current.state.fileOverviewData?.student).toBeDefined()
    })

    it("IW-14: ファイル選択中にisProcessingがtrueになる", async () => {
      // selectImportFileを遅延させてisProcessingを確認
      let resolveSelect: (value: unknown) => void
      mockArchive.selectImportFile.mockReturnValue(
        new Promise((resolve) => {
          resolveSelect = resolve
        })
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.selectFile()
      })

      // 非同期処理中
      expect(result.current.state.isProcessing).toBe(true)

      // 完了させる
      await act(async () => {
        resolveSelect!({
          canceled: false,
          filePath: "/test.score",
          sourceFormat: "score",
        })
      })
    })

    it("IW-15: selectImportFile失敗時にerrorが設定される", async () => {
      mockArchive.selectImportFile.mockRejectedValue(
        new Error("ファイルが見つかりません")
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        const success = await result.current.selectFile()
        expect(success).toBe(false)
      })

      expect(result.current.state.error).toBe("ファイルが見つかりません")
      expect(result.current.state.currentStep).toBe("file_select")
    })

    it("IW-16: ファイル選択キャンセル時にステップが変わらない", async () => {
      mockArchive.selectImportFile.mockResolvedValue({ canceled: true })

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        const success = await result.current.selectFile()
        expect(success).toBe(false)
      })

      expect(result.current.state.currentStep).toBe("file_select")
      expect(result.current.state.isProcessing).toBe(false)
    })

    it("IW-17: analyzeArchive失敗時にerrorが設定される", async () => {
      mockArchive.analyzeArchive.mockRejectedValue(
        new Error("不正なアーカイブです")
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        const success = await result.current.selectFile()
        expect(success).toBe(false)
      })

      expect(result.current.state.error).toBe("不正なアーカイブです")
    })

    it("IW-18: preMatch が失敗したらエラーになり、遷移しない", async () => {
      mockArchive.preMatch.mockRejectedValue(new Error("照合エラー"))

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        const success = await result.current.selectFile()
        expect(success).toBe(false)
      })

      // 事前照合はファイル概要の中身そのものなので、失敗したまま進ませない
      expect(result.current.state.error).toBe("照合エラー")
      expect(result.current.state.currentStep).toBe("file_select")
    })

    it("IW-19: 例外発生時にerrorが設定される", async () => {
      mockArchive.selectImportFile.mockRejectedValue(
        new Error("ネットワークエラー")
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        const success = await result.current.selectFile()
        expect(success).toBe(false)
      })

      expect(result.current.state.error).toBe("ネットワークエラー")
    })

    it("IW-20: selectFile完了後にisProcessingがfalseに戻る", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      expect(result.current.state.isProcessing).toBe(false)
    })
  })

  // =========================================================================
  // performPreMatching
  // =========================================================================

  describe("performPreMatching - 事前照合", () => {
    it("IW-25: archivePathが未設定の場合にfalseを返す", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      let success: boolean
      await act(async () => {
        success = await result.current.performPreMatching()
      })

      expect(success!).toBe(false)
      expect(mockArchive.preMatch).not.toHaveBeenCalled()
    })

    it("IW-26: 事前照合成功時にfileOverviewDataが更新される", async () => {
      const newData = createMockFileOverviewData({
        student: {
          byId: [],
          noMatch: [],
        },
      })
      mockArchive.preMatch.mockResolvedValue(newData)

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // まずselectFileでarchivePathを設定
      await act(async () => {
        await result.current.selectFile()
      })

      // preMatchの返り値を更新
      mockArchive.preMatch.mockResolvedValue(newData)

      await act(async () => {
        const success = await result.current.performPreMatching()
        expect(success).toBe(true)
      })

      expect(result.current.state.fileOverviewData?.student.byId).toHaveLength(
        0
      )
    })

    it("IW-27: 事前照合失敗時にerrorが設定される", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // archivePathを設定
      await act(async () => {
        await result.current.selectFile()
      })

      mockArchive.preMatch.mockRejectedValue(new Error("照合エラー"))

      await act(async () => {
        const success = await result.current.performPreMatching()
        expect(success).toBe(false)
      })

      expect(result.current.state.error).toBe("照合エラー")
    })

    it("IW-28: 事前照合中にisProcessingがtrueになる", async () => {
      let resolvePreMatch: (value: unknown) => void
      mockArchive.preMatch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePreMatch = resolve
          })
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // archivePathを先に設定（別のpreMatch応答で）
      mockArchive.preMatch.mockResolvedValueOnce({
        success: true,
        data: createMockFileOverviewData(),
      })
      await act(async () => {
        await result.current.selectFile()
      })

      // 遅延するpreMatchをセット
      mockArchive.preMatch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePreMatch = resolve
          })
      )

      act(() => {
        result.current.performPreMatching()
      })

      expect(result.current.state.isProcessing).toBe(true)

      await act(async () => {
        resolvePreMatch!({
          success: true,
          data: createMockFileOverviewData(),
        })
      })

      expect(result.current.state.isProcessing).toBe(false)
    })
  })

  // =========================================================================
  // ID統合設定更新
  // =========================================================================

  describe("updateIdIntegrationConfig - ID統合設定更新", () => {
    it("IW-30: student設定のstrategyを更新できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationConfig("student", {
          strategy: "by_name",
          decisions: [],
        })
      })

      expect(result.current.state.idIntegrationConfig.student.strategy).toBe(
        "by_name"
      )
    })

    it("IW-31: class設定のstrategyを更新できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationConfig("classroom", {
          strategy: "all_new",
          decisions: [],
        })
      })

      expect(result.current.state.idIntegrationConfig.classroom.strategy).toBe(
        "all_new"
      )
    })

    it("IW-32: subtotalGroup設定のstrategyを更新できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationConfig("subtotalGroup", {
          strategy: "individual",
          decisions: [],
        })
      })

      expect(
        result.current.state.idIntegrationConfig.subtotalGroup.strategy
      ).toBe("individual")
    })

    it("IW-33: 他のカテゴリの設定が保持される", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationConfig("student", {
          strategy: "by_name",
          decisions: [],
        })
      })

      expect(result.current.state.idIntegrationConfig.classroom.strategy).toBe(
        "by_name"
      )
      expect(
        result.current.state.idIntegrationConfig.subtotalGroup.strategy
      ).toBe("by_name")
    })
  })

  describe("updateIdIntegrationDecision - 個別決定更新", () => {
    it("IW-35: 新しい個別決定を追加できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationDecision("student", "import-1", {
          importId: "import-1",
          decisionType: "create_new",
        })
      })

      const decisions =
        result.current.state.idIntegrationConfig.student.decisions
      expect(decisions).toHaveLength(1)
      expect(decisions[0].decisionType).toBe("create_new")
    })

    it("IW-36: 既存の個別決定を上書きできる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.updateIdIntegrationDecision("student", "import-1", {
          importId: "import-1",
          decisionType: "create_new",
        })
      })

      act(() => {
        result.current.updateIdIntegrationDecision("student", "import-1", {
          importId: "import-1",
          decisionType: "same_person",
          existingId: "existing-1",
          idChoice: "use_existing_id",
        })
      })

      const decisions =
        result.current.state.idIntegrationConfig.student.decisions
      expect(decisions).toHaveLength(1)
      expect(decisions[0].decisionType).toBe("same_person")
      expect(decisions[0].idChoice).toBe("use_existing_id")
    })
  })

  describe("batchUpdateIdIntegrationDecisions - 一括決定更新", () => {
    it("IW-40: 複数アイテムの決定を一括設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.batchUpdateIdIntegrationDecisions(
          "student",
          [
            { importId: "import-1", existingId: "existing-1" },
            { importId: "import-2", existingId: "existing-2" },
          ],
          "same_person",
          "use_existing_id"
        )
      })

      const decisions =
        result.current.state.idIntegrationConfig.student.decisions
      expect(decisions).toHaveLength(2)
      expect(decisions[0].idChoice).toBe("use_existing_id")
      expect(decisions[1].idChoice).toBe("use_existing_id")
    })
  })

  // =========================================================================
  // ステップ遷移
  // =========================================================================

  describe("goToNextStep / goBack - ステップ遷移", () => {
    it("IW-45: file_overviewからid_integrationに遷移する", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // file_overviewに移動
      await act(async () => {
        await result.current.selectFile()
      })
      expect(result.current.state.currentStep).toBe("file_overview")

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.state.currentStep).toBe("id_integration")
    })

    it("IW-46: id_integrationからdetectScoringConflictsを経由してupdate_confirmに遷移する", async () => {
      const conflictData = createMockScoringConflictData({ conflictCount: 1 })
      mockArchive.detectScoringConflicts.mockResolvedValue({
        success: true,
        data: conflictData,
      })

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // id_integrationまで進める
      await act(async () => {
        await result.current.selectFile()
      })
      act(() => {
        result.current.goToNextStep()
      })
      expect(result.current.state.currentStep).toBe("id_integration")

      // id_integrationからnext → detectScoringConflicts → update_confirm
      await act(async () => {
        result.current.goToNextStep()
      })

      expect(mockArchive.detectScoringConflicts).toHaveBeenCalled()
      expect(result.current.state.currentStep).toBe("update_confirm")
    })

    it("IW-47: update_confirmからfinal_confirmに遷移する", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // update_confirmまで進める
      await act(async () => {
        await result.current.selectFile()
      })
      act(() => {
        result.current.goToNextStep()
      })
      await act(async () => {
        result.current.goToNextStep()
      })
      expect(result.current.state.currentStep).toBe("update_confirm")

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.state.currentStep).toBe("final_confirm")
    })

    it("IW-48: final_confirmからexecuteに遷移する", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // final_confirmまで進める
      await act(async () => {
        await result.current.selectFile()
      })
      act(() => {
        result.current.goToNextStep()
      })
      await act(async () => {
        result.current.goToNextStep()
      })
      act(() => {
        result.current.goToNextStep()
      })
      expect(result.current.state.currentStep).toBe("final_confirm")

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.state.currentStep).toBe("execute")
    })

    it("IW-50: goBackでid_integrationからfile_overviewに戻る", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })
      act(() => {
        result.current.goToNextStep()
      })
      expect(result.current.state.currentStep).toBe("id_integration")

      act(() => {
        result.current.goBack()
      })

      expect(result.current.state.currentStep).toBe("file_overview")
    })

    it("IW-51: goBackでfile_selectからは戻れない", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.goBack()
      })

      expect(result.current.state.currentStep).toBe("file_select")
    })
  })

  // =========================================================================
  // 採点競合設定
  // =========================================================================

  describe("setScoringConflictStrategy - 採点競合方針設定", () => {
    it("IW-60: 採点競合方針をnewer_winsに設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setScoringConflictStrategy("newer_wins")
      })

      expect(result.current.state.scoringConflictConfig.strategy).toBe(
        "newer_wins"
      )
    })

    it("IW-61: 採点競合方針をimport_winsに設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setScoringConflictStrategy("import_wins")
      })

      expect(result.current.state.scoringConflictConfig.strategy).toBe(
        "import_wins"
      )
    })
  })

  describe("setScoringConflictResolution - 個別解決", () => {
    it("IW-65: 個別の採点競合解決を設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setScoringConflictResolution("conflict-1", "import")
      })

      expect(
        result.current.state.scoringConflictConfig.manualResolutions[
          "conflict-1"
        ]
      ).toBe("import")
    })

    it("IW-66: 複数の採点競合解決を一括設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setAllScoringConflictResolutions(
          ["conflict-1", "conflict-2"],
          "existing"
        )
      })

      const resolutions =
        result.current.state.scoringConflictConfig.manualResolutions
      expect(resolutions["conflict-1"]).toBe("existing")
      expect(resolutions["conflict-2"]).toBe("existing")
    })
  })

  // =========================================================================
  // フィールド更新決定
  // =========================================================================

  describe("setFieldUpdateDecision / setBulkUpdateStrategy", () => {
    it("IW-70: フィールド単位の更新決定を設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setFieldUpdateDecision(
          "student:import-1",
          "lastName",
          "use_import"
        )
      })

      expect(
        result.current.state.updateDecisions["student:import-1"]?.lastName
      ).toBe("use_import")
    })

    it("IW-71: 一括更新戦略を設定できる", () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      act(() => {
        result.current.setBulkUpdateStrategy(
          ["student:import-1", "student:import-2"],
          ["lastName", "firstName"],
          "use_newer"
        )
      })

      expect(
        result.current.state.updateDecisions["student:import-1"]?.lastName
      ).toBe("use_newer")
      expect(
        result.current.state.updateDecisions["student:import-2"]?.firstName
      ).toBe("use_newer")
    })
  })

  // =========================================================================
  // executeImport
  // =========================================================================

  describe("executeImport - インポート実行", () => {
    // ヘルパー: selectFileを実行してfileOverviewData等を設定
    async function setupForExecute(hookResult: {
      result: { current: ReturnType<typeof useImportWizard> }
    }) {
      await act(async () => {
        await hookResult.result.current.selectFile()
      })
    }

    it("IW-75: 正常実行時にresultを返す", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })
      await setupForExecute({ result })

      let importResult: unknown
      await act(async () => {
        importResult = await result.current.executeImport()
      })

      expect(importResult).not.toBeNull()
      expect((importResult as { examId: string }).examId).toBe(
        "imported-exam-id"
      )
    })

    it("IW-77: archivePath未設定時にnullが返る", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      let importResult: unknown
      await act(async () => {
        importResult = await result.current.executeImport()
      })

      expect(importResult).toBeNull()
    })

    it("IW-78: fileOverviewData未設定時にerrorが設定される", async () => {
      // selectFileでpreMatchが失敗し、fileOverviewDataがnullになるケース
      mockArchive.preMatch.mockRejectedValue(
        new Error("事前照合に失敗しました")
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })
      expect(result.current.state.fileOverviewData).toBeNull()

      let importResult: unknown
      await act(async () => {
        importResult = await result.current.executeImport()
      })

      expect(importResult).toBeNull()
      // 事前照合が失敗した時点の文言が残る（実行しても上書きしない）
      expect(result.current.state.error).toBe("事前照合に失敗しました")
    })

    it("IW-79: 実行中にisProcessingがtrueになる", async () => {
      let resolveImport: (value: unknown) => void
      mockArchive.idIntegrationImport.mockReturnValue(
        new Promise((resolve) => {
          resolveImport = resolve
        })
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      act(() => {
        result.current.executeImport()
      })

      expect(result.current.state.isProcessing).toBe(true)

      await act(async () => {
        resolveImport!({
          success: true,
          examId: "test",
          summary: {},
        })
      })

      expect(result.current.state.isProcessing).toBe(false)
    })

    it("IW-80: idIntegrationImport失敗時にerrorが設定される", async () => {
      mockArchive.idIntegrationImport.mockRejectedValue(
        new Error("インポート処理に失敗しました")
      )

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      let importResult: unknown
      await act(async () => {
        importResult = await result.current.executeImport()
      })

      expect(importResult).toBeNull()
      expect(result.current.state.error).toBe("インポート処理に失敗しました")
    })

    it("IW-82: idIntegrationImportに全設定が正しく渡される", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })

      // 設定を変更
      act(() => {
        result.current.setScoringConflictStrategy("import_wins")
        result.current.setFieldUpdateDecision(
          "student:1",
          "lastName",
          "use_import"
        )
      })

      await act(async () => {
        await result.current.executeImport()
      })

      expect(mockArchive.idIntegrationImport).toHaveBeenCalledWith(
        expect.objectContaining({
          archivePath: "/path/to/test.score",
          currentUserId: "test-user-id",
          scoringConflictConfig: expect.objectContaining({
            strategy: "import_wins",
          }),
          updateDecisions: expect.objectContaining({
            "student:1": { lastName: "use_import" },
          }),
        })
      )
    })
  })

  // =========================================================================
  // reset / clearError
  // =========================================================================

  describe("reset / clearError", () => {
    it("IW-85: resetで初期状態に戻る", async () => {
      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      // 状態を変更
      await act(async () => {
        await result.current.selectFile()
      })
      expect(result.current.state.currentStep).not.toBe("file_select")

      act(() => {
        result.current.reset()
      })

      expect(result.current.state).toEqual(initialState)
    })

    it("IW-86: clearErrorでerrorのみnullになる", async () => {
      mockArchive.selectImportFile.mockRejectedValue(new Error("テストエラー"))

      const { result } = renderHook(() => useImportWizard(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.selectFile()
      })
      expect(result.current.state.error).toBe("テストエラー")

      act(() => {
        result.current.clearError()
      })

      expect(result.current.state.error).toBeNull()
      expect(result.current.state.currentStep).toBe("file_select")
    })
  })
})
