"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Info, Plus, UserCheck, Users, UserX } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import ProjectStudentAddModal from "./ProjectStudentAddModal"
import SortableStudentTable from "./SortableStudentTable"
import StudentRemovalConfirmModal from "./StudentRemovalConfirmModal"

// 生徒の状態を表す型
type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型（実際のデータベース構造に合わせて更新）
interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// クラスデータの型
interface ClassGroup {
  id: string
  name: string
  students: Student[]
}

export default function ProjectStudentsPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([]) // 順序付き生徒リスト
  const [classes, setClasses] = useState<ClassGroup[]>([]) // フィルタ用学級情報
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all")
  const [selectedClassId, setSelectedClassId] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemovalConfirm, setShowRemovalConfirm] = useState(false)
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([])
  const [selectedStudentsForRemoval, setSelectedStudentsForRemoval] = useState<
    Set<string>
  >(new Set())
  const [gradingDataInfo, setGradingDataInfo] = useState({
    hasData: false,
    totalItems: 0,
  })

  // 統計情報の計算（順序付き生徒リストから）
  const totalStudents = students.length
  const participatingStudents = students.filter(
    (s) => s.status === "participating",
  ).length
  const expectedStudents = students.filter(
    (s) => s.status === "expected",
  ).length
  const absentStudents = students.filter((s) => s.status === "absent").length

  // データの取得（実際のAPIから）
  useEffect(() => {
    setLoading(true)
    refreshStudentData().finally(() => setLoading(false))
  }, [projectId])

  // 生徒の状態を更新
  const updateStudentStatus = async (
    studentId: string,
    newStatus: StudentStatus,
  ) => {
    try {
      const result = await window.electronAPI.updateStudentProjectStatus(
        projectId,
        studentId,
        newStatus,
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student status")
      }

      // 受験生徒リストのステータスを更新
      setStudents((prevStudents) =>
        prevStudents.map((student) =>
          student.id === studentId
            ? { ...student, status: newStatus }
            : student,
        ),
      )
    } catch (error) {
      console.error("Failed to update student status:", error)
    }
  }

  // 生徒の並び順を更新
  const updateStudentOrders = async (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[],
  ) => {
    try {
      const result = await window.electronAPI.updateStudentOrders(
        projectId,
        studentOrders,
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student orders")
      }

      // 成功した場合、受験生徒リストのcustomOrderを更新し、再ソート
      const orderMap = new Map(
        studentOrders.map((o) => [o.studentId, o.customOrder]),
      )

      setStudents((prevStudents) => {
        const updatedStudents = prevStudents.map((student) => ({
          ...student,
          customOrder: orderMap.get(student.id) ?? student.customOrder,
        }))

        // customOrder順で再ソート
        return updatedStudents.sort((a, b) => {
          if (
            a.customOrder !== null &&
            a.customOrder !== undefined &&
            b.customOrder !== null &&
            b.customOrder !== undefined
          ) {
            return a.customOrder - b.customOrder
          }
          if (a.customOrder !== null && a.customOrder !== undefined) return -1
          if (b.customOrder !== null && b.customOrder !== undefined) return 1
          return 0
        })
      })
    } catch (error) {
      console.error("Failed to update student orders:", error)
    }
  }

  // 生徒選択の変更（SortableStudentTable用）
  const handleStudentSelectionChange = (
    studentId: string,
    isSelected: boolean,
  ) => {
    setSelectedStudentsForRemoval((prev) => {
      const newSet = new Set(prev)
      if (isSelected) {
        newSet.add(studentId)
      } else {
        newSet.delete(studentId)
      }
      return newSet
    })
  }

  // 全選択の処理（SortableStudentTable用）
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedStudentsForRemoval(new Set(filteredStudents.map((s) => s.id)))
    } else {
      setSelectedStudentsForRemoval(new Set())
    }
  }

  // 選択した生徒の削除開始
  const initiateStudentRemoval = async () => {
    if (selectedStudentsForRemoval.size === 0) return

    const studentIds = Array.from(selectedStudentsForRemoval)
    setStudentsToRemove(studentIds)

    // 採点データの存在を確認
    try {
      const gradingResult =
        await window.electronAPI.checkGradingDataForStudents(
          projectId,
          studentIds,
        )
      if (gradingResult.success) {
        setGradingDataInfo({
          hasData: gradingResult.hasAnyData || false,
          totalItems: gradingResult.totalGradingItems || 0,
        })
      } else {
        setGradingDataInfo({ hasData: false, totalItems: 0 })
      }
    } catch (error) {
      console.error("Failed to check grading data:", error)
      setGradingDataInfo({ hasData: false, totalItems: 0 })
    }

    setShowRemovalConfirm(true)
  }

  // 生徒削除の確定実行
  const confirmStudentRemoval = async () => {
    try {
      const result = await window.electronAPI.removeStudentsFromProject(
        projectId,
        studentsToRemove,
      )
      if (!result.success) {
        throw new Error(
          result.error || "Failed to remove students from project",
        )
      }

      // データを再読み込み（新しいアーキテクチャに対応）
      await refreshStudentData()

      // 状態をリセット
      setSelectedStudentsForRemoval(new Set())
      setStudentsToRemove([])
      setShowRemovalConfirm(false)
    } catch (error) {
      console.error("Failed to remove students:", error)
    }
  }

  // データの再読み込み
  const refreshStudentData = async () => {
    const studentsResult =
      await window.electronAPI.getStudentsForProject(projectId)

    if (studentsResult.success && studentsResult.students) {
      // 受験生徒をcustomOrder順で並び替え（ProjectStudentテーブルの順序が基準）
      const sortedStudents = [...studentsResult.students].sort(
        (a: any, b: any) => {
          // customOrderが設定されている場合はそれを優先
          if (
            a.customOrder !== null &&
            a.customOrder !== undefined &&
            b.customOrder !== null &&
            b.customOrder !== undefined
          ) {
            return a.customOrder - b.customOrder
          }
          if (a.customOrder !== null && a.customOrder !== undefined) return -1
          if (b.customOrder !== null && b.customOrder !== undefined) return 1

          // customOrderが未設定の場合はデフォルト順序（追加順など）
          return 0
        },
      )

      setStudents(sortedStudents)

      // フィルタ用学級リスト: 受験生徒の所属履歴から抽出（表示のみ）
      const uniqueClasses = new Map<string, { id: string; name: string }>()

      sortedStudents.forEach((student) => {
        // 各生徒の全所属履歴を確認
        student.memberships?.forEach((membership) => {
          if (!uniqueClasses.has(membership.class.id)) {
            uniqueClasses.set(membership.class.id, {
              id: membership.class.id,
              name: membership.class.name,
            })
          }
        })
      })

      // フィルタ用学級リストをセット（表示用のみ、データ構造には影響しない）
      const filterClasses: ClassGroup[] = Array.from(
        uniqueClasses.values(),
      ).map((cls) => ({
        ...cls,
        students: [], // 空配列 - フィルタ用なので実際の生徒リストは不要
      }))

      setClasses(filterClasses)
    } else {
      console.error("Failed to refresh student data:", studentsResult.error)
    }
  }

  // フィルタリングされた生徒リスト（順序を維持したまま表示用フィルタを適用）
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm)

    const matchesStatus =
      statusFilter === "all" || student.status === statusFilter

    // 学級フィルタ: 任意の所属履歴に該当学級があるかチェック
    const matchesClass =
      selectedClassId === "all" ||
      student.memberships?.some(
        (membership) => membership.class.id === selectedClassId,
      )

    return matchesSearch && matchesStatus && matchesClass
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="受験生徒の確認・選択"
        description=""
        helpButton={helpButton}
      >
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px]" align="start" side="bottom">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-semibold">受験生徒の管理</h3>
                  </div>
                  <p className="text-muted-foreground pl-7 text-sm">
                    採点対象となる生徒を選択・管理します。学級単位での一括追加や、個別の生徒追加が可能です。
                  </p>
                </div>

                <div className="space-y-3 pl-7">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    <strong>基本操作</strong>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>
                        <strong>学級単位で追加</strong>: 学級の全生徒を一括追加
                      </li>
                      <li>
                        <strong>個別追加</strong>: 特定の生徒のみを選択して追加
                      </li>
                      <li>
                        <strong>受験状態管理</strong>:
                        受験・見込・欠席の状態を設定
                      </li>
                      <li>
                        <strong>並び替え</strong>:
                        ドラッグ&ドロップで生徒の表示順を変更
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">受験状態の種類：</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-600" />
                        <span>
                          <strong>受験</strong>: 答案の採点対象
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-red-600" />
                        <span>
                          <strong>欠席</strong>: 答案なし（0点として集計）
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>
                          <strong>見込</strong>: 暫定的な登録
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                    <strong>ヒント:</strong>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>生徒の並び順は採点画面での表示順に影響します</li>
                      <li>
                        欠席者も集計には含まれるため、正確に設定してください
                      </li>
                      <li>削除時に採点データがある場合は警告が表示されます</li>
                    </ul>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={() =>
              router.push(`/projects/${projectId}/05-answer-sheets`)
            }
          >
            次へ: 答案アップロード
          </Button>
        </div>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex flex-shrink-0 items-start justify-between">
          <div className="flex gap-2">
            {selectedStudentsForRemoval.size > 0 && (
              <Button variant="destructive" onClick={initiateStudentRemoval}>
                <Users className="mr-2 h-4 w-4" />
                選択した生徒を削除 ({selectedStudentsForRemoval.size})
              </Button>
            )}
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              生徒を追加
            </Button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="mb-6 grid flex-shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                総生徒数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                受験者
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {participatingStudents}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                欠席者
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {absentStudents}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                見込受験
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {expectedStudents}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 生徒一覧テーブル */}
        <div className="flex min-h-0 flex-1 flex-col">
          <SortableStudentTable
            classes={classes}
            onStudentStatusUpdate={updateStudentStatus}
            onStudentOrderUpdate={updateStudentOrders}
            selectedStudents={selectedStudentsForRemoval}
            onStudentSelectionChange={handleStudentSelectionChange}
            onSelectAll={handleSelectAll}
            filteredStudents={filteredStudents}
            projectId={projectId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedClassId={selectedClassId}
            onClassChange={setSelectedClassId}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </div>

        {/* 追加モーダル */}
        <ProjectStudentAddModal
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          projectId={projectId}
          onStudentsAdded={refreshStudentData}
        />

        {/* 削除確認モーダル */}
        <StudentRemovalConfirmModal
          isOpen={showRemovalConfirm}
          onClose={() => {
            setShowRemovalConfirm(false)
            setStudentsToRemove([])
          }}
          onConfirm={confirmStudentRemoval}
          studentsToRemove={studentsToRemove.map((id) => {
            const student = students.find((s) => s.id === id)
            return {
              id,
              studentId: student?.studentId || "",
              lastName: student?.lastName || "",
              firstName: student?.firstName || "",
              className: student?.memberships?.[0]?.class.name || "未所属",
            }
          })}
          hasGradingData={gradingDataInfo.hasData}
          gradingDataCount={gradingDataInfo.totalItems}
        />
      </div>
    </div>
  )
}
