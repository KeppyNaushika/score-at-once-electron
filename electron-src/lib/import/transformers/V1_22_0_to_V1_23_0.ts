/**
 * v1.22.0 → v1.23.0 変換器
 *
 * 模範解答画像（MasterImage）を試験ページ（ExamPage）へ畳んだ。
 * ページ1件に対し画像は必ず1枚で、2枚以上にする経路も複数枚を使う読み取りも
 * 存在しなかったため、examPages が imagePath / pageSize を直接持つ形へ改めた。
 *
 * 旧アーカイブの masterImages を examPageId で突き合わせて畳み、セクションごと落とす。
 * 画像の無いページは空パスで残す — 旧実装では「答案が残っているページの模範解答だけを
 * 削除する」ことができ、その状態のアーカイブが実在しうる。ここでページを捨てると
 * 採点領域も答案画像も道連れになるので、消さずに引き継いで取り込み側に判断を残す。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/** 旧形式の模範解答画像1件（v1.2.0〜v1.22.0） */
interface LegacyMasterImage {
  examPageId: string
  imagePath: string
  pageSize?: string
}

const isLegacyMasterImage = (value: unknown): value is LegacyMasterImage => {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.examPageId === "string" &&
    typeof record.imagePath === "string"
  )
}

export class V1_22_0_to_V1_23_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.22.0"
  readonly toVersion: ExamArchiveVersion = "1.23.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []
    const examData = {
      ...(data.examData as unknown as Record<string, unknown>),
    }

    const rawMasterImages = examData.masterImages
    const masterImages = Array.isArray(rawMasterImages)
      ? rawMasterImages.filter(isLegacyMasterImage)
      : []

    // 1ページに複数枚あった場合は先着（配列の並び）を採る。DB 側の畳み込みが
    // createdAt 昇順で古い方を採るのと同じで、エクスポート順もその並びになっている
    const imageByExamPageId = new Map<string, LegacyMasterImage>()
    for (const masterImage of masterImages) {
      if (!imageByExamPageId.has(masterImage.examPageId)) {
        imageByExamPageId.set(masterImage.examPageId, masterImage)
      }
    }

    const rawExamPages = examData.examPages
    let pagesWithoutImage = 0

    if (Array.isArray(rawExamPages)) {
      examData.examPages = rawExamPages.map((examPage) => {
        const page = { ...(examPage as Record<string, unknown>) }
        const masterImage =
          typeof page.id === "string"
            ? imageByExamPageId.get(page.id)
            : undefined

        // ページが既に持っている値へフォールバックする。形状ベースの版数検出が
        // 版を引き下げてこの変換器を再適用したとき、無条件に上書きすると
        // 畳み終わったアーカイブの模範解答が全部消える（他の変換器が「現行キーが
        // 併存するなら発火しない」ガードを持つのと同じ理由で、非冪等は許されない）
        const imagePath =
          masterImage?.imagePath ??
          (typeof page.imagePath === "string" ? page.imagePath : null)
        const pageSize =
          masterImage?.pageSize ??
          (typeof page.pageSize === "string" ? page.pageSize : "A4")

        if (!imagePath) pagesWithoutImage++

        return { ...page, imagePath, pageSize }
      })
    }

    delete examData.masterImages

    if (pagesWithoutImage > 0) {
      warnings.push(
        `1.22.0→1.23.0: 模範解答画像の無いページが${pagesWithoutImage}件ありました。採点領域と答案は保持しますが、模範解答は空のままです。取り込み後に差し替えてください。`
      )
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: examData as unknown as ExamArchiveData["examData"],
      },
      warnings,
    }
  }
}
