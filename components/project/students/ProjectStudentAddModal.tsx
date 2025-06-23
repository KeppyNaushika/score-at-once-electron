"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import SortableClassList from "./SortableClassList"

// 利用可能な学級の型（プロジェクトに未追加の学級）
interface AvailableClass {
  id: string
  name: string
  studentCount: number
  isSelected: boolean
  order?: number
}

// 利用可能な生徒の型
interface AvailableStudent {
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
  isSelected: boolean
}

interface ProjectStudentAddModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onStudentsAdded: () => void
}

export default function ProjectStudentAddModal({
  isOpen,
  onClose,
  projectId,
  onStudentsAdded,
}: ProjectStudentAddModalProps) {
  const [activeTab, setActiveTab] = useState("classes")
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassId, setFilterClassId] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // データの取得
  useEffect(() => {
    if (isOpen) {
      fetchAvailableData()
    }
  }, [isOpen, projectId])

  const fetchAvailableData = async () => {
    setLoading(true)
    try {
      // 利用可能な学級を取得
      const classesResult = await window.electronAPI.getClassesNotInProject(projectId)
      if (classesResult.success && classesResult.classes) {
        setAvailableClasses(
          classesResult.classes.map((cls) => ({
            ...cls,
            isSelected: false,
          }))
        )
      }

      // 利用可能な生徒を取得
      const studentsResult = await window.electronAPI.getStudentsNotInProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        setAvailableStudents(
          studentsResult.students.map((student) => ({
            ...student,
            isSelected: false,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch available data:", error)
    } finally {
      setLoading(false)
    }
  }

  // 学級選択の処理
  const handleClassSelection = (classId: string, isSelected: boolean) => {
    setAvailableClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId ? { ...cls, isSelected } : cls
      )
    )
  }

  // 学級順序の更新
  const handleClassReorder = (reorderedClasses: AvailableClass[]) => {
    setAvailableClasses(reorderedClasses)
  }

  // 生徒選択の処理
  const handleStudentSelection = (studentId: string, isSelected: boolean) => {
    setAvailableStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, isSelected } : student
      )
    )
  }

  // 学級ごとの生徒追加
  const handleAddClassStudents = async () => {
    setIsAdding(true)
    try {
      const selectedClasses = availableClasses.filter((cls) => cls.isSelected)
      
      // 選択された学級の順序で生徒を追加
      let currentOrder = 0
      
      for (const classItem of selectedClasses) {
        // 学級の全生徒を取得
        const allClasses = await window.electronAPI.fetchClasses()
        const fullClassData = allClasses.find(cls => cls.id === classItem.id)
        
        if (!fullClassData || !fullClassData.memberships) {
          console.warn(`Class ${classItem.name} has no students`)
          continue
        }

        // 学級の生徒を出席番号順にソート（現在有効なメンバーシップのみ）
        const sortedStudents = [...fullClassData.memberships]
          .filter(membership => 
            membership.student && // 生徒データが存在することを確認
            !membership.endDate   // 現在有効なメンバーシップのみ
          )
          .sort((a, b) => {
            const aNum = a.attendanceNumber || 9999
            const bNum = b.attendanceNumber || 9999
            return aNum - bNum
          })

        // 生徒IDのリストを作成
        const studentIds = sortedStudents
          .map(membership => membership.student?.id)
          .filter((id): id is string => !!id) // undefined を除外
        
        if (studentIds.length > 0) {
          // プロジェクトに生徒を追加
          const result = await window.electronAPI.addStudentsToProject(projectId, studentIds)
          if (!result.success) {
            throw new Error(result.error || `Failed to add students from class ${classItem.name}`)
          }

          // 生徒の順序を設定（学級順→出席番号順）
          const studentOrders = studentIds.map((studentId, index) => ({
            studentId,
            customOrder: currentOrder + index + 1
          }))
          
          const orderResult = await window.electronAPI.updateStudentOrders(projectId, studentOrders)
          if (!orderResult.success) {
            console.warn(`Failed to update student orders for class ${classItem.name}:`, orderResult.error)
          }
          
          currentOrder += studentIds.length
        }
      }

      onStudentsAdded()
      handleClose()
    } catch (error) {
      console.error("Failed to add class students:", error)
      alert("学級の追加に失敗しました。")
    } finally {
      setIsAdding(false)
    }
  }

  // 個別生徒の追加
  const handleAddIndividualStudents = async () => {
    setIsAdding(true)
    try {
      const selectedStudents = availableStudents.filter((student) => student.isSelected)
      const studentIds = selectedStudents.map((student) => student.id)

      const result = await window.electronAPI.addStudentsToProject(projectId, studentIds)
      if (!result.success) {
        throw new Error(result.error || "Failed to add students")
      }

      onStudentsAdded()
      handleClose()
    } catch (error) {
      console.error("Failed to add individual students:", error)
      alert("生徒の追加に失敗しました。")
    } finally {
      setIsAdding(false)
    }
  }

  // モーダルを閉じる
  const handleClose = () => {
    setAvailableClasses([])
    setAvailableStudents([])
    setSearchTerm("")
    setFilterClassId("all")
    setActiveTab("classes")
    onClose()
  }

  // フィルタリングされた生徒
  const filteredStudents = availableStudents.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm)

    const currentClassId = student.memberships?.[0]?.class.id
    const matchesClass = filterClassId === "all" || currentClassId === filterClassId

    return matchesSearch && matchesClass
  })

  const selectedClassCount = availableClasses.filter((cls) => cls.isSelected).length
  const selectedStudentCount = availableStudents.filter((student) => student.isSelected).length

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>受験生徒の追加</DialogTitle>
          <DialogDescription>
            学級単位での一括追加、または個別生徒の選択追加が可能です。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="classes">学級で追加</TabsTrigger>
              <TabsTrigger value="individuals">個別で追加</TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="mt-4 space-y-4 h-full overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                {/* 利用可能な学級一覧 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">利用可能な学級</CardTitle>
                    <CardDescription>
                      追加したい学級を選択してください
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-80 overflow-auto">
                    {loading ? (
                      <div className="text-center py-4">読み込み中...</div>
                    ) : availableClasses.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        追加可能な学級がありません
                      </div>
                    ) : (
                      availableClasses.map((classItem) => (
                        <Card key={classItem.id} className="p-3">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`class-${classItem.id}`}
                              checked={classItem.isSelected}
                              onCheckedChange={(checked) =>
                                handleClassSelection(classItem.id, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <label
                                  htmlFor={`class-${classItem.id}`}
                                  className="font-medium cursor-pointer"
                                >
                                  {classItem.name}
                                </label>
                                <Badge variant="outline">{classItem.studentCount}名</Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 追加順序設定 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">追加順序</CardTitle>
                    <CardDescription>
                      選択した学級の追加順序を設定できます
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-auto">
                    <SortableClassList
                      selectedClasses={availableClasses.filter((cls) => cls.isSelected)}
                      onReorder={handleClassReorder}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="individuals" className="mt-4 space-y-4 h-full overflow-auto">
              {/* 検索・フィルタ */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">生徒検索・フィルタ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="student-search">検索</Label>
                      <div className="relative">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                          id="student-search"
                          placeholder="名前、ふりがな、学籍番号で検索"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>学級フィルタ</Label>
                      <Select value={filterClassId} onValueChange={setFilterClassId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">すべての学級</SelectItem>
                          {availableClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 生徒一覧 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    利用可能な生徒 ({filteredStudents.length}名)
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto">
                  {loading ? (
                    <div className="text-center py-4">読み込み中...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      該当する生徒が見つかりません
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredStudents.map((student) => (
                        <Card key={student.id} className="p-3">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`student-${student.id}`}
                              checked={student.isSelected}
                              onCheckedChange={(checked) =>
                                handleStudentSelection(student.id, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <label
                                  htmlFor={`student-${student.id}`}
                                  className="cursor-pointer"
                                >
                                  <div className="font-medium">
                                    {student.lastName} {student.firstName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {student.studentId}
                                  </div>
                                </label>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    {student.memberships?.[0]?.class.name || "未所属"}
                                  </div>
                                  {student.memberships?.[0]?.attendanceNumber && (
                                    <div className="text-xs text-muted-foreground">
                                      出席番号: {student.memberships?.[0]?.attendanceNumber}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            キャンセル
          </Button>
          {activeTab === "classes" ? (
            <Button
              onClick={handleAddClassStudents}
              disabled={selectedClassCount === 0 || isAdding}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isAdding ? "追加中..." : `選択した学級を追加 (${selectedClassCount}学級)`}
            </Button>
          ) : (
            <Button
              onClick={handleAddIndividualStudents}
              disabled={selectedStudentCount === 0 || isAdding}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {isAdding ? "追加中..." : `選択した生徒を追加 (${selectedStudentCount}名)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}