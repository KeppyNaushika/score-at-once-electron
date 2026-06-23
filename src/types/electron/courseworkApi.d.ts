/**
 * Coursework（試験外成績資料）関連 API
 */
export interface CourseworkAPI {
  coursework: {
    // Coursework（トップレベル）
    getAll: () => Promise<{
      success: boolean
      courseworks?: import("../coursework.types").CourseworkSummary[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      coursework?: import("../coursework.types").CourseworkWithDetails
      error?: string
    }>
    create: (data: {
      name: string
      description?: string | null
      date?: string | null
    }) => Promise<{
      success: boolean
      coursework?: import("../coursework.types").CourseworkWithDetails
      error?: string
    }>
    update: (
      id: string,
      data: {
        name?: string
        description?: string | null
        date?: string | null
      }
    ) => Promise<{
      success: boolean
      coursework?: import("../coursework.types").CourseworkWithDetails
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
      usedBy?: string[]
    }>
    getCandidates: () => Promise<{
      success: boolean
      courseworks?: {
        id: string
        name: string
        date: string | null
        items: {
          id: string
          name: string
          maxScore: number
          inputMode: string
          order: number
        }[]
      }[]
      error?: string
    }>

    // 評価項目
    createItem: (data: {
      courseworkId: string
      name: string
      maxScore: number
      inputMode?: string
      letterScales?: { label: string; score: number; order: number }[]
    }) => Promise<{
      success: boolean
      item?: import("../coursework.types").CourseworkItemWithDetails
      error?: string
    }>
    updateItem: (
      id: string,
      data: {
        name?: string
        maxScore?: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }
    ) => Promise<{
      success: boolean
      item?: import("../coursework.types").CourseworkItemWithDetails
      error?: string
    }>
    deleteItem: (id: string) => Promise<{
      success: boolean
      error?: string
      usedBy?: string[]
    }>
    reorderItems: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>

    // 点数
    getScores: (courseworkItemId: string) => Promise<{
      success: boolean
      scores?: import("../coursework.types").CourseworkScoreWithStudent[]
      error?: string
    }>
    batchUpsertScores: (
      scores: {
        courseworkItemId: string
        studentId: string
        score?: number | null
        letterValue?: string | null
        adjustment?: number | null
        adjustmentReason?: string | null
        comment?: string | null
      }[]
    ) => Promise<{ success: boolean; error?: string }>

    // 名簿
    getStudents: (courseworkId: string) => Promise<{
      success: boolean
      students?: import("../coursework.types").CourseworkStudentWithDetails[]
      error?: string
    }>
    getClasses: (courseworkId: string) => Promise<{
      success: boolean
      classes?: {
        id: string
        classId: string
        className: string
        order: number
        studentCount: number
      }[]
      error?: string
    }>
    getAvailableClasses: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      classes?: {
        id: string
        name: string
        studentCount: number
      }[]
      error?: string
    }>
    getAvailableStudents: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      students?: {
        id: string
        studentNumber: string
        lastName: string
        firstName: string
        className: string | null
      }[]
      error?: string
    }>
    addStudentsFromClass: (
      courseworkId: string,
      classId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      added?: number
      skipped?: number
      error?: string
    }>
    addStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{
      success: boolean
      addedCount?: number
      skippedCount?: number
      error?: string
    }>
    updateStudentOrders: (
      courseworkId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    removeStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{ success: boolean; removedCount?: number; error?: string }>
    removeClass: (
      courseworkId: string,
      classId: string
    ) => Promise<{
      success: boolean
      removedStudents?: number
      error?: string
    }>

    // タグ
    setTags: (
      courseworkId: string,
      tagIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
  }
}
