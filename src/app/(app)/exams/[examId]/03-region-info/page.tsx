"use client"

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

import { GraderAssignmentTable } from "@/components/exams/03-region-info/components/GraderAssignmentTable"
import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { useOmrConfig } from "@/components/exams/03-region-info/hooks/useOmrConfig"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { type CropRegionRow, cropRegionsQuery } from "@/queries/cropRegion"
import { examPagesQuery } from "@/queries/exam"
import { scopeKeys } from "@/queries/keys"
import { fileProtocolPathQuery } from "@/queries/misc"
import { cropRegionAssignmentsQuery } from "@/queries/scoring"
import { examMembersQuery } from "@/queries/userExam"

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_EXAM_PAGES: ExamPageWithContent[] = []
const EMPTY_CROP_REGIONS: CropRegionRow[] = []

export default function RegionInfoPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  /**
   * 選択中の採点領域。**添字ではなく id で持つ。**
   * 1打鍵ごとに書くので取り直しが頻繁に走り、他の教員の削除や同期での増減で
   * 添字はずれる（範囲外になると、どこも光らないまま黙って外れていた）。
   */
  const [selectedCropRegionId, setSelectedCropRegionId] = useState<
    string | null
  >(null)
  /** 表示中のページ。未選択なら取得結果の先頭を出す */
  const [selectedExamPageId, setSelectedExamPageId] = useState<string | null>(
    null
  )
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()

  // OMR設定管理
  const { getOmrConfig, upsertOmrConfig, deleteOmrConfig } =
    useOmrConfig(examId)

  const {
    data: fetchedExamPages = EMPTY_EXAM_PAGES,
    isPending: examPagesPending,
    error: examPagesError,
  } = useQuery(examPagesQuery(examId))
  const {
    data: cropRegions = EMPTY_CROP_REGIONS,
    isPending: cropRegionsPending,
    error: cropRegionsError,
  } = useQuery(cropRegionsQuery(examId))

  /**
   * 設問ごとの採点担当。**参加者が1人なら担当という概念そのものが要らない**ので、
   * この取得だけでタブを出すかどうかまで決まる（`memberCount`）。
   */
  const { data: assignmentData } = useQuery({
    ...cropRegionAssignmentsQuery(examId, currentUser.id),
    enabled: Boolean(examId),
  })
  const canManageAssignments = assignmentData?.canManage ?? false
  /** 協調採点をしている試験でだけ担当を出す（07 の確定導線と同じ判定） */
  const showAssignments = (assignmentData?.memberCount ?? 0) > 1

  // 対応表の列は参加者。**誰が担当かは所有者でなくても知りたい**ので、
  // 直せる人だけでなく協調採点の試験なら全員が引く
  const { data: examMembers } = useQuery({
    ...examMembersQuery(examId),
    enabled: Boolean(examId) && showAssignments,
  })

  const isLoading = examPagesPending || cropRegionsPending
  const error = examPagesError ?? cropRegionsError

  // 一覧はページ番号順に出す（並べ替えは表示のたびに行う）
  const examPages = useMemo(
    () =>
      [...fetchedExamPages].sort(
        (pageA, pageB) => pageA.pageNumber - pageB.pageNumber
      ),
    [fetchedExamPages]
  )

  // 背景画像はページごとに引く。画像を持たないページは引かない
  const backgroundImageUrls = useQueries({
    queries: examPages.map((examPage) => ({
      ...fileProtocolPathQuery(examPage.imagePath ?? ""),
      enabled: Boolean(examPage.imagePath),
    })),
    combine: (results: { data?: string }[]) =>
      Object.fromEntries(
        examPages.map((examPage, index) => [
          examPage.id,
          examPage.imagePath ? (results[index]?.data ?? "") : "",
        ])
      ),
  })

  /** 採点担当の対応表の行。担当が付くのは設問だけ（氏名欄や小計欄には付かない） */
  const questionRegions = useMemo(
    () =>
      cropRegions.filter((cropRegion) => cropRegion.type === "QUESTION_ANSWER"),
    [cropRegions]
  )

  /** 採点担当の対応表の列。参加者の実体をそのまま並べる */
  const graders = useMemo(
    () => (examMembers ?? []).map((member) => member.user),
    [examMembers]
  )

  /**
   * どのマスに担当が入っているか。取得はDBの行のまま持ち、**マスを引くための
   * id の対**へはここで畳む（行の配列のままだと、マスの数だけ全走査になる）。
   */
  const assignedUserIdsByCropRegionId = useMemo(() => {
    const assignedUserIds = new Map<string, Set<string>>()
    for (const cropRegionAssignment of assignmentData?.assignments ?? []) {
      const userIds =
        assignedUserIds.get(cropRegionAssignment.cropRegionId) ??
        new Set<string>()
      userIds.add(cropRegionAssignment.userId)
      assignedUserIds.set(cropRegionAssignment.cropRegionId, userIds)
    }
    return assignedUserIds
  }, [assignmentData?.assignments])

  // 表示中のページ。未選択なら先頭を出す（取得結果から導くので state を持たない）
  const selectedExamPage =
    examPages.find((examPage) => examPage.id === selectedExamPageId) ??
    examPages[0] ??
    null

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>領域情報を読み込み中...</p>
      </div>
    )
  }
  // 取得に失敗したまま編集画面を出すと、保存が黙って何もしない（操作者が居ない）
  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">
              エラーが発生しました
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message}
            </p>
            <Button
              onClick={() =>
                // 失敗しうるのは採点領域だけではない。エラー画面はページの取得の
                // 失敗でも出るので、この画面が読んでいるもの全部を取り直す
                // （retry: false なので、取り直さない方が残ると二度と戻れない）
                queryClient.invalidateQueries({
                  queryKey: scopeKeys.exam(examId),
                })
              }
              className="mt-4"
              variant="outline"
            >
              再読み込み
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 「領域情報」タブの中身（表と合計配点）。
   *
   * 参加者が1人ならタブ帯を描かず、この中身だけを右ペインへ直に置く。
   * どちらの置き方でも同じものが出るよう、1か所で組み立てて使い回す。
   */
  const regionInfoPane = (
    <>
      <div className="min-h-0 flex-1 overflow-hidden">
        <RegionDetailsTable
          examId={examId}
          regions={cropRegions}
          selectedCropRegionId={selectedCropRegionId}
          onSelectCropRegion={setSelectedCropRegionId}
          getOmrConfig={getOmrConfig}
          onOmrSave={upsertOmrConfig}
          onOmrDelete={deleteOmrConfig}
        />
      </div>
      {/* 合計点フッター（固定表示） */}
      <div className="flex shrink-0 items-center justify-end border-t bg-muted/30 px-6 py-2">
        <span className="text-sm font-medium">
          合計配点：
          <span className="text-lg font-bold">
            {cropRegions
              .filter((region) => region.type === "QUESTION_ANSWER")
              .reduce((sum, region) => sum + (region.points ?? 0), 0)}
          </span>
          点
        </span>
      </div>
    </>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: All Pages Preview */}
        <div
          className="flex flex-col border-r"
          style={{ width: "400px", maxWidth: "33.333%" }}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {examPages.map((page) => {
                const displayPageNumber = page.pageNumber
                const imageUrl = backgroundImageUrls[page.id]
                const pageRegions = cropRegions.filter(
                  (region) => region.examPage?.id === page.id
                )

                return (
                  <div key={page.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">
                        ページ {displayPageNumber}
                      </h4>
                      <div className="text-xs text-muted-foreground">
                        ({pageRegions.length}個の領域)
                      </div>
                    </div>

                    {imageUrl ? (
                      <div className="relative overflow-hidden rounded-lg border">
                        <Image
                          src={imageUrl}
                          alt={`模範解答 ページ ${displayPageNumber}`}
                          /*
                           * `h-auto` が無いと height 属性の 600px が残り（`w-full`
                           * が上書きするのは width だけ）、箱が「幅 × 600px」に
                           * なって絵が上下に余白を持って収まる。枠は**箱に対する
                           * %** で置いてあるので、その余白のぶんだけずれる
                           * （A4縦・幅368pxで実測: 上から10%の枠が 60px に出る。
                           * 絵の中の正しい位置は 91.8px、高さも15%大きい）。
                           */
                          className="h-auto w-full cursor-pointer object-contain transition-opacity hover:opacity-75"
                          width={800}
                          height={600}
                          unoptimized
                          onClick={() => {
                            setSelectedExamPageId(page.id)
                          }}
                        />
                        {pageRegions.map((pageRegion) => {
                          const isSelected =
                            selectedCropRegionId === pageRegion.id
                          return (
                            <div
                              key={pageRegion.id}
                              className={`absolute border-2 ${
                                isSelected
                                  ? "border-orange-500 bg-orange-500/30"
                                  : "border-blue-500 bg-blue-500/20"
                              }`}
                              style={{
                                left: `${pageRegion.x * 100}%`,
                                top: `${pageRegion.y * 100}%`,
                                width: `${pageRegion.width * 100}%`,
                                height: `${pageRegion.height * 100}%`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCropRegionId(pageRegion.id)
                              }}
                            />
                          )
                        })}
                        {selectedExamPage?.id === page.id && (
                          <div className="absolute top-2 left-2 rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                            編集中
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-lg border bg-gray-100">
                        <div className="text-sm text-muted-foreground">
                          画像が見つかりません
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/*
            合計配点は表の下（右のフッター）だけに出す。同じ数が2か所にあると
            ずれて見えたときにどちらが正か分からなくなるので、**配点を打ち込む
            表の側**に残した。ここは左ペインの持ち物である領域の数だけを言う
          */}
          <div className="border-t p-2 text-xs text-muted-foreground">
            <span>{cropRegions.length}個の領域</span>
          </div>
        </div>

        {/*
          Right: Region Details Table

          題は段のヘッダー（「3. 領域情報」）、領域の数は左のフッター、操作の説明は
          「使い方」（`HelpContent03RegionInfo`）が言う。ここで言い直さない。
          「※ ページ N を選択中」は表を絞っていないのに絞っているように読めるので消した
        */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {showAssignments ? (
            <Tabs
              defaultValue="region-info"
              className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
            >
              <TabsList className="m-3 shrink-0 self-start">
                <TabsTrigger value="region-info">領域情報</TabsTrigger>
                <TabsTrigger value="grader-assignment">採点担当</TabsTrigger>
              </TabsList>
              {/* 既定で開くのは領域情報。担当より先に配点とラベルを埋める段だから */}
              <TabsContent
                value="region-info"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                {regionInfoPane}
              </TabsContent>
              <TabsContent
                value="grader-assignment"
                className="min-h-0 flex-1 overflow-auto"
              >
                <GraderAssignmentTable
                  examId={examId}
                  questionRegions={questionRegions}
                  graders={graders}
                  assignedUserIdsByCropRegionId={assignedUserIdsByCropRegionId}
                  canManage={canManageAssignments}
                />
              </TabsContent>
            </Tabs>
          ) : (
            // 参加者が1人ならタブ帯そのものを描かない（招いた瞬間に現れる）
            regionInfoPane
          )}
        </div>
      </div>
    </div>
  )
}
