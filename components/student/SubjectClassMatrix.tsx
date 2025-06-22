"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  BookOpen, 
  Users, 
  Edit,
  Plus,
  Minus
} from "lucide-react"

interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    membershipType: string
    subject?: string | null
    notes?: string | null
    class: {
      id: string
      name: string
      classCode?: string | null
      subject?: string | null
      classType: string
    }
  }>
}

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  classType: string
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    membershipType: string
    subject?: string | null
    notes?: string | null
    student: {
      id: string
      studentId: string
      name: string
    }
  }>
}

interface SubjectClassMatrixProps {
  students: StudentWithMemberships[]
  classes: ClassWithMemberships[]
  onAssignStudent: (studentId: string, classId: string) => void
  onRemoveStudent: (membershipId: string) => void
  selectedGrade?: number
}

export default function SubjectClassMatrix({
  students,
  classes,
  onAssignStudent,
  onRemoveStudent,
  selectedGrade,
}: SubjectClassMatrixProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>("all")

  // 教科一覧を取得
  const subjects = Array.from(
    new Set(
      classes
        .filter(c => c.subject && c.classType === "SUBJECT")
        .map(c => c.subject!)
    )
  ).sort()

  // フィルタリングされた学級とデータ
  const filteredClasses = classes.filter(c => {
    const matchesGrade = !selectedGrade || c.grade === selectedGrade
    const matchesSubject = selectedSubject === "all" || c.subject === selectedSubject
    const isSubjectClass = c.classType === "SUBJECT"
    return matchesGrade && matchesSubject && isSubjectClass
  })

  const filteredStudents = students.filter(s => {
    if (!selectedGrade) return true
    // 学年フィルタ: ホームルームクラスの学年でフィルタ
    const homeroom = s.memberships.find(m => 
      !m.endDate && m.class.classType === "HOMEROOM"
    )
    return homeroom?.class.grade === selectedGrade
  })

  // 教科別にクラスをグループ化
  const classesBySubject = filteredClasses.reduce((acc, cls) => {
    const subject = cls.subject || "その他"
    if (!acc[subject]) {
      acc[subject] = []
    }
    acc[subject].push(cls)
    return acc
  }, {} as Record<string, ClassWithMemberships[]>)

  // 生徒の現在の教科別所属を取得
  const getStudentClassForSubject = (student: StudentWithMemberships, subject: string) => {
    return student.memberships.find(m => 
      !m.endDate && 
      m.class.classType === "SUBJECT" && 
      m.class.subject === subject
    )
  }

  // 特定の教科とクラスに所属している生徒数を取得
  const getClassMemberCount = (classId: string) => {
    const cls = classes.find(c => c.id === classId)
    return cls?.memberships.length || 0
  }

  return (
    <div className="space-y-6">
      {/* フィルタコントロール */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            教科別クラス管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <label className="text-sm font-medium">教科</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての教科</SelectItem>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSubject === "all" ? (
        // 全教科表示：教科別にセクション分け
        <div className="space-y-6">
          {Object.entries(classesBySubject).map(([subject, subjectClasses]) => (
            <Card key={subject}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {subject} 
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({subjectClasses.length}クラス)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectClasses.map(cls => (
                    <Card key={cls.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{cls.name}</h4>
                            {cls.classCode && (
                              <Badge variant="outline" className="mt-1">
                                {cls.classCode}
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary">
                            {getClassMemberCount(cls.id)}名
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {cls.memberships.slice(0, 3).map(membership => (
                            <div key={membership.id} className="text-xs flex items-center justify-between">
                              <span>{membership.student.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveStudent(membership.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {cls.memberships.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              他{cls.memberships.length - 3}名...
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // 特定教科表示：生徒×クラスのマトリックス
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSubject}クラス配属表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">生徒</TableHead>
                    <TableHead className="w-24">学籍番号</TableHead>
                    <TableHead>現在のクラス</TableHead>
                    <TableHead className="w-48">クラス変更</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => {
                    const currentMembership = getStudentClassForSubject(student, selectedSubject)
                    const subjectClasses = classesBySubject[selectedSubject] || []
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {student.studentId}
                        </TableCell>
                        <TableCell>
                          {currentMembership ? (
                            <Badge variant="default" className="flex items-center gap-1">
                              {currentMembership.class.classCode || currentMembership.class.name}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveStudent(currentMembership.id)}
                                className="h-4 w-4 p-0 ml-1"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ) : (
                            <Badge variant="outline">未配属</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={currentMembership?.class.id || ""}
                            onValueChange={(classId) => {
                              if (classId && classId !== currentMembership?.class.id) {
                                onAssignStudent(student.id, classId)
                              }
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="クラスを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">未配属</SelectItem>
                              {subjectClasses.map(cls => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.classCode ? `${cls.classCode} - ${cls.name}` : cls.name}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({getClassMemberCount(cls.id)}名)
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}