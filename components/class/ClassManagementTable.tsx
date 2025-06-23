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
import { BookOpen, Edit, PlusCircle, Search, Trash2 } from "lucide-react"
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
      .filter(m => !m.endDate) // Only current memberships
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