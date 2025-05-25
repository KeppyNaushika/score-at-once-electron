"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlusCircle, Edit, Trash2, Upload } from "lucide-react"
import { Prisma } from "@prisma/client"
import ClassModal from "./ClassModal" // Assuming ClassModal is in the same directory
import StudentImportModal from "./StudentImportModal" // Assuming StudentImportModal is in the same directory

type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>
type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>

export default function StudentManagementTable() {
  const [classes, setClasses] = useState<ClassWithStudents[]>([])
  const [students, setStudents] = useState<StudentWithClass[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassWithStudents | null>(
    null,
  )

  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<ClassWithStudents | null>(null)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] =
    useState(false)

  // TODO: Implement data fetching for classes and students using window.electronAPI
  useEffect(() => {
    // Placeholder data - replace with actual API calls
    const fetchInitialData = async () => {
      try {
        const fetchedClasses = await window.electronAPI.fetchClasses() // Example API call
        const fetchedStudents = await window.electronAPI.fetchStudents() // Example API call
        setClasses(fetchedClasses || [])
        setStudents(fetchedStudents || [])
      } catch (error) {
        console.error("Failed to fetch initial data:", error)
        // Handle error (e.g., show a notification)
      }
    }
    fetchInitialData()
  }, [])

  const handleAddNewClass = () => {
    setClassToEdit(null)
    setIsClassModalOpen(true)
  }

  const handleEditClass = (classItem: ClassWithStudents) => {
    setClassToEdit(classItem)
    setIsClassModalOpen(true)
  }

  const handleDeleteClass = async (classId: string) => {
    if (
      window.confirm(
        "本当にこの学級を削除しますか？所属する生徒がいる場合は削除できません。",
      )
    ) {
      // TODO: Implement delete logic using window.electronAPI
      // Ensure class has no students before deleting or handle appropriately
      try {
        await window.electronAPI.deleteClass(classId) // Example API call
        setClasses(classes.filter((c) => c.id !== classId))
        if (selectedClass?.id === classId) {
          setSelectedClass(null)
        }
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClass = async (
    classData: Omit<Prisma.ClassCreateInput, "id">,
  ) => {
    // TODO: Implement save (create/update) logic using window.electronAPI
    try {
      if (classToEdit) {
        const updatedClass = await window.electronAPI.updateClass({
          id: classToEdit.id,
          ...classData,
        }) // Example API call
        setClasses(
          classes.map((c) => (c.id === updatedClass.id ? updatedClass : c)),
        )
      } else {
        const newClass = await window.electronAPI.createClass(classData) // Example API call
        setClasses([...classes, newClass])
      }
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to save class:", error)
      alert("学級の保存に失敗しました。")
    }
  }

  const handleImportStudents = () => {
    setIsStudentImportModalOpen(true)
  }

  const onStudentsImported = (importedStudents: StudentWithClass[]) => {
    // Potentially refresh all students or merge intelligently
    // For simplicity, refetching all students or merging
    setStudents((prevStudents) => {
      const existingStudentIds = new Set(prevStudents.map((s) => s.id))
      const newStudents = importedStudents.filter(
        (s) => !existingStudentIds.has(s.id),
      )
      return [...prevStudents, ...newStudents]
    })
    // Also, potentially refresh classes if student counts are displayed
    // This might require re-fetching classes or updating them based on imported student data
  }

  const filteredStudents = selectedClass
    ? students.filter((student) => student.classId === selectedClass.id)
    : students

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Classes List */}
      <div className="md:col-span-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">学級一覧</h2>
          <Button onClick={handleAddNewClass} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            学級追加
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>学級名</TableHead>
                <TableHead>学年</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((classItem) => (
                <TableRow
                  key={classItem.id}
                  onClick={() => setSelectedClass(classItem)}
                  className={`cursor-pointer ${
                    selectedClass?.id === classItem.id ? "bg-muted/50" : ""
                  }`}
                >
                  <TableCell>{classItem.name}</TableCell>
                  <TableCell>{classItem.grade || "未設定"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditClass(classItem)
                      }}
                      className="mr-1"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClass(classItem.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    学級が登録されていません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Students List */}
      <div className="md:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            生徒一覧 {selectedClass ? `(${selectedClass.name})` : "(全生徒)"}
          </h2>
          <Button onClick={handleImportStudents} size="sm">
            <Upload className="mr-2 h-4 w-4" />
            生徒名簿インポート
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>学籍番号</TableHead>
                <TableHead>氏名</TableHead>
                {!selectedClass && <TableHead>学級</TableHead>}
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.studentId}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  {!selectedClass && (
                    <TableCell>{student.class?.name || "未所属"}</TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-1">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={!selectedClass ? 4 : 3}
                    className="text-center"
                  >
                    生徒が登録されていません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {isClassModalOpen && (
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classToEdit}
        />
      )}

      {isStudentImportModalOpen && (
        <StudentImportModal
          isOpen={isStudentImportModalOpen}
          onClose={() => setIsStudentImportModalOpen(false)}
          onImportSuccess={onStudentsImported}
          existingClasses={classes}
        />
      )}
    </div>
  )
}
