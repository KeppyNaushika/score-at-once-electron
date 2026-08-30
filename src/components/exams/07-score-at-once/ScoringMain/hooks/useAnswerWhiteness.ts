/**
 * @fileoverview 答案の白さ（空欄らしさ）算出フック
 * @description 一覧表示を開いた時点で、そのページの全答案×全採点領域の白さを先読みする。
 */

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { answerWhitenessQuery } from "@/queries/scoring"
import type {
  RegionWhiteness,
  WhitenessTargetRegion,
} from "@/types/answerWhiteness.types"

/** studentAnswerImage.id → cropRegion.id → 白さ */
export type WhitenessByAnswerId = Map<string, Map<string, RegionWhiteness>>

interface UseAnswerWhitenessProps {
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: QuestionAnswerRegionRow[]
  /** 一覧に表示しているページ */
  currentExamPageId: string | null
  /** 一覧表示中のみ算出する */
  enabled: boolean
}

/** 未取得のときに毎回新しい Map を作らないための空値 */
const EMPTY_WHITENESS: WhitenessByAnswerId = new Map()

/** 算出済みか判定するための、対象ページの答案画像の顔ぶれ */
function buildMeasurementSignature(
  answerImages: StudentAnswerImageWithExamStudents[],
  regions: WhitenessTargetRegion[]
): string {
  const images = answerImages
    .map((answerImage) => `${answerImage.id}:${answerImage.imagePath ?? ""}`)
    .sort()
    .join("|")
  // **矩形も鍵に入れる。** 白さは「どの画像を、どの枠で測ったか」で決まる。答案の
  // 顔ぶれだけを見ていると、02 で解答欄を動かしたあと 07 へ戻っても測り直さず、
  // **古い矩形で測った値が使われ続ける**（足した領域は結果の map に無いので黙って
  // 落ちる）。この鍵は試験のまとまりの外にあり、どの書き込みでも無効化されない
  // ので、入力を鍵で表しきる以外に手が無い（docs/branch-review-findings.md #11）。
  const rects = regions
    .map(
      (region) =>
        `${region.cropRegionId}:${region.x},${region.y},${region.width},${region.height}`
    )
    .sort()
    .join("|")
  return `${images}#${rects}`
}

/**
 * 一覧表示中のページについて、答案ごとの採点領域の白さを算出して保持するフック。
 *
 * 算出はページ単位で1回だけ行い、そのページの全採点領域分をまとめて得る。設問を
 * 切り替えても再算出は発生しない（画像1枚のデコードコストに対し、領域を増やす
 * コストは無視できるため。詳細は electron-src/lib/scoring/regionWhiteness.ts）。
 *
 * 算出済みかどうかはキャッシュが覚える。以前は「測ったページ」と「測った顔ぶれ」を
 * 自前の ref と state で持っていたが、ページを行き来するたびに測り直すか、逆に
 * 答案が増えても測り直さないかのどちらかになりやすかった。
 */
export function useAnswerWhiteness({
  studentAnswerImages,
  cropRegions,
  currentExamPageId,
  enabled,
}: UseAnswerWhitenessProps) {
  const pageAnswerImages = useMemo(
    () =>
      currentExamPageId
        ? studentAnswerImages.filter(
            (answerImage) =>
              answerImage.examPageId === currentExamPageId &&
              answerImage.imagePath
          )
        : [],
    [currentExamPageId, studentAnswerImages]
  )

  const pageRegions: WhitenessTargetRegion[] = useMemo(
    () =>
      cropRegions
        .filter((cropRegion) => cropRegion.examPageId === currentExamPageId)
        .map((cropRegion) => ({
          cropRegionId: cropRegion.id,
          x: cropRegion.x,
          y: cropRegion.y,
          width: cropRegion.width,
          height: cropRegion.height,
        })),
    [cropRegions, currentExamPageId]
  )

  const signature = buildMeasurementSignature(pageAnswerImages, pageRegions)

  /**
   * 測る対象があるか。答案か採点領域が無いページでは算出そのものが起きないので、
   * 「算出を待っている」と「待つものが無い」は分けて扱う必要がある。混ぜると、
   * 揃うまで答案を出さない側（白さ順・濃さ順）がそのページで永久に待つ。
   */
  const isMeasurable =
    enabled &&
    Boolean(currentExamPageId) &&
    pageAnswerImages.length > 0 &&
    pageRegions.length > 0

  const { data: measurement } = useQuery({
    ...answerWhitenessQuery(currentExamPageId ?? "", signature, {
      answerImages: pageAnswerImages.map((answerImage) => ({
        studentAnswerImageId: answerImage.id,
        imagePath: answerImage.imagePath ?? "",
      })),
      regions: pageRegions,
    }),
    enabled: isMeasurable,
  })

  // 答案 → 領域 → 白さ へ畳むのは計算。キャッシュには main が返した形が載っている
  const whitenessByAnswerId = useMemo(() => {
    if (!measurement) return EMPTY_WHITENESS
    return new Map(
      measurement.answers.map((answer) => [
        answer.studentAnswerImageId,
        new Map(answer.regions.map((region) => [region.cropRegionId, region])),
      ])
    )
  }, [measurement])

  return {
    whitenessByAnswerId,
    /** 表示中のページの白さが揃っているか（並び順の選択可否と表示可否に使う） */
    isWhitenessReady: Boolean(measurement) || !isMeasurable,
  }
}
