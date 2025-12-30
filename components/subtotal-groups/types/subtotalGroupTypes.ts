export interface SubtotalGroup {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  subtotals: Subtotal[]
  projectSubtotalGroups?: ProjectSubtotalGroup[]
}

export interface Subtotal {
  id: string
  subtotalGroupId: string
  name: string
  order: number
  createdAt: Date
  updatedAt: Date
  cropRegionSubtotals?: CropRegionSubtotal[]
}

export interface ProjectSubtotalGroup {
  id: string
  projectId: string
  subtotalGroupId: string
  createdAt: Date
  updatedAt: Date
}

export interface CropRegionSubtotal {
  id: string
  cropRegionId: string
  subtotalId: string
  assignmentType: string
  weight?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface SubtotalGroupFormData {
  name: string
  subtotals: {
    name: string
    order: number
  }[]
}
