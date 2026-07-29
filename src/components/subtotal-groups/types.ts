export interface SubtotalGroup {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  subtotals: Subtotal[]
  examSubtotalGroups?: ExamSubtotalGroup[]
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

export interface ExamSubtotalGroup {
  id: string
  examId: string
  subtotalGroupId: string
  createdAt: Date
  updatedAt: Date
}

interface CropRegionSubtotal {
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
