"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BookOpen, Edit, Info, PlusCircle, Search, Trash2, Users, GraduationCap, Calendar } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import ClassModal from "../student/ClassModal"

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  isVisible?: boolean
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    subject?: string | null
    notes?: string | null
    attendanceNumber?: number | null
    student: {
      id: string
      studentId: string
      lastName: string
      firstName: string
      lastNameKana: string
      firstNameKana: string
    }
  }>
}

export default function ClassManagementTable() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<ClassWithMemberships | null>(null)

  // Data fetching
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const fetchedClasses = await window.electronAPI.fetchClasses()
        setClasses(fetchedClasses || [])
      } catch (error) {
        console.error("Failed to fetch classes:", error)
      }
    }
    fetchClasses()
  }, [])

  // Filter classes - always sort by name
  const filteredClasses = classes
    .filter((classItem) => {
      const matchesSearch = classItem.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      const isVisible = classItem.isVisible !== false
      return matchesSearch && isVisible
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Event handlers
  const handleAddNewClass = () => {
    setClassToEdit(null)
    setIsClassModalOpen(true)
  }

  const handleEditClass = (classItem: ClassWithMemberships) => {
    setClassToEdit(classItem)
    setIsClassModalOpen(true)
  }

  const handleDeleteClass = async (classId: string) => {
    if (window.confirm("本当にこの学級を削除しますか？")) {
      try {
        await window.electronAPI.deleteClass(classId)
        setClasses(classes.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClass = async (classData: any) => {
    try {
      if (classToEdit) {
        const updatedClass = await window.electronAPI.updateClass({
          id: classToEdit.id,
          ...classData,
        })
        setClasses(
          classes.map((c) => (c.id === updatedClass.id ? updatedClass : c))
        )
      } else {
        const newClass = await window.electronAPI.createClass(classData)
        setClasses([...classes, newClass])
      }
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to save class:", error)
      alert("学級の保存に失敗しました。")
    }
  }

  // Sort students by attendance number within each class
  const getClassWithSortedStudents = (classItem: ClassWithMemberships) => {
    const sortedMemberships = [...classItem.memberships]
      .sort((a, b) => {
        if (a.attendanceNumber && b.attendanceNumber) {
          return a.attendanceNumber - b.attendanceNumber
        }
        if (a.attendanceNumber) return -1
        if (b.attendanceNumber) return 1
        return 0
      })
    return { ...classItem, memberships: sortedMemberships }
  }

  return (
    <div className="space-y-6">
      {/* Header with Help */}
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-3xl font-bold">学級管理</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[450px]"
            align="start"
            side="bottom"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-base">学級管理について</h3>
                </div>
                <p className="text-sm text-muted-foreground pl-7">
                  学級やクラスの情報を管理し、生徒を組織化します。
                </p>
              </div>

              <div className="space-y-3 pl-7">
                <div className="border rounded-lg p-3 text-sm bg-purple-50 border-purple-200 text-purple-800">
                  <strong>柔軟な学級設計</strong><br />
                  様々なタイプの学級を作成できます：
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>ホームルーム（例：1年A組）</li>
                    <li>習熟度別クラス（例：英語E1）</li>
                    <li>特別活動クラブ（例：吹奏楽部）</li>
                    <li>選択授業（例：物理選択）</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-sm">管理項目：</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>所属生徒数</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <span>所属期間</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-orange-600" />
                      <span>学級コード</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-purple-600" />
                      <span>説明・備考</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3 text-sm bg-blue-50 border-blue-200 text-blue-800">
                  <strong>便利な機能:</strong> 生徒は複数の学級に所属可能で、
                  所属期間も管理できるため、年度途中のクラス変更にも対応します。
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            検索
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="search">学級名で検索</Label>
            <Input
              id="search"
              placeholder="学級名で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Classes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              学級一覧 ({filteredClasses.length}学級)
            </CardTitle>
            <Button onClick={handleAddNewClass} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              学級追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学級名・コード</TableHead>
                  <TableHead>学年</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>現在の所属数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((classItem) => {
                  const sortedClass = getClassWithSortedStudents(classItem)
                  return (
                    <TableRow
                      key={classItem.id}
                      onClick={() => router.push(`/classes/${classItem.id}`)}
                      className="hover:bg-muted/50 cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{classItem.name}</span>
                          {classItem.classCode && (
                            <Badge variant="outline" className="text-xs">
                              {classItem.classCode}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{classItem.grade || "未設定"}</TableCell>
                      <TableCell>
                        {classItem.description ? (
                          <span className="text-sm">{classItem.description}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            なし
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{sortedClass.memberships.length}名</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditClass(classItem)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClass(classItem.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredClasses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      該当する学級が見つかりません。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {isClassModalOpen && (
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classToEdit}
        />
      )}
    </div>
  )
}