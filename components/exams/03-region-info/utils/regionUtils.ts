import type { CropRegionWithDetails } from "@/types/electron"

export const getGlobalIndex = (
  filteredIndex: number,
  filteredRegions: CropRegionWithDetails[],
  allRegions: CropRegionWithDetails[],
  selectedExamPageId?: string
) => {
  if (!selectedExamPageId) return filteredIndex
  const filteredRegion = filteredRegions[filteredIndex]
  return allRegions.findIndex(
    (region) =>
      region.id === filteredRegion.id ||
      (region.examPageId === filteredRegion.examPageId &&
        region.x === filteredRegion.x &&
        region.y === filteredRegion.y)
  )
}

export const filterRegionsByPage = (
  regions: CropRegionWithDetails[],
  selectedExamPageId?: string
) => {
  return selectedExamPageId
    ? regions.filter((region) => region.examPageId === selectedExamPageId)
    : regions
}
