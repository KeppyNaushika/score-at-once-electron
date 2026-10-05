"use client"

import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react"

import { useExamAccess } from "@/components/exams/shared/useExamAccess"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { parsePreference } from "@/lib/userPreferences"
import { type CropRegionRow, cropRegionsQuery } from "@/queries/cropRegion"
import { examDetailQuery, studentAnswerImagesQuery } from "@/queries/exam"
import { userPreferenceQuery } from "@/queries/settings"

/** 答案の上で隠す欄（氏名欄と、番号を書かせる欄） */
const NAME_REGION_TYPES = new Set(["STUDENT_NAME", "STUDENT_ID"])

/** 匿名で採点しているあいだに隠す欄（ページごと） */
type NameRegionsByExamPageId = ReadonlyMap<string, readonly CropRegionRow[]>

interface ScoringAnonymity {
  /** 匿名で採点しているか（試験の固定か、自分で名前を隠しているか） */
  isAnonymous: boolean
  /** 試験の固定が自分に効いているか（効いていれば自分では解除できない） */
  isEnforcedForMe: boolean
  /** ページごとの、隠す欄。匿名でなければ空 */
  nameRegionsByExamPageId: NameRegionsByExamPageId
  /**
   * 受験者に付ける仮の名前（「匿名 12」）。番号は受験者の id の並びで振るので、
   * 名簿の順とも出席番号とも関係なく、開き直しても変わらない
   */
  pseudonymOf: (examStudentId: string) => string
  /** 匿名のときの並び（仮の名前の番号と同じ。名簿の順を使わない） */
  anonymousOrderOf: (examStudentId: string) => number
}

const EMPTY_NAME_REGIONS: NameRegionsByExamPageId = new Map()

/** 匿名でないとき（Provider の外も含む）の姿 */
const NOT_ANONYMOUS: ScoringAnonymity = {
  isAnonymous: false,
  isEnforcedForMe: false,
  nameRegionsByExamPageId: EMPTY_NAME_REGIONS,
  pseudonymOf: () => "",
  anonymousOrderOf: () => 0,
}

const ScoringAnonymityContext = createContext<ScoringAnonymity>(NOT_ANONYMOUS)

interface ScoringAnonymityProviderProps {
  examId: string
  children: ReactNode
}

/**
 * 「7. 採点」の匿名採点（docs/scoring-scope-and-permissions-design.md §3-5）。
 *
 * 2つの層の論理和で決める。
 * - **試験の固定**（`Exam.anonymousScoringEnforced`）。オーナーが決め、オーナー以外に効く。
 *   採点者が自分で解除できては、採点者の先入観を減らせない
 * - **自分の設定**（名前の表示を切る。`showStudentNames`）。1人で使うときに自分で隠す用
 *
 * オーナーには試験の固定が効かない。採点の確定で生徒の名前が要るため。
 *
 * 匿名のあいだは名前を仮の名前に置き換え、名簿の順で並べず、答案の氏名欄を隠す。
 * これは表示だけの制御で、採点データ（誰の答案か）には触れない。権限境界でもない（§2-4）。
 */
export function ScoringAnonymityProvider({
  examId,
  children,
}: ScoringAnonymityProviderProps) {
  const currentUser = useCurrentUser()
  const { role } = useExamAccess(examId)
  const { data: exam } = useQuery(examDetailQuery(examId))
  const { data: storedShowStudentNames } = useQuery(
    userPreferenceQuery(currentUser.id, "showStudentNames")
  )

  // 参加者でない古いデータ（ロールが無い）も、オーナーと同じく固定の対象にしない
  const isEnforcedForMe =
    Boolean(exam?.anonymousScoringEnforced) && role !== null && role !== "OWNER"
  const hidesNamesByChoice = !parsePreference(
    "showStudentNames",
    storedShowStudentNames ?? null
  )
  const isAnonymous = isEnforcedForMe || hidesNamesByChoice

  const { data: cropRegions } = useQuery({
    ...cropRegionsQuery(examId),
    enabled: isAnonymous,
  })
  const { data: studentAnswerImages } = useQuery({
    ...studentAnswerImagesQuery(examId),
    enabled: isAnonymous,
  })

  const nameRegionsByExamPageId = useMemo(() => {
    if (!isAnonymous || !cropRegions) return EMPTY_NAME_REGIONS
    return cropRegions
      .filter((cropRegion) => NAME_REGION_TYPES.has(cropRegion.type))
      .reduce((acc, cropRegion) => {
        acc.set(cropRegion.examPageId, [
          ...(acc.get(cropRegion.examPageId) ?? []),
          cropRegion,
        ])
        return acc
      }, new Map<string, CropRegionRow[]>())
  }, [isAnonymous, cropRegions])

  /** 受験者 → 仮の番号。受験者の id（uuid）の並びで振る */
  const numberByExamStudentId = useMemo(() => {
    const examStudentIds = [
      ...new Set(
        (studentAnswerImages ?? []).map(
          (answerImage) => answerImage.examStudentId
        )
      ),
    ].sort()
    return new Map(
      examStudentIds.map((examStudentId, index) => [examStudentId, index + 1])
    )
  }, [studentAnswerImages])

  const pseudonymOf = useCallback(
    (examStudentId: string) => {
      const pseudonymNumber = numberByExamStudentId.get(examStudentId)
      return pseudonymNumber === undefined ? "匿名" : `匿名 ${pseudonymNumber}`
    },
    [numberByExamStudentId]
  )
  // 番号の無い受験者（取り直しの途中など）は末尾へ
  const anonymousOrderOf = useCallback(
    (examStudentId: string) =>
      numberByExamStudentId.get(examStudentId) ?? Number.MAX_SAFE_INTEGER,
    [numberByExamStudentId]
  )

  const value = useMemo<ScoringAnonymity>(
    () =>
      isAnonymous
        ? {
            isAnonymous,
            isEnforcedForMe,
            nameRegionsByExamPageId,
            pseudonymOf,
            anonymousOrderOf,
          }
        : NOT_ANONYMOUS,
    [
      isAnonymous,
      isEnforcedForMe,
      nameRegionsByExamPageId,
      pseudonymOf,
      anonymousOrderOf,
    ]
  )

  return (
    <ScoringAnonymityContext.Provider value={value}>
      {children}
    </ScoringAnonymityContext.Provider>
  )
}

/** 匿名採点の状態。Provider の外（採点確定など）では常に匿名でない */
export function useScoringAnonymity(): ScoringAnonymity {
  return useContext(ScoringAnonymityContext)
}
