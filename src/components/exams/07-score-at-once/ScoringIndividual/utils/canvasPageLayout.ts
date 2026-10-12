/**
 * 答案の複数ページを縦に積んだキャンバスの配置計算
 *
 * メイン・オーバーレイ・テキストの3枚のキャンバスは同じ大きさで重なっているので、
 * ページの位置はどれも同じ式で求める。
 */
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import type { CropRegionWithStatus } from "../hooks/core/types"
import type { AnswerPageSize } from "../types"

/** 積んだキャンバスの大きさ（幅は1ページ目、高さは全ページ＋ページ間の余白） */
export function stackedCanvasSize(
  images: HTMLImageElement[],
  pageSpacing: number
): { width: number; height: number } {
  return {
    width: images[0].naturalWidth,
    height: images.reduce(
      (total, image, index) =>
        total +
        image.naturalHeight +
        (index < images.length - 1 ? pageSpacing : 0),
      0
    ),
  }
}

/** ページの上端の y（それより前のページの高さと余白の合計） */
export function pageOffsetY(
  images: HTMLImageElement[],
  pageIndex: number,
  pageSpacing: number
): number {
  return images
    .slice(0, pageIndex)
    .reduce(
      (offset, image) =>
        offset + image.naturalHeight + (images.length > 1 ? pageSpacing : 0),
      0
    )
}

/** ページの左端の x（幅の狭いページは中央に寄せる） */
export function pageOffsetX(
  canvasWidth: number,
  pageImage: HTMLImageElement
): number {
  return (canvasWidth - pageImage.naturalWidth) / 2
}

/** 1ページの画像と、積んだキャンバス上でのその左上 */
export interface PagePlacement {
  pageImage: HTMLImageElement
  offsetX: number
  offsetY: number
}

/** 添字のページの画像と、積んだキャンバス上でのその左上（キャンバスの幅は1ページ目） */
export function pagePlacementAt(
  images: HTMLImageElement[],
  pageIndex: number,
  pageSpacing: number
): PagePlacement {
  const pageImage = images[pageIndex]
  return {
    pageImage,
    offsetX: pageOffsetX(images[0].naturalWidth, pageImage),
    offsetY: pageOffsetY(images, pageIndex, pageSpacing),
  }
}

/**
 * 設問が載っているページの、読み込んだ答案画像の並び（loadedExamPageIds）での添字
 *
 * ページは examPageId で同定する。答案画像はその生徒の「ある分だけ」を詰めて並べるので、
 * ページ番号から添字は作れない（真ん中のページが欠けると後ろのページが前へずれる）。
 * その生徒の答案にそのページが無い（画像が無い・読み込めなかった）ときは null。
 */
export function loadedPageIndexOfCropRegion(
  cropRegion: Pick<QuestionAnswerRegionRow, "examPageId"> | null | undefined,
  loadedExamPageIds: readonly string[]
): number | null {
  if (!cropRegion) return null
  const pageIndex = loadedExamPageIds.indexOf(cropRegion.examPageId)
  return pageIndex === -1 ? null : pageIndex
}

/**
 * 現在の設問のページが、表示中の生徒の答案に無いか
 *
 * 読み込んだ画像がまだその生徒のものでない（生徒を切り替えて読み込み中）・1枚も読み込めて
 * いない・設問が無い間は判定できないので false（無いとは言わない）。
 * 描画（枠を描かない）・表示（「この設問のページは答案にありません」）・採点の停止はこの1つで決める
 */
export function isQuestionPageMissingFromAnswer({
  cropRegion,
  examStudentId,
  imageLoaded,
  loadedExamStudentId,
  loadedExamPageIds,
}: {
  cropRegion: Pick<QuestionAnswerRegionRow, "examPageId"> | null | undefined
  /** 表示中の答案の受験者 */
  examStudentId: string | null | undefined
  imageLoaded: boolean
  /** 読み込んだ画像の受験者 */
  loadedExamStudentId: string | null
  loadedExamPageIds: readonly string[]
}): boolean {
  if (!cropRegion || !examStudentId || !imageLoaded) return false
  if (loadedExamStudentId !== examStudentId) return false
  return loadedPageIndexOfCropRegion(cropRegion, loadedExamPageIds) === null
}

/** 模範解答の1ページを、答案の同じページに重ねる位置と大きさ（ズーム前） */
export interface MasterPagePlacement<MasterPage> {
  masterPage: MasterPage
  left: number
  top: number
  width: number
  height: number
}

/**
 * 模範解答の各ページを、答案の同じページ（examPageId が同じページ）の位置と大きさに置く
 *
 * 答案は「ある分だけ」を詰めて積むので、模範解答の i 枚目を答案の i 枚目に置くと、
 * 答案の真ん中のページが欠けたときに後ろのページの模範解答が1枚ずつずれる。
 * 答案に無いページの模範解答は置かない（答案側にそのページの場所が無い）。
 * 位置は積んだキャンバス（`pagePlacementAt`）と同じ式: 幅の狭いページは中央に寄せ、
 * 上端は前のページの高さと余白の合計
 */
export function placeMasterPagesOnAnswer<
  MasterPage extends { examPageId: string },
>(
  masterPages: readonly MasterPage[],
  answerPageSizes: readonly AnswerPageSize[],
  pageSpacing: number
): MasterPagePlacement<MasterPage>[] {
  if (answerPageSizes.length === 0) return []
  const canvasWidth = answerPageSizes[0].width
  return masterPages.flatMap((masterPage) => {
    const pageIndex = answerPageSizes.findIndex(
      (answerPageSize) => answerPageSize.examPageId === masterPage.examPageId
    )
    if (pageIndex === -1) return []
    const answerPageSize = answerPageSizes[pageIndex]
    return [
      {
        masterPage,
        left: (canvasWidth - answerPageSize.width) / 2,
        top: answerPageSizes
          .slice(0, pageIndex)
          .reduce(
            (offset, answerPageBefore) =>
              offset + answerPageBefore.height + pageSpacing,
            0
          ),
        width: answerPageSize.width,
        height: answerPageSize.height,
      },
    ]
  })
}

/** cropRegionId → ページの添字（答案にページが無い設問は入れない） */
export function pageIndexByCropRegionId(
  allCropRegionsWithStatus: CropRegionWithStatus[],
  loadedExamPageIds: readonly string[]
): Map<string, number> {
  return new Map(
    allCropRegionsWithStatus.flatMap(({ cropRegion }) => {
      const pageIndex = loadedPageIndexOfCropRegion(
        cropRegion,
        loadedExamPageIds
      )
      return pageIndex === null ? [] : [[cropRegion.id, pageIndex] as const]
    })
  )
}

/**
 * 積んだキャンバス上の点（ズーム前）を、添字のページの中の正規化座標（0〜1）へ写す。
 * ページの外の点は 0〜1 を外れた値になる（注釈はそのページに属するものとして扱う）
 */
export function canvasPointToPageCoordinates(
  canvasPoint: { x: number; y: number },
  images: HTMLImageElement[],
  pageIndex: number,
  pageSpacing: number
): { x: number; y: number } | null {
  const { pageImage, offsetX, offsetY } = pagePlacementAt(
    images,
    pageIndex,
    pageSpacing
  )
  if (!pageImage || !pageImage.naturalWidth || !pageImage.naturalHeight) {
    return null
  }
  return {
    x: (canvasPoint.x - offsetX) / pageImage.naturalWidth,
    y: (canvasPoint.y - offsetY) / pageImage.naturalHeight,
  }
}
