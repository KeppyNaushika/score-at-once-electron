"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import StudentRemovalConfirmModal from "./StudentRemovalConfirmModal"
import SortableStudentTable from "./SortableStudentTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, UserCheck, Users, UserX, Info } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import ProjectStudentAddModal from "./ProjectStudentAddModal"

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
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all")
  const [selectedClassId, setSelectedClassId] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemovalConfirm, setShowRemovalConfirm] = useState(false)
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([])
  const [selectedStudentsForRemoval, setSelectedStudentsForRemoval] = useState<Set<string>>(new Set())
  const [gradingDataInfo, setGradingDataInfo] = useState({
    hasData: false,
    totalItems: 0,
  })

  // 統計情報の計算
  const totalStudents = classes.reduce((sum, cls) => sum + cls.students.length, 0)
  const participatingStudents = classes.reduce(
    (sum, cls) => sum + cls.students.filter((s) => s.status === "participating").length,
    0,
  )
  const expectedStudents = classes.reduce(
    (sum, cls) => sum + cls.students.filter((s) => s.status === "expected").length,
    0,
  )
  const absentStudents = classes.reduce(
    (sum, cls) => sum + cls.students.filter((s) => s.status === "absent").length,
    0,
  )

  // データの取得（実際のAPIから）
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true)
      try {
        // プロジェクト情報を取得（必要に応じて後で使用）
        await window.electronAPI.fetchProjectById(projectId)

        // プロジェクトの生徒データを取得
        const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
        if (!studentsResult.success) {
          throw new Error(studentsResult.error || "Failed to fetch students")
        }

        const projectStudents = studentsResult.students || []

        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        projectStudents.forEach((student) => {
          const currentMembership = student.memberships?.[0] // 最新の所属
          if (currentMembership) {
            const classId = currentMembership.class.id
            const className = currentMembership.class.name

            if (!classGroups.has(classId)) {
              classGroups.set(classId, {
                id: classId,
                name: className,
                students: [],
              })
            }

            classGroups.get(classId)!.students.push(student)
          }
        })

        // Sort students within each class by attendance number
        classGroups.forEach((group) => {
          group.students.sort((a, b) => {
            const aNumber = a.memberships?.[0]?.attendanceNumber
            const bNumber = b.memberships?.[0]?.attendanceNumber
            
            if (aNumber && bNumber) {
              return aNumber - bNumber
            }
            if (aNumber) return -1
            if (bNumber) return 1
            
            // If no attendance numbers, sort by name
            const aName = `${a.lastName}${a.firstName}`
            const bName = `${b.lastName}${b.firstName}`
            return aName.localeCompare(bName)
          })
        })
        
        const classes = Array.from(classGroups.values())
        setClasses(classes)
      } catch (error) {
        console.error("生徒データの取得に失敗しました:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [projectId])

  // 生徒の状態を更新
  const updateStudentStatus = async (studentId: string, newStatus: StudentStatus) => {
    try {
      const result = await window.electronAPI.updateStudentProjectStatus(
        projectId,
        studentId,
        newStatus,
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student status")
      }

      setClasses((prevClasses) =>
        prevClasses.map((cls) => ({
          ...cls,
          students: cls.students.map((student) =>
            student.id === studentId ? { ...student, status: newStatus } : student,
          ),
        })),
      )
    } catch (error) {
      console.error("Failed to update student status:", error)
    }
  }

  // 生徒の並び順を更新
  const updateStudentOrders = async (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    try {
      const result = await window.electronAPI.updateStudentOrders(projectId, studentOrders)
      if (!result.success) {
        throw new Error(result.error || "Failed to update student orders")
      }

      // 成功した場合、ローカルの状態を更新
      const orderMap = new Map(studentOrders.map(o => [o.studentId, o.customOrder]))
      
      setClasses((prevClasses) =>
        prevClasses.map((cls) => ({
          ...cls,
          students: cls.students.map((student) => ({
            ...student,
            customOrder: orderMap.get(student.id) ?? student.customOrder,
          })),
        })),
      )
    } catch (error) {
      console.error("Failed to update student orders:", error)
    }
  }

  // 生徒選択の変更（SortableStudentTable用）
  const handleStudentSelectionChange = (studentId: string, isSelected: boolean) => {
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
      setSelectedStudentsForRemoval(new Set(filteredStudents.map(s => s.id)))
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
      const gradingResult = await window.electronAPI.checkGradingDataForStudents(
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
        throw new Error(result.error || "Failed to remove students from project")
      }

      // 画面を再読み込み
      const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        studentsResult.students.forEach((student) => {
          const currentMembership = student.memberships?.[0]
          if (currentMembership) {
            const classId = currentMembership.class.id
            const className = currentMembership.class.name

            if (!classGroups.has(classId)) {
              classGroups.set(classId, {
                id: classId,
                name: className,
                students: [],
              })
            }

            classGroups.get(classId)!.students.push(student)
          }
        })

        setClasses(Array.from(classGroups.values()))
      }

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
    const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
    if (studentsResult.success && studentsResult.students) {
      const classGroups = new Map<string, ClassGroup>()

      studentsResult.students.forEach((student) => {
        const currentMembership = student.memberships?.[0]
        if (currentMembership) {
          const classId = currentMembership.class.id
          const className = currentMembership.class.name

          if (!classGroups.has(classId)) {
            classGroups.set(classId, {
              id: classId,
              name: className,
              students: [],
            })
          }

          classGroups.get(classId)!.students.push(student)
        }
      })

      setClasses(Array.from(classGroups.values()))
    }
  }

  // フィルタリングされた生徒リスト
  const filteredStudents = classes.flatMap((cls) =>
    cls.students.filter((student) => {
      const fullName = `${student.lastName} ${student.firstName}`
      const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.includes(searchTerm)

      const matchesStatus = statusFilter === "all" || student.status === statusFilter
      const currentClassId = student.memberships?.[0]?.class.id
      const matchesClass = selectedClassId === "all" || currentClassId === selectedClassId

      return matchesSearch && matchesStatus && matchesClass
    }),
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="受験生徒の確認・選択" description="">
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
                    <h3 className="font-semibold text-base">受験生徒の管理</h3>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7">
                    採点対象となる生徒を選択・管理します。学級単位での一括追加や、個別の生徒追加が可能です。
                  </p>
                </div>

                <div className="space-y-3 pl-7">
                  <div className="border rounded-lg p-3 text-sm bg-blue-50 border-blue-200 text-blue-800">
                    <strong>基本操作</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li><strong>学級単位で追加</strong>: 学級の全生徒を一括追加</li>
                      <li><strong>個別追加</strong>: 特定の生徒のみを選択して追加</li>
                      <li><strong>受験状態管理</strong>: 受験・見込・欠席の状態を設定</li>
                      <li><strong>並び替え</strong>: ドラッグ&ドロップで生徒の表示順を変更</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-sm">受験状態の種類：</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-600" />
                        <span><strong>受験</strong>: 答案の採点対象</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-red-600" />
                        <span><strong>欠席</strong>: 答案なし（0点として集計）</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span><strong>見込</strong>: 暫定的な登録</span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-3 text-sm bg-orange-50 border-orange-200 text-orange-800">
                    <strong>ヒント:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>生徒の並び順は採点画面での表示順に影響します</li>
                      <li>欠席者も集計には含まれるため、正確に設定してください</li>
                      <li>削除時に採点データがある場合は警告が表示されます</li>
                    </ul>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={() => router.push(`/projects/${projectId}/05-answer-sheets`)}>
            次へ: 答案アップロード
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 space-y-6 overflow-hidden p-6">
        {/* ヘッダー */}
        <div className="flex items-start justify-between">
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

        {/* フィルター */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">フィルター・検索</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">検索</Label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                  <Input
                    id="search"
                    placeholder="名前、ふりがな、学籍番号で検索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>学級</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての学級</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>受験状態</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as StudentStatus | "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="participating">受験</SelectItem>
                    <SelectItem value="expected">見込</SelectItem>
                    <SelectItem value="absent">欠席</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 生徒一覧テーブル */}
        <SortableStudentTable
          classes={classes}
          onStudentStatusUpdate={updateStudentStatus}
          onStudentOrderUpdate={updateStudentOrders}
          selectedStudents={selectedStudentsForRemoval}
          onStudentSelectionChange={handleStudentSelectionChange}
          onSelectAll={handleSelectAll}
          filteredStudents={filteredStudents}
          projectId={projectId}
        />

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
            const student = classes
              .flatMap((c) => c.students)
              .find((s) => s.id === id)
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