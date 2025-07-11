// Score at Once - Electron Backend Library Index
// 新しい階層構造による統合エクスポート

// === 共通機能 ===
export * from "./shared/types/export-types"
export * from "./shared/calculations/subtotal-calculator"
export * from "./shared/utilities/excel-utilities"

// === 出力機能 ===
export * from "./export/excel/excel-export-main"
// PDF出力は今後移行予定
export * from "./prisma/pdfExport"

// === Prisma関連（既存の構造を維持） ===
export * from "./prisma/client"
export * from "./prisma/auth"
export * from "./prisma/user"
export * from "./prisma/class"
export * from "./prisma/student"
export * from "./prisma/studentClassMembership"
export * from "./prisma/project"
export * from "./prisma/projectStudent"
export * from "./prisma/masterImage"
export * from "./prisma/layoutRegion"
export * from "./prisma/answerSheet"
export * from "./prisma/questionScore"
export * from "./prisma/questionGroup"
export * from "./prisma/subtotalDefinition"
export * from "./prisma/questionSubtotalAssignment"
export * from "./prisma/question"
export * from "./prisma/questionPart"
export * from "./prisma/questionPartScore"

// === データ管理 ===
export * from "./dataManager"

// 互換性のためのエイリアス
export { exportGradingDataExcel } from "./export/excel/excel-export-main"