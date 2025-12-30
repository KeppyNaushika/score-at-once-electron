import type { CropRegionWithDetails } from "@/types/electron"

export const getGlobalIndex = (
  filteredIndex: number,
  filteredRegions: CropRegionWithDetails[],
  allRegions: CropRegionWithDetails[],
  selectedProjectPageId?: string
) => {
  if (!selectedProjectPageId) return filteredIndex
  const filteredRegion = filteredRegions[filteredIndex]
  return allRegions.findIndex(
    (region) =>
      region.id === filteredRegion.id ||
      (region.projectPageId === filteredRegion.projectPageId &&
        region.x === filteredRegion.x &&
        region.y === filteredRegion.y)
  )
}

export const filterRegionsByPage = (
  regions: CropRegionWithDetails[],
  selectedProjectPageId?: string
) => {
  return selectedProjectPageId
    ? regions.filter((region) => region.projectPageId === selectedProjectPageId)
    : regions
}
