"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart3,
  ChevronRight,
  Edit,
  FileImage,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"

interface WorkflowStepsProps {
  projectId: string
  masterImageCount: number
  layoutRegionCount: number
  questionRegionCount: number
  studentCount: number
  answerSheetCount: number
}

export default function WorkflowSteps({
  projectId,
  masterImageCount,
  layoutRegionCount,
  questionRegionCount,
  studentCount,
  answerSheetCount,
}: WorkflowStepsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>セットアップワークフロー</CardTitle>
        <CardDescription>採点準備のための6段階のステップ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step 1: 模範解答アップロード */}
        <Link href={`/projects/${projectId}/01-upload`}>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center">
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                1
              </span>
              <FileImage className="mr-2 h-4 w-4" />
              模範解答アップロード
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Step 2: 採点領域作成 */}
        <Link href={`/projects/${projectId}/02-template`}>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={masterImageCount === 0}
          >
            <span className={`flex items-center ${masterImageCount === 0 ? 'opacity-50' : ''}`}>
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                2
              </span>
              <Settings className="mr-2 h-4 w-4" />
              採点領域作成
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Step 3: 領域情報編集 */}
        <Link href={`/projects/${projectId}/03-region-info`}>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={layoutRegionCount === 0}
          >
            <span className={`flex items-center ${layoutRegionCount === 0 ? 'opacity-50' : ''}`}>
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                3
              </span>
              <Edit className="mr-2 h-4 w-4" />
              領域情報編集
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Step 4: 受験生徒管理 */}
        <Link href={`/projects/${projectId}/04-students`}>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={questionRegionCount === 0}
          >
            <span className={`flex items-center ${questionRegionCount === 0 ? 'opacity-50' : ''}`}>
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-600">
                4
              </span>
              <Users className="mr-2 h-4 w-4" />
              受験生徒管理
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Step 5: 答案アップロード */}
        <Link href={`/projects/${projectId}/05-answer-sheets`}>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={studentCount === 0}
          >
            <span className={`flex items-center ${studentCount === 0 ? 'opacity-50' : ''}`}>
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-600">
                5
              </span>
              <Upload className="mr-2 h-4 w-4" />
              答案アップロード
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Step 6: 採点実行 */}
        <Link href={`/projects/${projectId}/06-score-at-once`}>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={answerSheetCount === 0 || questionRegionCount === 0}
          >
            <span className={`flex items-center ${answerSheetCount === 0 || questionRegionCount === 0 ? 'opacity-50' : ''}`}>
              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                6
              </span>
              <BarChart3 className="mr-2 h-4 w-4" />
              採点実行
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}