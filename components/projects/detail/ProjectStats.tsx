"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Edit, FileImage, Settings, Upload, Users } from "lucide-react"

interface ProjectStatsProps {
  masterImageCount: number
  cropRegionCount: number
  questionRegionCount: number
  studentCount: number
  answerSheetCount: number
}

export default function ProjectStats({
  masterImageCount,
  cropRegionCount,
  questionRegionCount,
  studentCount,
  answerSheetCount,
}: ProjectStatsProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm">
            <FileImage className="mr-2 h-4 w-4 text-blue-500" />
            模範解答
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{masterImageCount}</div>
          <p className="text-muted-foreground text-xs">
            {masterImageCount > 0 ? "ページアップロード済み" : "未アップロード"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm">
            <Settings className="mr-2 h-4 w-4 text-green-500" />
            採点領域
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{cropRegionCount}</div>
          <p className="text-muted-foreground text-xs">
            {cropRegionCount > 0 ? "領域定義済み" : "未設定"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm">
            <Edit className="mr-2 h-4 w-4 text-indigo-500" />
            設問領域
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{questionRegionCount}</div>
          <p className="text-muted-foreground text-xs">
            {questionRegionCount > 0 ? "設問領域設定済み" : "未設定"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm">
            <Users className="mr-2 h-4 w-4 text-purple-500" />
            受験生徒
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{studentCount}</div>
          <p className="text-muted-foreground text-xs">
            {studentCount > 0 ? "名登録済み" : "未登録"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm">
            <Upload className="mr-2 h-4 w-4 text-orange-500" />
            答案
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{answerSheetCount}</div>
          <p className="text-muted-foreground text-xs">
            {answerSheetCount > 0 ? "件アップロード済み" : "未アップロード"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
