"use client"

import { CropRegionAreaType } from "@/types/common.types"
import { CropRegionWithDetails } from "@/types/prismaExtensions"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

export interface CropRegion {
  id?: string
  type: CropRegionAreaType
  x: number
  y: number
  width: number
  height: number
  label: string
  points: string | null
  orderIndex: number | null
  masterImageId: string
}

// 後方互換性のためのエイリアス
export type LayoutRegion = CropRegion

export function useCropRegions(projectId?: string) {
  const [regions, setRegions] = useState<CropRegion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false) // 重複保存防止

  const loadRegions = useCallback(
    async (masterImageId?: string) => {
      if (!projectId) return

      setIsLoading(true)
      try {
        const allRegions =
          await window.electronAPI.getCropRegionsByProjectId(projectId)

        const filteredRegions = masterImageId
          ? allRegions.filter(
              (region) => region.projectPage?.id === masterImageId
            )
          : allRegions

        const formattedRegions: CropRegion[] = filteredRegions.map(
          (region) => ({
            id: region.id,
            type: region.type as CropRegionAreaType,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            label: region.label || "",
            points: region.points ? String(region.points) : null,
            orderIndex: region.orderIndex ?? 1,
            masterImageId: region.projectPage?.id || "",
          })
        )

        setRegions(formattedRegions)
      } catch (error) {
        console.error("Failed to load regions:", error)
        toast.error("領域の読み込みに失敗しました")
        setRegions([])
      } finally {
        setIsLoading(false)
      }
    },
    [projectId]
  )

  const saveRegions = useCallback(
    async (regionsToSave: CropRegion[]) => {
      if (!projectId || isSavingRef.current) return

      isSavingRef.current = true
      setIsSaving(true)
      try {
        const savePromises = regionsToSave.map(async (region) => {
          if (!region.masterImageId) return null

          const regionData = {
            projectPageId: region.masterImageId, // masterImageId is actually projectPageId in the new schema
            type: region.type as CropRegionAreaType,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            label: region.label,
            points: region.points ? parseInt(region.points) : null,
            orderIndex: region.orderIndex,
          }

          if (region.id) {
            return await window.electronAPI.updateCropRegion(
              region.id,
              regionData
            )
          } else {
            const { orderIndex: _ignoredOrderIndex, ...createData } = regionData
            return await window.electronAPI.createCropRegion(createData)
          }
        })

        const savedRegions = (
          await Promise.all(savePromises)
        ).filter((region): region is CropRegionWithDetails => region !== null)

        if (savedRegions.length > 0) {
          const formattedRegions: CropRegion[] = savedRegions
            .filter(
              (
                region: CropRegionWithDetails | null
              ): region is CropRegionWithDetails => region !== null
            )
            .map((region: CropRegionWithDetails) => ({
              id: region.id,
              type: region.type as CropRegionAreaType,
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
              label: region.label || "",
              points: region.points ? String(region.points) : null,
              orderIndex:
                region.orderIndex !== undefined && region.orderIndex !== null
                  ? region.orderIndex
                  : null,
              masterImageId: region.projectPage?.id || "",
            }))

          setRegions(formattedRegions)
          return formattedRegions
        }
      } catch (error) {
        console.error("Failed to save regions:", error)
        toast.error("領域の保存に失敗しました")
        throw error
      } finally {
        setIsSaving(false)
        isSavingRef.current = false
      }
    },
    [projectId]
  )

  const autoSaveRegions = useCallback(
    (regionsToSave: CropRegion[], delay = 1000) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveRegions(regionsToSave)
      }, delay)
    },
    [saveRegions]
  )

  const updateRegions = useCallback(
    (
      newRegions: CropRegion[] | ((prev: CropRegion[]) => CropRegion[]),
      autoSave = true
    ) => {
      const updatedRegions =
        typeof newRegions === "function" ? newRegions(regions) : newRegions

      setRegions(updatedRegions)

      if (autoSave) {
        autoSaveRegions(updatedRegions)
      }
    },
    [regions, autoSaveRegions]
  )

  const addRegion = useCallback(
    (region: Omit<CropRegion, "id">) => {
      const newRegion: CropRegion = {
        ...region,
        id: undefined, // Will be assigned by backend
      }

      updateRegions((prev) => [...prev, newRegion])
    },
    [updateRegions]
  )

  const updateRegion = useCallback(
    (index: number, updates: Partial<CropRegion>) => {
      updateRegions((prev) =>
        prev.map((region, i) =>
          i === index ? { ...region, ...updates } : region
        )
      )
    },
    [updateRegions]
  )

  const deleteRegion = useCallback(
    (index: number) => {
      updateRegions((prev) => prev.filter((_, i) => i !== index))
    },
    [updateRegions]
  )

  const moveRegion = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateRegions((prev) => {
        const newRegions = [...prev]
        const [movedRegion] = newRegions.splice(fromIndex, 1)
        newRegions.splice(toIndex, 0, movedRegion)
        return newRegions
      })
    },
    [updateRegions]
  )

  // Cleanup timeout on unmount
  const cleanup = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return {
    regions,
    isLoading,
    isSaving,
    loadRegions,
    saveRegions,
    updateRegions,
    addRegion,
    updateRegion,
    deleteRegion,
    moveRegion,
    cleanup,
  }
}

// 後方互換性のためのエイリアス
export const useLayoutRegions = useCropRegions
