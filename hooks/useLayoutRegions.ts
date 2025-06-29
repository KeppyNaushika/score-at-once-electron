"use client"

import { useState, useCallback, useRef } from "react"
import { LayoutRegionAreaType } from "@/types/common.types"
import { toast } from "sonner"

export interface LayoutRegion {
  id?: string
  type: LayoutRegionAreaType
  x: number
  y: number
  width: number
  height: number
  label: string
  points: string | null
  questionNumber: string
  masterImageId: string
}

export function useLayoutRegions(projectId?: string) {
  const [regions, setRegions] = useState<LayoutRegion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false) // 重複保存防止

  const loadRegions = useCallback(async (masterImageId?: string) => {
    if (!projectId) return

    setIsLoading(true)
    try {
      const allRegions = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
      
      const filteredRegions = masterImageId 
        ? allRegions.filter(region => region.masterImageId === masterImageId)
        : allRegions

      const formattedRegions: LayoutRegion[] = filteredRegions.map(region => ({
        id: region.id,
        type: region.type as LayoutRegionAreaType,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        label: region.label || "",
        points: region.points ? String(region.points) : null,
        questionNumber: region.questionNumber || "",
        masterImageId: region.masterImageId || ""
      }))

      setRegions(formattedRegions)
    } catch (error) {
      console.error("Failed to load regions:", error)
      toast.error("領域の読み込みに失敗しました")
      setRegions([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const saveRegions = useCallback(async (regionsToSave: LayoutRegion[]) => {
    if (!projectId || isSavingRef.current) return

    isSavingRef.current = true
    setIsSaving(true)
    try {
      const savePromises = regionsToSave.map(async (region) => {
        if (!region.masterImageId) return null

        const regionData = {
          projectId,
          masterImageId: region.masterImageId,
          type: region.type as LayoutRegionAreaType,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          label: region.label,
          points: region.points ? parseInt(region.points) : null,
          questionNumber: region.questionNumber,
        }

        if (region.id) {
          return await window.electronAPI.updateLayoutRegion(region.id, regionData)
        } else {
          return await window.electronAPI.createLayoutRegion(regionData)
        }
      })

      const savedRegions = await Promise.all(savePromises.filter(Boolean))
      
      if (savedRegions.length > 0) {
        const formattedRegions: LayoutRegion[] = savedRegions
          .filter(region => region !== null)
          .map((region) => ({
            id: region!.id,
            type: region!.type as LayoutRegionAreaType,
            x: region!.x,
            y: region!.y,
            width: region!.width,
            height: region!.height,
            label: region!.label || "",
            points: region!.points ? String(region!.points) : null,
            questionNumber: region!.questionNumber || "",
            masterImageId: region!.masterImageId || "",
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
  }, [projectId])

  const autoSaveRegions = useCallback((regionsToSave: LayoutRegion[], delay = 1000) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveRegions(regionsToSave)
    }, delay)
  }, [saveRegions])

  const updateRegions = useCallback((
    newRegions: LayoutRegion[] | ((prev: LayoutRegion[]) => LayoutRegion[]),
    autoSave = true
  ) => {
    const updatedRegions = typeof newRegions === 'function' 
      ? newRegions(regions)
      : newRegions

    setRegions(updatedRegions)

    if (autoSave) {
      autoSaveRegions(updatedRegions)
    }
  }, [regions, autoSaveRegions])

  const addRegion = useCallback((region: Omit<LayoutRegion, 'id'>) => {
    const newRegion: LayoutRegion = {
      ...region,
      id: undefined // Will be assigned by backend
    }
    
    updateRegions(prev => [...prev, newRegion])
  }, [updateRegions])

  const updateRegion = useCallback((index: number, updates: Partial<LayoutRegion>) => {
    updateRegions(prev => prev.map((region, i) => 
      i === index ? { ...region, ...updates } : region
    ))
  }, [updateRegions])

  const deleteRegion = useCallback((index: number) => {
    updateRegions(prev => prev.filter((_, i) => i !== index))
  }, [updateRegions])

  const moveRegion = useCallback((fromIndex: number, toIndex: number) => {
    updateRegions(prev => {
      const newRegions = [...prev]
      const [movedRegion] = newRegions.splice(fromIndex, 1)
      newRegions.splice(toIndex, 0, movedRegion)
      return newRegions
    })
  }, [updateRegions])

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
    cleanup
  }
}