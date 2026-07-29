/**
 * 成績算出アーカイブのインポート
 */

import type { Prisma } from "@prisma/client"

import type {
  GradeArchiveData,
  GradeArchiveImportOptions,
  GradeArchiveImportPreview,
} from "../../../../src/types/gradeArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { writeConstraintConfig } from "../../prisma/gradeConstraint"
import { buildEstimationSourceRows } from "../../prisma/gradeDataSource"
import { importCourseworkData } from "../coursework-archive/dataCreator"
import { transformGradeToLatest } from "../grade-transformers"

/** アーカイブ側の生徒参照の最小形（uuid一次・学籍番号二次で解決する） */
interface ArchiveStudentReference {
  id?: string
  studentNumber: string
}

/**
 * アーカイブの生徒参照から既存 Student を解決する。
 * uuid 一次（同一PC由来／exam-archive 経由で uuid ごと作られた生徒に当たる）、
 * 学籍番号二次（別PCで先に登録された生徒に当たる）。
 * grade-archive は生徒マスタを作らない（既存への lookup のみ）方針なので、
 * どちらでも当たらなければ null を返し、呼び出し側がスキップする。
 */
async function resolveStudent(
  tx: Prisma.TransactionClient,
  reference: ArchiveStudentReference
) {
  if (reference.id) {
    const byId = await tx.student.findUnique({ where: { id: reference.id } })
    if (byId) return byId
  }
  return tx.student.findUnique({
    where: { studentNumber: reference.studentNumber },
  })
}

/**
 * インポート前のプレビュー（照合結果）
 */
export async function previewGradeArchiveImport(
  rawData: GradeArchiveData
): Promise<GradeArchiveImportPreview> {
  // 旧バージョンを現行（courseworkArchive 形式）へ正規化してから照合する。
  // 変換で失われるデータの警告は取り込み前に見せる必要があるので捨てない。
  const { data, warnings } = transformGradeToLatest(rawData)
  const { gradeData } = data
  const courseworkArchive = data.courseworkArchive

  // Classroom照合（複数学級対応）
  const classroomMatches = await Promise.all(
    gradeData.classroomRefs.map(async (ref) => {
      const existing =
        (ref.id
          ? await prisma.classroom.findUnique({ where: { id: ref.id } })
          : null) ??
        (await prisma.classroom.findUnique({ where: { name: ref.name } }))
      return { found: !!existing, name: ref.name }
    })
  )

  // Exam照合
  const examMatches = await Promise.all(
    gradeData.examRefs.map(async (ref) => {
      const byId = ref.id
        ? await prisma.exam.findUnique({
            where: { id: ref.id },
            select: { id: true },
          })
        : null
      const exams = byId
        ? [byId]
        : await prisma.exam.findMany({
            where: { examName: ref.examName },
            select: { id: true },
          })
      return {
        examName: ref.examName,
        found: exams.length > 0,
        examId: exams[0]?.id ?? null,
      }
    })
  )

  // 埋め込み資料の照合候補（正規化済みのため courseworkArchive のみ参照）
  const cwPreviewItems = (courseworkArchive?.courseworks ?? []).map(
    (coursework) => ({
      id: coursework.id,
      name: coursework.name,
      itemCount: (courseworkArchive?.courseworkItems ?? []).filter(
        (item) => item.courseworkId === coursework.id
      ).length,
      studentCount: (courseworkArchive?.courseworkStudents ?? []).filter(
        (courseworkStudent) => courseworkStudent.courseworkId === coursework.id
      ).length,
    })
  )

  // Student照合（uuid一次・学籍番号二次）。import 本体と同じ順序で数えないと
  // 「見つかりません」の件数が実際の取り込み結果とずれる。
  const studentReferences = [
    ...(courseworkArchive?.studentsData ?? []),
    ...gradeData.studentRefs,
  ]
  const uniqueStudentReferences = new Map<
    string,
    { id?: string; studentNumber: string }
  >()
  for (const studentReference of studentReferences) {
    // 学籍番号で名寄せする（同じ生徒が資料側と成績側の両方に現れる）
    if (!uniqueStudentReferences.has(studentReference.studentNumber)) {
      uniqueStudentReferences.set(studentReference.studentNumber, {
        id: studentReference.id,
        studentNumber: studentReference.studentNumber,
      })
    }
  }
  const existingStudents = await prisma.student.findMany({
    select: { id: true, studentNumber: true },
  })
  const existingStudentIds = new Set(
    existingStudents.map((student) => student.id)
  )
  const existingNumberSet = new Set(
    existingStudents.map((student) => student.studentNumber)
  )
  const resolvedStudentNumbers = [...uniqueStudentReferences.values()].filter(
    (studentReference) =>
      (studentReference.id !== undefined &&
        existingStudentIds.has(studentReference.id)) ||
      existingNumberSet.has(studentReference.studentNumber)
  )
  const uniqueNumbers = [...uniqueStudentReferences.keys()]
  const resolvedNumberSet = new Set(
    resolvedStudentNumbers.map(
      (studentReference) => studentReference.studentNumber
    )
  )

  // 埋め込み資料のマッチング候補（uuid一次・名前二次）を算出
  const courseworkMatches = await Promise.all(
    cwPreviewItems.map(async (courseworkPreview) => {
      // uuid 完全一致（同一PC由来）
      const uuidMatch = courseworkPreview.id
        ? await prisma.coursework.findUnique({
            where: { id: courseworkPreview.id },
            select: { id: true, name: true },
          })
        : null
      // 名前一致候補（名前は非ユニークなので複数あり得る。uuid一致は除外）
      const nameCandidates = (
        await prisma.coursework.findMany({
          where: { name: courseworkPreview.name },
          select: { id: true, name: true },
        })
      ).filter((coursework) => coursework.id !== uuidMatch?.id)
      return {
        archiveId: courseworkPreview.id,
        name: courseworkPreview.name,
        itemCount: courseworkPreview.itemCount,
        studentCount: courseworkPreview.studentCount,
        uuidMatch: uuidMatch ?? null,
        nameCandidates,
      }
    })
  )

  return {
    manifest: data.manifest,
    classroomMatches,
    examMatches,
    studentMatchCount: resolvedNumberSet.size,
    studentMissingCount: uniqueNumbers.filter(
      (studentNumber) => !resolvedNumberSet.has(studentNumber)
    ).length,
    courseworkMatches,
    warnings,
  }
}

/**
 * 実際のインポート実行
 */
export async function importGradeArchive(
  rawData: GradeArchiveData,
  options: GradeArchiveImportOptions = {}
): Promise<{
  success: boolean
  gradeId?: string
  error?: string
  /** 取り込み時の警告（点数スキップ・参照先未検出など）。空なら省略 */
  warnings?: string[]
}> {
  try {
    const { examMapping, courseworkDecisions = {} } = options
    // 旧バージョン（1.3.0 manual / 1.4.0 名前ベース）を現行へ正規化してから取り込む
    const { data, warnings: transformWarnings } =
      transformGradeToLatest(rawData)
    const warnings: string[] = [...transformWarnings]
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const { gradeData, boundariesData } = data

        // 1. Grade作成
        const grade = await tx.grade.create({
          data: {
            name: gradeData.grade.name,
            description: gradeData.grade.description,
            // v1.2.0+: 基準日（古いアーカイブではundefined → null）
            referenceDate: gradeData.grade.referenceDate
              ? new Date(gradeData.grade.referenceDate)
              : null,
          },
        })

        // 1.5. GradeExportSettings作成 (v1.2.0+、Gradeと1:1)
        if (gradeData.exportSettings) {
          await tx.gradeExportSettings.create({
            data: {
              gradeId: grade.id,
              settingsJson: gradeData.exportSettings.settingsJson,
            },
          })
        }

        // 2. Classroom照合→GradeClassroom作成（uuid一次・名前二次）
        for (let i = 0; i < gradeData.classroomRefs.length; i++) {
          const ref = gradeData.classroomRefs[i]
          const classroom =
            (ref.id
              ? await tx.classroom.findUnique({ where: { id: ref.id } })
              : null) ??
            (await tx.classroom.findUnique({ where: { name: ref.name } }))
          if (classroom) {
            await tx.gradeClassroom.create({
              data: {
                gradeId: grade.id,
                classroomId: classroom.id,
                order: i,
              },
            })
          }
        }

        // 3. Student照合→GradeStudent作成（uuid一次・学籍番号二次）
        for (const studentRef of gradeData.studentRefs) {
          const student = await resolveStudent(tx, studentRef)
          if (student) {
            await tx.gradeStudent.create({
              data: {
                gradeId: grade.id,
                studentId: student.id,
                customOrder: studentRef.customOrder,
              },
            })
          }
        }

        // 3.5. Coursework（試験外成績資料）の復元。
        //   transformGradeToLatest により旧 v1.3.0(manual)/v1.4.0(名前ベース) は
        //   現行の courseworkArchive 形式へ正規化済み。独立 coursework モジュールへ委譲し、
        //   既存生徒・学級への lookup のみ（allowCreate=false）で grade の従来挙動を維持する。
        // 評価項目の参照解決。アーカイブ側の uuid → 作成した GradeItem.id という
        // 「旧世界→新世界」の対応で、DB のどこにも存在しない取り込み固有の情報
        // （coursework の itemIdToActual と同じ性質）。DB にある構造の写しではない。
        /** アーカイブ評価項目uuid → 作成した GradeItem.id（照合の一次キー） */
        const gradeItemIdByArchiveId = new Map<string, string>()
        /**
         * 評価項目名 → 作成した GradeItem.id。uuid を持たない v1.9.0 以前の
         * アーカイブ専用のフォールバック。GradeItem には (gradeId, name) の unique が
         * 無く名前は衝突しうるので、一次キーには使わない。
         */
        const gradeItemIdByName = new Map<string, string>()
        /** 名前が重複し、名前フォールバックでは一意に定まらない評価項目名 */
        const ambiguousGradeItemNames = new Set<string>()

        /** アーカイブデータソースuuid → 作成した GradeDataSource.id（推定参照の解決用） */
        const dataSourceIdByArchiveId = new Map<string, string>()
        /** 推定の参照。全データソース作成後に張るため一旦ためる（前方参照があるため） */
        const estimationLinks: {
          dataSourceId: string
          archiveSourceIds: string[]
        }[] = []

        /**
         * アーカイブ側の評価項目参照から、作成した GradeItem.id を解決する。
         * uuid 一次・名前二次。名前が曖昧なときは取り違えるより落として警告する
         * （境界・上書き・確定値は成績そのもので、誤った項目へ付けるほうが害が大きい）。
         */
        const resolveGradeItemId = (
          reference: { gradeItemId?: string; gradeItemName: string | null },
          describeTarget: () => string
        ): string | null => {
          if (reference.gradeItemId) {
            const byArchiveId = gradeItemIdByArchiveId.get(
              reference.gradeItemId
            )
            if (byArchiveId) return byArchiveId
          }
          if (!reference.gradeItemName) return null
          if (ambiguousGradeItemNames.has(reference.gradeItemName)) {
            warnings.push(
              `${describeTarget()}: 同名の評価項目「${reference.gradeItemName}」が複数あり対象を特定できないため取り込みませんでした`
            )
            return null
          }
          return gradeItemIdByName.get(reference.gradeItemName) ?? null
        }

        /** アーカイブ項目uuid → 実 CourseworkItem.id（DataSource 再リンクの一次キー） */
        const itemIdToActual = new Map<string, string>()
        /** `${courseworkName}:${itemName}` → 実 CourseworkItem.id（名前フォールバック） */
        const itemNameToActual = new Map<string, string>()

        if (data.courseworkArchive) {
          const cwResult = await importCourseworkData(
            tx,
            data.courseworkArchive,
            {
              allowCreate: false,
              studentMatching: "studentNumber",
              courseworkDecisions,
            }
          )
          warnings.push(...cwResult.warnings)
          for (const [archiveItemId, actualId] of cwResult.itemIdMap) {
            itemIdToActual.set(archiveItemId, actualId)
          }
          const courseworkNameById = new Map(
            data.courseworkArchive.courseworks.map((coursework) => [
              coursework.id,
              coursework.name,
            ])
          )
          for (const item of data.courseworkArchive.courseworkItems) {
            const actual = cwResult.itemIdMap.get(item.id)
            const courseworkName = courseworkNameById.get(item.courseworkId)
            if (actual && courseworkName) {
              itemNameToActual.set(`${courseworkName}:${item.name}`, actual)
            }
          }
        }

        // 4. GradeItem + DataSource作成
        for (const giData of gradeData.gradeItems) {
          const gradeItem = await tx.gradeItem.create({
            data: {
              gradeId: grade.id,
              name: giData.name,
              order: giData.order,
            },
          })
          // 作った直後に対応を控える。後段の参照解決はこれで賄い、
          // 書き込みトランザクション中に評価項目を引き直さない。
          if (giData.id) {
            gradeItemIdByArchiveId.set(giData.id, gradeItem.id)
          }
          if (gradeItemIdByName.has(giData.name)) {
            ambiguousGradeItemNames.add(giData.name)
          } else {
            gradeItemIdByName.set(giData.name, gradeItem.id)
          }

          for (const dsData of giData.dataSources) {
            // 旧アーカイブ互換: project_total → exam_total
            if (dsData.type === "project_total") {
              dsData.type = "exam_total"
            }

            // CourseworkItem 解決（uuid一次・名前二次）。
            //   旧 v1.3.0 の "manual" は transformGradeToLatest で "coursework" へ
            //   正規化済み（courseworkItemId / courseworkName / courseworkItemName を付与）。
            let courseworkItemId: string | null = null
            if (dsData.type === "coursework") {
              // アーカイブ項目uuidで一次解決
              if (dsData.courseworkItemId) {
                courseworkItemId =
                  itemIdToActual.get(dsData.courseworkItemId) ?? null
              }
              // 名前フォールバック（uuid不一致時）
              if (
                !courseworkItemId &&
                dsData.courseworkName &&
                dsData.courseworkItemName
              ) {
                courseworkItemId =
                  itemNameToActual.get(
                    `${dsData.courseworkName}:${dsData.courseworkItemName}`
                  ) ?? null
              }
              if (!courseworkItemId) {
                warnings.push(
                  `成績項目「${giData.name}」のデータソース「${dsData.name}」: 参照先の試験外成績資料が見つかりませんでした`
                )
              }
            }

            // Coursework（資料全体）解決（uuid一次・名前二次）。
            //   exam/subtotal/cropRegion と同じく import 時に直接照合する。
            let courseworkId: string | null = null
            if (dsData.type === "coursework_total") {
              if (dsData.courseworkId) {
                const byId = await tx.coursework.findUnique({
                  where: { id: dsData.courseworkId },
                  select: { id: true },
                })
                courseworkId = byId?.id ?? null
              }
              if (!courseworkId && dsData.courseworkName) {
                const byName = await tx.coursework.findFirst({
                  where: { name: dsData.courseworkName },
                  select: { id: true },
                })
                courseworkId = byName?.id ?? null
              }
              if (!courseworkId) {
                warnings.push(
                  `成績項目「${giData.name}」のデータソース「${dsData.name}」: 参照先の試験外成績資料が見つかりませんでした`
                )
              }
            }

            // 試験照合。uuid 一次（同一PC由来なら確実に当たる）→ ユーザーが
            // ウィザードで指定したマッピング → 試験名。試験名は unique でないため
            // 名前だけだと同名試験を取り違える。
            let examId: string | null = null
            if (
              dsData.type === "exam_total" ||
              dsData.type === "subtotal" ||
              dsData.type === "crop_region"
            ) {
              if (dsData.examId) {
                const byId = await tx.exam.findUnique({
                  where: { id: dsData.examId },
                  select: { id: true },
                })
                examId = byId?.id ?? null
              }
              if (!examId && dsData.examName) {
                examId = examMapping?.[dsData.examName] ?? null
              }
              if (!examId && dsData.examName) {
                const exams = await tx.exam.findMany({
                  where: { examName: dsData.examName },
                  select: { id: true },
                })
                examId = exams[0]?.id ?? null
              }
            }

            // Subtotal照合（uuid一次・名前二次）。
            // 名前フォールバックは必ず当該試験の小計グループへ絞る。小計名は
            // グループ内でしか一意でなく、絞らないと別の試験の同名小計に当たる。
            let subtotalId: string | null = null
            if (dsData.type === "subtotal" && examId) {
              if (dsData.subtotalId) {
                const byId = await tx.subtotal.findUnique({
                  where: { id: dsData.subtotalId },
                  select: { id: true },
                })
                subtotalId = byId?.id ?? null
              }
              if (!subtotalId && dsData.subtotalName) {
                const subtotals = await tx.subtotal.findMany({
                  where: {
                    name: dsData.subtotalName,
                    subtotalGroup: {
                      examSubtotalGroups: { some: { examId } },
                    },
                  },
                  select: { id: true },
                })
                subtotalId = subtotals[0]?.id ?? null
              }
            }

            // CropRegion照合（uuid一次・ラベル二次）。
            // ラベルは同一試験内でも重複しうるので一次キーにはしない。
            let cropRegionId: string | null = null
            if (dsData.type === "crop_region" && examId) {
              if (dsData.cropRegionId) {
                const byId = await tx.cropRegion.findUnique({
                  where: { id: dsData.cropRegionId },
                  select: { id: true },
                })
                cropRegionId = byId?.id ?? null
              }
              if (!cropRegionId && dsData.cropRegionLabel) {
                const regions = await tx.cropRegion.findMany({
                  where: {
                    label: dsData.cropRegionLabel,
                    examPage: { examId: examId },
                  },
                  select: { id: true },
                })
                cropRegionId = regions[0]?.id ?? null
              }
            }

            const createdDataSource = await tx.gradeDataSource.create({
              data: {
                gradeItemId: gradeItem.id,
                type: dsData.type,
                examId,
                subtotalId,
                cropRegionId,
                courseworkItemId,
                courseworkId,
                name: dsData.name,
                // v1.6.0: GradeDataSource.maxScore 列は廃止。満点はライブ算出するため挿入しない。
                weight: dsData.weight,
                order: dsData.order,
                absentMethod: dsData.absentMethod ?? "null",
                absentRatio: dsData.absentRatio ?? 1.0,
                absentOffset: dsData.absentOffset ?? 0,
                treatExpectedAsMissing: dsData.treatExpectedAsMissing ?? false,
                estimationMode: dsData.estimationMode ?? "all",
              },
            })
            // 推定の参照は全データソース作成後にまとめて張る（前方参照があるため）
            if (dsData.id) {
              dataSourceIdByArchiveId.set(dsData.id, createdDataSource.id)
            }
            if (dsData.estimationSourceIds?.length) {
              estimationLinks.push({
                dataSourceId: createdDataSource.id,
                archiveSourceIds: dsData.estimationSourceIds,
              })
            }
          }
        }

        // 4.5. 推定に使う他データソースを張る。
        //   export元idを新idへ解決できたものだけ作る。旧アーカイブ（v1.11.0未満）は
        //   データソースidを持たないため解決できず、参照は捨てて警告する
        //   （旧importerはexport元idをそのまま書き戻しており dangling になっていた）。
        for (const estimationLink of estimationLinks) {
          const resolvedSourceIds = estimationLink.archiveSourceIds
            .map((archiveSourceId) =>
              dataSourceIdByArchiveId.get(archiveSourceId)
            )
            .filter((sourceId): sourceId is string => sourceId !== undefined)
          const droppedCount =
            estimationLink.archiveSourceIds.length - resolvedSourceIds.length
          if (droppedCount > 0) {
            warnings.push(
              `欠損推定の参照${droppedCount}件を解決できなかったため取り込みませんでした。` +
                `該当データソースの推定設定を確認してください。`
            )
          }
          if (resolvedSourceIds.length === 0) continue
          await tx.gradeDataSource.update({
            where: { id: estimationLink.dataSourceId },
            data: {
              estimationSources: {
                create: buildEstimationSourceRows(
                  estimationLink.dataSourceId,
                  resolvedSourceIds
                ),
              },
            },
          })
        }

        // 5. （v1.4.0で廃止）旧 ManualScore 挿入は Coursework 復元(3.5)に統合済み

        // 6. BoundarySet/Boundary挿入
        for (const bsData of boundariesData.boundarySets) {
          // 対象は必ず評価項目（総合は v1.10.0 で撤去済み。transformer が破棄する）
          if (!bsData.gradeItemName) continue
          const gradeItemId = resolveGradeItemId(
            bsData,
            () => `成績境界セット（${bsData.gradeItemName}）`
          )
          if (gradeItemId === null) continue

          const boundarySet = await tx.gradeBoundarySet.create({
            data: { gradeId: grade.id, gradeItemId },
          })

          if (bsData.boundaries.length > 0) {
            await tx.gradeBoundary.createMany({
              data: bsData.boundaries.map((boundary) => ({
                gradeBoundarySetId: boundarySet.id,
                label: boundary.label,
                minPercentage: boundary.minPercentage,
                order: boundary.order,
              })),
            })
          }
        }

        // 7. GradeItemExclusion挿入（後方互換: optionalフィールド）
        if (
          gradeData.gradeItemExclusions &&
          gradeData.gradeItemExclusions.length > 0
        ) {
          for (const excl of gradeData.gradeItemExclusions) {
            const student = await resolveStudent(tx, excl)
            if (!student) continue

            const gradeItemId = resolveGradeItemId(
              excl,
              () => `生徒「${excl.studentNumber}」の評価項目除外`
            )
            if (gradeItemId === null) continue

            await tx.gradeItemExclusion.create({
              data: {
                gradeId: grade.id,
                studentId: student.id,
                gradeItemId,
              },
            })
          }
        }

        // 8. GradeOverride挿入（後方互換: optionalフィールド）
        if (gradeData.gradeOverrides && gradeData.gradeOverrides.length > 0) {
          for (const gradeOverride of gradeData.gradeOverrides) {
            const student = await resolveStudent(tx, gradeOverride)
            if (!student) continue

            // 対象は必ず評価項目（総合は v1.10.0 で撤去済み。transformer が破棄する）
            if (!gradeOverride.gradeItemName) continue
            const gradeItemId = resolveGradeItemId(
              gradeOverride,
              () => `生徒「${gradeOverride.studentNumber}」の成績上書き`
            )
            if (gradeItemId === null) continue

            await tx.gradeOverride.create({
              data: {
                gradeId: grade.id,
                studentId: student.id,
                gradeItemId,
                overrideLabel: gradeOverride.overrideLabel,
              },
            })
          }
        }

        // 9. GradeFrozenScore 挿入（v1.9.0+。旧アーカイブでは undefined ＝確定なし）。
        // 確定操作者は持ち出していないため frozenByUserId は付けない（＝操作者不明）。
        if (
          gradeData.gradeFrozenScores &&
          gradeData.gradeFrozenScores.length > 0
        ) {
          for (const gradeFrozenScore of gradeData.gradeFrozenScores) {
            const student = await resolveStudent(tx, gradeFrozenScore)
            if (!student) continue

            const gradeItemId = resolveGradeItemId(
              gradeFrozenScore,
              () => `生徒「${gradeFrozenScore.studentNumber}」の確定成績値`
            )
            if (gradeItemId === null) continue

            await tx.gradeFrozenScore.create({
              data: {
                gradeId: grade.id,
                studentId: student.id,
                gradeItemId,
                weightedScore: gradeFrozenScore.weightedScore,
                weightedMaxScore: gradeFrozenScore.weightedMaxScore,
                percentage: gradeFrozenScore.percentage,
                gradeLabel: gradeFrozenScore.gradeLabel,
                frozenAt: new Date(gradeFrozenScore.frozenAt),
              },
            })
          }
        }

        // 観点間の制約ルール（v1.7.0+）。
        //   比較先・集計対象は評価項目への参照なので uuid 一次・名前二次で解決する
        //   （v1.11.0 で設定JSONから昇格。issue #1063）。
        //   式（expression）だけは自由記述で項目名を含むため文字列のまま取り込む。
        if (
          gradeData.gradeConstraints &&
          gradeData.gradeConstraints.length > 0
        ) {
          for (const gradeConstraint of gradeData.gradeConstraints) {
            const targetGradeItemId = resolveGradeItemId(
              {
                gradeItemId: gradeConstraint.targetGradeItemId ?? undefined,
                gradeItemName: gradeConstraint.targetGradeItemName ?? null,
              },
              () => `制約ルール「${gradeConstraint.name}」の比較先`
            )
            const targetWasSpecified = Boolean(
              gradeConstraint.targetGradeItemId ??
              gradeConstraint.targetGradeItemName
            )

            const viewpointReferences = gradeConstraint.viewpointGradeItemIds
              ?.length
              ? gradeConstraint.viewpointGradeItemIds.map(
                  (gradeItemId, index) => ({
                    gradeItemId,
                    gradeItemName:
                      gradeConstraint.viewpointGradeItemNames?.[index] ?? null,
                  })
                )
              : (gradeConstraint.viewpointGradeItemNames ?? []).map(
                  (gradeItemName) => ({ gradeItemName })
                )
            const resolvedViewpointIds = viewpointReferences
              .map((viewpointReference) =>
                resolveGradeItemId(
                  viewpointReference,
                  () => `制約ルール「${gradeConstraint.name}」の集計対象`
                )
              )
              .filter(
                (gradeItemId): gradeItemId is string => gradeItemId !== null
              )

            // 参照を1つでも失うと判定の意味が変わる（集計対象が減れば平均が動き、
            // 空になれば「比較先以外の全項目」という別の設定に化ける）。
            // 黙って別物として動かさず、無効化して再設定を促す。
            const lostTarget = targetWasSpecified && targetGradeItemId === null
            const lostViewpoint =
              resolvedViewpointIds.length !== viewpointReferences.length
            const brokenReason = lostTarget
              ? "取り込み時に比較先の評価項目を解決できなかったため無効化しました。再設定してください。"
              : lostViewpoint
                ? "取り込み時に集計対象の観点を解決できなかったため無効化しました。再設定してください。"
                : null
            if (brokenReason) {
              warnings.push(
                `制約ルール「${gradeConstraint.name}」: ${brokenReason}`
              )
            }

            const createdConstraint = await tx.gradeConstraint.create({
              data: {
                gradeId: grade.id,
                name: gradeConstraint.name,
                kind: gradeConstraint.kind,
                targetGradeItemId,
                aggregate: gradeConstraint.aggregate ?? "average",
                tolerance: gradeConstraint.tolerance ?? 1,
                expression: gradeConstraint.expression,
                color: gradeConstraint.color,
                // 診断は disabledReason へ。message は教員が書いた違反の説明で、
                // 結果表のツールチップに出るため汚さない。
                message: gradeConstraint.message,
                disabledReason: brokenReason,
                enabled: gradeConstraint.enabled && !brokenReason,
                order: gradeConstraint.order,
              },
            })

            // 設定リレーションのidは親idから決定論的に作るため本体作成後に書く
            await writeConstraintConfig(tx, createdConstraint.id, {
              viewpointGradeItemIds: resolvedViewpointIds,
              labelValues: gradeConstraint.labelValues ?? {},
              exclusionLabels: gradeConstraint.exclusionLabels ?? [],
            })
          }
        }

        return { success: true, gradeId: grade.id }
      }
    )

    if (warnings.length > 0) {
      console.warn("Grade archive import warnings:", warnings)
    }

    // 監査ログ: 成績インポート
    await recordAuditLog({
      action: "grade.import",
      entityType: "Grade",
      entityId: result.gradeId ?? "",
      scopeId: result.gradeId ?? null,
      scopeLabel: data.gradeData.grade.name,
      target: data.gradeData.grade.name,
    })

    // 警告は呼び出し側（UI）へ返して通知する
    return { ...result, warnings: warnings.length > 0 ? warnings : undefined }
  } catch (error) {
    console.error("Error importing grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
