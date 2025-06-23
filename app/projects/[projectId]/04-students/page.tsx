"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import StudentRemovalConfirmModal from "@/components/student/StudentRemovalConfirmModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, UserCheck, UserPlus, Users, UserX } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

// 生徒の状態を表す型
type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型（実際のデータベース構造に合わせて更新）
interface Student {
  id: string
  studentId: string // データベースの学籍番号フィールド
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number
  memberships: {
    id: string
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
}

// クラスデータの型
interface ClassGroup {
  id: string
  name: string
  students: Student[]
}

// 利用可能な学級の型（プロジェクトに未追加の学級）
interface AvailableClass {
  id: string
  name: string
  studentCount: number
  isSelected: boolean
}

// 新規生徒の型
interface NewStudent {
  studentNumber: string
  name: string
  furigana: string
  classId: string
}

export default function StudentsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all")
  const [selectedClassId, setSelectedClassId] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [newStudent, setNewStudent] = useState<NewStudent>({
    studentNumber: "",
    name: "",
    furigana: "",
    classId: "",
  })
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([])
  const [showRemovalConfirm, setShowRemovalConfirm] = useState(false)
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([])
  const [selectedStudentsForRemoval, setSelectedStudentsForRemoval] = useState<
    Set<string>
  >(new Set())
  const [gradingDataInfo, setGradingDataInfo] = useState({
    hasData: false,
    totalItems: 0,
  })
  const [project, setProject] = useState<any>(null)

  // 統計情報の計算
  const totalStudents = classes.reduce(
    (sum, cls) => sum + cls.students.length,
    0,
  )
  const participatingStudents = classes.reduce(
    (sum, cls) =>
      sum + cls.students.filter((s) => s.status === "participating").length,
    0,
  )
  const expectedStudents = classes.reduce(
    (sum, cls) =>
      sum + cls.students.filter((s) => s.status === "expected").length,
    0,
  )
  const absentStudents = classes.reduce(
    (sum, cls) =>
      sum + cls.students.filter((s) => s.status === "absent").length,
    0,
  )

  // データの取得（実際のAPIから）
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true)
      try {
        // プロジェクト情報を取得
        const fetchedProject =
          await window.electronAPI.fetchProjectById(projectId)
        setProject(fetchedProject)

        // プロジェクトの生徒データを取得
        const studentsResult =
          await window.electronAPI.getStudentsForProject(projectId)
        if (!studentsResult.success) {
          throw new Error(studentsResult.error || "Failed to fetch students")
        }

        // 利用可能な学級データを取得
        const classesResult =
          await window.electronAPI.getClassesNotInProject(projectId)
        if (!classesResult.success) {
          throw new Error(
            classesResult.error || "Failed to fetch available classes",
          )
        }

        // 全学級データを取得（新規生徒追加用）
        const allClassesResult = await window.electronAPI.fetchClasses()

        const projectStudents = studentsResult.students || []
        const availableClassesData = classesResult.classes || []

        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        projectStudents.forEach((student) => {
          const currentMembership = student.memberships[0] // 最新の所属
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

        const classes = Array.from(classGroups.values())

        // 利用可能な学級を設定
        const availableClasses = availableClassesData.map((cls) => ({
          id: cls.id,
          name: cls.name,
          studentCount: cls.studentCount,
          isSelected: false,
        }))

        setClasses(classes)
        setAllClasses(allClassesResult)
        setAvailableClasses(availableClasses)
      } catch (error) {
        console.error("生徒データの取得に失敗しました:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
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

      setClasses((prevClasses) =>
        prevClasses.map((cls) => ({
          ...cls,
          students: cls.students.map((student) =>
            student.id === studentId
              ? { ...student, status: newStatus }
              : student,
          ),
        })),
      )
    } catch (error) {
      console.error("Failed to update student status:", error)
    }
  }

  // 学級のチェック状態を更新
  const toggleClassSelection = (classId: string) => {
    setAvailableClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId ? { ...cls, isSelected: !cls.isSelected } : cls,
      ),
    )
  }

  // 選択された学級を追加
  const addSelectedClasses = async () => {
    try {
      const selectedClasses = availableClasses.filter((cls) => cls.isSelected)
      const fullClasses = selectedClasses.map(
        (cls) => allClasses.find((c) => c.id === cls.id)!,
      )

      // 選択された学級の全生徒IDを取得
      const studentIds: string[] = []
      fullClasses.forEach((cls) => {
        cls.memberships.forEach((membership) => {
          studentIds.push(membership.student.id)
        })
      })

      // プロジェクトに生徒を追加
      const result = await window.electronAPI.addStudentsToProject(
        projectId,
        studentIds,
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to add students to project")
      }

      // 画面を再読み込み
      const studentsResult =
        await window.electronAPI.getStudentsForProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        studentsResult.students.forEach((student) => {
          const currentMembership = student.memberships[0]
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

      // 利用可能な学級を更新
      const classesResult =
        await window.electronAPI.getClassesNotInProject(projectId)
      if (classesResult.success) {
        const availableClasses = (classesResult.classes || []).map((cls) => ({
          id: cls.id,
          name: cls.name,
          studentCount: cls.studentCount,
          isSelected: false,
        }))
        setAvailableClasses(availableClasses)
      }

      setShowAddDialog(false)
    } catch (error) {
      console.error("Failed to add selected classes:", error)
    }
  }

  // 生徒選択のトグル
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentsForRemoval((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
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

      // 画面を再読み込み
      const studentsResult =
        await window.electronAPI.getStudentsForProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        studentsResult.students.forEach((student) => {
          const currentMembership = student.memberships[0]
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

      // 利用可能な学級を更新
      const classesResult =
        await window.electronAPI.getClassesNotInProject(projectId)
      if (classesResult.success) {
        const availableClasses = (classesResult.classes || []).map((cls) => ({
          id: cls.id,
          name: cls.name,
          studentCount: cls.studentCount,
          isSelected: false,
        }))
        setAvailableClasses(availableClasses)
      }

      // 状態をリセット
      setSelectedStudentsForRemoval(new Set())
      setStudentsToRemove([])
      setShowRemovalConfirm(false)
    } catch (error) {
      console.error("Failed to remove students:", error)
    }
  }

  // 個別生徒を追加
  const addIndividualStudent = async () => {
    if (
      !newStudent.studentNumber ||
      !newStudent.name ||
      !newStudent.furigana ||
      !newStudent.classId
    ) {
      return
    }

    try {
      // 名前を姓名に分ける（簡単な実装）
      const names = newStudent.name.split(" ")
      const lastName = names[0] || newStudent.name
      const firstName = names[1] || ""

      const furiganaNames = newStudent.furigana.split(" ")
      const lastNameKana = furiganaNames[0] || newStudent.furigana
      const firstNameKana = furiganaNames[1] || ""

      // 新しい生徒を作成
      const createResult = await window.electronAPI.createStudent({
        studentId: newStudent.studentNumber,
        lastName,
        firstName,
        lastNameKana,
        firstNameKana,
      })

      // 学級に追加
      await window.electronAPI.addStudentToClass(
        createResult.id,
        newStudent.classId,
      )

      // プロジェクトに追加
      const addResult = await window.electronAPI.addStudentsToProject(
        projectId,
        [createResult.id],
      )
      if (!addResult.success) {
        throw new Error(addResult.error || "Failed to add student to project")
      }

      // 画面を再読み込み
      const studentsResult =
        await window.electronAPI.getStudentsForProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        // 学級ごとにグループ化
        const classGroups = new Map<string, ClassGroup>()

        studentsResult.students.forEach((student) => {
          const currentMembership = student.memberships[0]
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

      // フォームをリセット
      setNewStudent({ studentNumber: "", name: "", furigana: "", classId: "" })
      setShowAddDialog(false)
    } catch (error) {
      console.error("Failed to add individual student:", error)
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

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter
      const currentClassId = student.memberships[0]?.class.id
      const matchesClass =
        selectedClassId === "all" || currentClassId === selectedClassId

      return matchesSearch && matchesStatus && matchesClass
    }),
  )

  // 状態のラベルとスタイル
  const getStatusConfig = (status: StudentStatus) => {
    switch (status) {
      case "participating":
        return { label: "受験", variant: "default" as const, icon: UserCheck }
      case "expected":
        return { label: "見込", variant: "secondary" as const, icon: Users }
      case "absent":
        return { label: "欠席", variant: "destructive" as const, icon: UserX }
    }
  }

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
        title="受験生徒"
        description="このプロジェクトで採点する生徒を確認し、受験状態を設定してください。"
        projectName={project?.examName}
      >
        <Button
          onClick={() => router.push(`/projects/${projectId}/05-answer-sheets`)}
        >
          次へ: 答案アップロード
        </Button>
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
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  生徒を追加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>受験生徒の追加</DialogTitle>
                  <DialogDescription>
                    学級単位での一括追加、または個別の生徒追加ができます。
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="class" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="class">学級単位で追加</TabsTrigger>
                    <TabsTrigger value="individual">個別に追加</TabsTrigger>
                  </TabsList>

                  <TabsContent value="class" className="space-y-4">
                    <div>
                      <h4 className="mb-3 font-medium">追加可能な学級</h4>
                      <p className="text-muted-foreground mb-4 text-sm">
                        チェックボックスで選択した学級の全生徒をプロジェクトに追加します。
                      </p>

                      {availableClasses.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center">
                          追加可能な学級がありません。
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {availableClasses.map((cls) => (
                            <Card key={cls.id} className="p-4">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`class-${cls.id}`}
                                  checked={cls.isSelected}
                                  onCheckedChange={() =>
                                    toggleClassSelection(cls.id)
                                  }
                                />
                                <Label
                                  htmlFor={`class-${cls.id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                      {cls.name}
                                    </span>
                                    <Badge variant="outline">
                                      {cls.studentCount}名
                                    </Badge>
                                  </div>
                                </Label>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddDialog(false)}
                      >
                        キャンセル
                      </Button>
                      <Button
                        onClick={addSelectedClasses}
                        disabled={!availableClasses.some((c) => c.isSelected)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        選択した学級を追加
                      </Button>
                    </DialogFooter>
                  </TabsContent>

                  <TabsContent value="individual" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="studentNumber">学籍番号</Label>
                        <Input
                          id="studentNumber"
                          placeholder="001"
                          value={newStudent.studentNumber}
                          onChange={(e) =>
                            setNewStudent((prev) => ({
                              ...prev,
                              studentNumber: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="className">学級</Label>
                        <Select
                          value={newStudent.classId}
                          onValueChange={(value) =>
                            setNewStudent((prev) => ({
                              ...prev,
                              classId: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="学級を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {allClasses.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="studentName">氏名</Label>
                        <Input
                          id="studentName"
                          placeholder="田中太郎"
                          value={newStudent.name}
                          onChange={(e) =>
                            setNewStudent((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="furigana">ふりがな</Label>
                        <Input
                          id="furigana"
                          placeholder="たなかたろう"
                          value={newStudent.furigana}
                          onChange={(e) =>
                            setNewStudent((prev) => ({
                              ...prev,
                              furigana: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddDialog(false)}
                      >
                        キャンセル
                      </Button>
                      <Button
                        onClick={addIndividualStudent}
                        disabled={
                          !newStudent.studentNumber ||
                          !newStudent.name ||
                          !newStudent.furigana ||
                          !newStudent.classId
                        }
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        生徒を追加
                      </Button>
                    </DialogFooter>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
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
                <Select
                  value={selectedClassId}
                  onValueChange={setSelectedClassId}
                >
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
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg">生徒一覧</CardTitle>
            <CardDescription>
              {filteredStudents.length}名の生徒が表示されています
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          filteredStudents.length > 0 &&
                          filteredStudents.every((s) =>
                            selectedStudentsForRemoval.has(s.id),
                          )
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStudentsForRemoval(
                              new Set(filteredStudents.map((s) => s.id)),
                            )
                          } else {
                            setSelectedStudentsForRemoval(new Set())
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-[100px]">学籍番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>ふりがな</TableHead>
                    <TableHead>学級</TableHead>
                    <TableHead>受験状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const statusConfig = getStatusConfig(student.status)
                    const StatusIcon = statusConfig.icon

                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudentsForRemoval.has(student.id)}
                            onCheckedChange={() =>
                              toggleStudentSelection(student.id)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono">
                          {student.studentId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.lastName} {student.firstName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.lastNameKana} {student.firstNameKana}
                        </TableCell>
                        <TableCell>
                          {student.memberships[0]?.class.name || "未所属"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusConfig.variant}
                            className="gap-1"
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant={
                                student.status === "participating"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                updateStudentStatus(student.id, "participating")
                              }
                            >
                              受験
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                student.status === "expected"
                                  ? "secondary"
                                  : "outline"
                              }
                              onClick={() =>
                                updateStudentStatus(student.id, "expected")
                              }
                            >
                              見込
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                student.status === "absent"
                                  ? "destructive"
                                  : "outline"
                              }
                              onClick={() =>
                                updateStudentStatus(student.id, "absent")
                              }
                            >
                              欠席
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

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
              className: student?.memberships[0]?.class.name || "未所属",
            }
          })}
          hasGradingData={gradingDataInfo.hasData}
          gradingDataCount={gradingDataInfo.totalItems}
        />
      </div>
    </div>
  )
}
