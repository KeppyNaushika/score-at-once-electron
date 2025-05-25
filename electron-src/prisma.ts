import prisma from "./lib/prisma/client"

export default prisma

// CreateProjectProps は project.ts に移動したため、ここからは削除します。
// 他のモデルの関数もそれぞれのファイルに移動しました。
// exam.ts や examTemplate.ts からのインポートやエクスポートが残っていれば削除します。
