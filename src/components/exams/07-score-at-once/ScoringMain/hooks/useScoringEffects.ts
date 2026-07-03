/**
 * 採点画面のEffect処理を統合するフック
 *
 * ScoringMainViewから抽出されたuseEffect群
 * - 採点モード変更時の選択調整
 * - 設問自動選択
 * - 設問変更時の選択更新
 */

import { useEffect, useLayoutEffect, useRef } from "react"

import type {
  CropRegionWithExamPage,
  GradingMode,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

/**
 * useScoringEffectsの入力パラメータ
 */
interface UseScoringEffectsParams {
  /** 現在の採点モード */
  gradingMode: GradingMode
  /** 選択中のページ画像ID集合 */
  selectedStudentAnswerImageIds: Set<string>
  /** ページ画像一覧 */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** 採点領域一覧 */
  cropRegions: CropRegionWithExamPage[]
  /** 現在選択中の採点領域ID */
  currentCropRegionId: string | null
  /** 選択ページ画像IDを設定する関数 */
  setSelectedPageImageIds: (ids: Set<string>) => void
  /** 採点領域IDを設定する関数 */
  setCurrentCropRegionId: (id: string | null) => void
  /** 設問変更バージョンを設定する関数 */
  setQuestionChangeVersion: React.Dispatch<React.SetStateAction<number>>
}

/**
 * 採点画面のEffect処理を統合するフック
 *
 * @param params - Effect処理に必要なパラメータ
 */
export function useScoringEffects(params: UseScoringEffectsParams): void {
  const {
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setQuestionChangeVersion,
  } = params

  // 設問変更追跡用ref
  const previousCropRegionIdRef = useRef<string | null>(currentCropRegionId)

  // 設問変更時のeffectで使用するためのrefs（依存配列の問題を回避）
  const studentAnswerImagesRef = useRef(studentAnswerImages)
  const selectedStudentAnswerImageIdsRef = useRef(selectedStudentAnswerImageIds)
  const cropRegionsRef = useRef(cropRegions)

  // refsを常に最新の値で更新
  useLayoutEffect(() => {
    studentAnswerImagesRef.current = studentAnswerImages
    selectedStudentAnswerImageIdsRef.current = selectedStudentAnswerImageIds
    cropRegionsRef.current = cropRegions
  })

  /**
   * 個別表示モードでは単一選択を維持
   */
  useEffect(() => {
    if (
      gradingMode === "individual" &&
      selectedStudentAnswerImageIds.size > 1
    ) {
      const firstSelected = Array.from(selectedStudentAnswerImageIds)[0]
      setSelectedPageImageIds(new Set([firstSelected]))
    }
  }, [gradingMode, selectedStudentAnswerImageIds, setSelectedPageImageIds])

  /**
   * 設問未選択時は最初の設問を自動選択
   */
  useEffect(() => {
    if (cropRegions.length > 0 && !currentCropRegionId) {
      const firstQuestionRegion = cropRegions.find(
        (region) => region.type === "QUESTION_ANSWER"
      )
      if (firstQuestionRegion) {
        setCurrentCropRegionId(firstQuestionRegion.id)
      }
    }
  }, [cropRegions, currentCropRegionId, setCurrentCropRegionId])

  /**
   * 設問変更時の選択更新
   */
  useEffect(() => {
    // 設問が変更されていない場合は何もしない
    if (
      !previousCropRegionIdRef.current ||
      !currentCropRegionId ||
      previousCropRegionIdRef.current === currentCropRegionId
    ) {
      previousCropRegionIdRef.current = currentCropRegionId
      return
    }

    if (gradingMode === "grid") {
      // グリッドモード: 選択をリセット
      setSelectedPageImageIds(new Set())
      setQuestionChangeVersion((version) => version + 1)
    } else {
      // 個別モード: 現在選択中の生徒の新しい設問ページに対応するpageImageに更新
      const currentSelectedIds = selectedStudentAnswerImageIdsRef.current
      const currentPageImages = studentAnswerImagesRef.current
      const currentCropRegions = cropRegionsRef.current

      if (currentSelectedIds.size > 0) {
        const currentAnswerId = Array.from(currentSelectedIds)[0]
        const currentAnswer = currentPageImages.find(
          (pageImage) => pageImage.id === currentAnswerId
        )
        if (currentAnswer?.student?.id) {
          // 新しい設問のcropRegionを取得
          const newCropRegion = currentCropRegions.find(
            (cropRegion) => cropRegion.id === currentCropRegionId
          )
          if (newCropRegion) {
            // 同じ生徒の新しいページに対応するpageImageを探す
            const studentId = currentAnswer.student?.id
            const newPageImage = currentPageImages.find(
              (pageImage) =>
                pageImage.student?.id === studentId &&
                pageImage.examPageId === newCropRegion.examPageId
            )
            if (newPageImage) {
              setSelectedPageImageIds(new Set([newPageImage.id]))
            }
          }
        }
      }
    }

    previousCropRegionIdRef.current = currentCropRegionId
  }, [
    gradingMode,
    currentCropRegionId,
    setSelectedPageImageIds,
    setQuestionChangeVersion,
  ])
}
