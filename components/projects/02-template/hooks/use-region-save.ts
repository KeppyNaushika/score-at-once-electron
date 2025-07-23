import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { User } from "@prisma/client"
import { AreaType, DatabaseOperation, RegionCoordinates } from "../types"
import { LayoutRegionArea } from "@/types/common.types"

/**
 * 領域保存処理を担当するカスタムフック
 * 個別保存とバッチ保存の両方をサポート
 * 
 * @param projectId - プロジェクトID
 * @param currentUser - 現在のユーザー
 * @returns 領域保存に関する関数群
 */
export function useRegionSave(
  projectId: string | undefined,
  currentUser: User | null
) {
  const isSavingRef = useRef(false)

  /**
   * 個別領域の保存処理
   * 新規作成または更新を効率的に実行する
   * 
   * @param region - 保存する領域データ
   * @param operation - 実行する操作（'create' | 'update'）
   * @returns Promise<any | null> 保存結果
   */
  const saveRegion = useCallback(
    async (region: LayoutRegionArea, operation: DatabaseOperation): Promise<any | null> => {
      if (!projectId || !currentUser) {
        console.warn("Missing projectId or currentUser for saveRegion")
        return null
      }

      try {
        if (!region.masterImageId) {
          throw new Error(
            `Layout region ${region.label || "Unnamed"} is missing masterImageId.`
          )
        }

        const regionData = {
          projectId,
          masterImageId: region.masterImageId,
          type: region.type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          label: region.label,
          points: typeof region.points === 'string' ? parseInt(region.points) : region.points,
          orderIndex: region.orderIndex,
        }

        if (operation === 'update' && region.id) {
          // 既存領域の更新
          return await window.electronAPI.updateLayoutRegion(region.id, regionData)
        } else if (operation === 'create') {
          // 新規領域の作成
          return await window.electronAPI.createLayoutRegion(regionData)
        } else {
          throw new Error(`Invalid operation: ${operation} for region with ID: ${region.id}`)
        }
      } catch (error) {
        console.error(`Error during ${operation} operation:`, error)
        throw error
      }
    },
    [projectId, currentUser]
  )

  /**
   * 複数領域の一括保存処理（互換性のため維持）
   * 効率性を向上させるため、個別保存への移行を推奨
   * 
   * @param regions - 保存する領域データの配列
   * @returns Promise<void>
   */
  const autoSaveRegions = useCallback(
    async (regions: LayoutRegionArea[]): Promise<void> => {
      if (!projectId || !currentUser || isSavingRef.current) return

      isSavingRef.current = true
      try {
        const saveResults: Array<{
          originalIndex: number
          result: any
          wasUpdate: boolean
        }> = []
        
        // 順次処理で確実にID管理
        for (let i = 0; i < regions.length; i++) {
          const area = regions[i]
          if (!area.masterImageId) {
            saveResults.push({ originalIndex: i, result: null, wasUpdate: false })
            continue
          }

          const regionData = {
            projectId,
            masterImageId: area.masterImageId,
            type: area.type,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            label: area.label,
            points: typeof area.points === 'string' ? parseInt(area.points) : area.points,
            orderIndex: area.orderIndex,
          }

          if (area.id) {
            // 既存領域の更新
            const result = await window.electronAPI.updateLayoutRegion(area.id, regionData)
            saveResults.push({ originalIndex: i, result, wasUpdate: true })
          } else {
            // 新規領域の作成
            const result = await window.electronAPI.createLayoutRegion(regionData)
            saveResults.push({ originalIndex: i, result, wasUpdate: false })
          }
        }

        // 結果は呼び出し側で処理される
      } catch (error) {
        console.error("Auto-save failed:", error)
        throw error
      } finally {
        isSavingRef.current = false
      }
    },
    [projectId, currentUser]
  )

  /**
   * 新規領域作成のハンドラー
   * タイプに応じて適切なラベルと配点を自動設定
   * 
   * @param type - 作成する領域のタイプ
   * @param coords - 領域の座標
   * @param masterImageId - 関連するマスター画像のID
   * @param existingRegions - 既存の領域データ（ラベル番号計算用）
   * @returns Promise<LayoutRegionData | null> 作成された領域データ
   */
  const createRegion = useCallback(
    async (
      type: AreaType, 
      coords: RegionCoordinates,
      masterImageId: string,
      existingRegions: LayoutRegionArea[]
    ): Promise<LayoutRegionArea | null> => {
      // タイプに応じたラベルと配点を設定
      let label = ""
      let points = null
      
      switch (type) {
        case "STUDENT_NAME":
          label = "氏名"
          break
        case "STUDENT_ID":
          label = "生徒番号"
          break
        case "QUESTION_ANSWER":
          label = `設問 ${
            existingRegions.filter((a) => a.type === "QUESTION_ANSWER").length + 1
          }`
          points = "10" // デフォルトポイント
          break
        case "TOTAL_SCORE":
          label = "合計点"
          break
        case "SUBTOTAL_SCORE":
          label = "小計"
          break
        default:
          label = "新規エリア"
      }

      // 新規領域オブジェクトを作成（orderIndexを設定）
      const nextOrderIndex = existingRegions.length
      const newRegion: LayoutRegionArea = {
        type,
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
        label,
        points,
        masterImageId,
        orderIndex: nextOrderIndex,
      }

      try {
        // データベースに保存
        const savedRegion = await saveRegion(newRegion, 'create')
        
        if (savedRegion) {
          // IDを付与して返す
          return {
            ...newRegion,
            id: savedRegion.id,
          }
        }
        return null
      } catch (error) {
        console.error("Failed to create region:", error)
        toast.error("採点領域の作成に失敗しました")
        return null
      }
    },
    [saveRegion]
  )

  /**
   * 領域更新のハンドラー
   * 座標情報を更新し、データベースに反映
   * 
   * @param region - 更新する領域データ
   * @param coords - 新しい座標情報
   * @returns Promise<LayoutRegionData | null> 更新された領域データ
   */
  const updateRegion = useCallback(
    async (
      region: LayoutRegionArea, 
      coords: RegionCoordinates
    ): Promise<LayoutRegionArea | null> => {
      if (!region.id) {
        console.warn("Cannot update region without ID")
        return null
      }

      try {
        const updatedRegion = { ...region, ...coords }
        await saveRegion(updatedRegion, 'update')
        return updatedRegion
      } catch (error) {
        console.error("Failed to update region:", error)
        toast.error("採点領域の更新に失敗しました")
        return null
      }
    },
    [saveRegion]
  )

  return {
    saveRegion,
    autoSaveRegions,
    createRegion,
    updateRegion,
    isSaving: isSavingRef.current,
  }
}