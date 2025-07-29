/**
 * Canvas interaction related type definitions
 */

/**
 * State for tracking drag operations
 */
export interface DragState {
  x: number
  y: number
}

/**
 * State for tracking resize operations
 */
export interface ResizeState {
  areaIndex: number
  handle: "nw" | "ne" | "sw" | "se"
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
}

/**
 * State for tracking move operations
 */
export interface MoveState {
  areaIndex: number
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
}

/**
 * Props for the image canvas interaction hook
 */
export interface UseImageCanvasInteractionProps {
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  projectPageId: string | null
  areas: any[]
  onAddAreaByDrag: (
    type: import("@/types/common.types").CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  zoom: number
}