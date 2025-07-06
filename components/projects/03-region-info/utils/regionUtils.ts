import type { LayoutRegionWithDetails } from "@/types/electron"

export const getGlobalIndex = (
  filteredIndex: number,
  filteredRegions: LayoutRegionWithDetails[],
  allRegions: LayoutRegionWithDetails[],
  selectedMasterImageId?: string,
) => {
  if (!selectedMasterImageId) return filteredIndex
  const filteredRegion = filteredRegions[filteredIndex]
  return allRegions.findIndex(
    (region) =>
      region.id === filteredRegion.id ||
      (region.masterImageId === filteredRegion.masterImageId &&
        region.x === filteredRegion.x &&
        region.y === filteredRegion.y),
  )
}

export const filterRegionsByPage = (
  regions: LayoutRegionWithDetails[],
  selectedMasterImageId?: string,
) => {
  return selectedMasterImageId
    ? regions.filter((region) => region.masterImageId === selectedMasterImageId)
    : regions
}