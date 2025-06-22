"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, FileImage, Upload, Settings, BarChart3 } from "lucide-react"
import { Project } from "@prisma/client"

interface DeleteProjectModalProps {
  project: Project & {
    masterImages?: any[]
    answerSheets?: any[]
    layoutRegions?: any[]
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectDeleted: () => void
}

export default function DeleteProjectModal({
  project,
  open,
  onOpenChange,
  onProjectDeleted,
}: DeleteProjectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [projectData, setProjectData] = useState<{
    masterImageCount: number
    answerSheetCount: number
    layoutRegionCount: number
  }>({
    masterImageCount: 0,
    answerSheetCount: 0,
    layoutRegionCount: 0,
  })

  useEffect(() => {
    if (project) {
      setProjectData({
        masterImageCount: project.masterImages?.length || 0,
        answerSheetCount: project.answerSheets?.length || 0,
        layoutRegionCount: project.layoutRegions?.length || 0,
      })
    }
  }, [project])

  const handleDelete = async () => {
    if (!project) return

    setIsLoading(true)

    try {
      await window.electronAPI.deleteProject(project.id)
      toast.success("プロジェクトを削除しました")
      onProjectDeleted()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to delete project:", error)
      toast.error("プロジェクトの削除に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const hasData = projectData.masterImageCount > 0 || 
                 projectData.answerSheetCount > 0 || 
                 projectData.layoutRegionCount > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            プロジェクトの削除
          </DialogTitle>
          <DialogDescription>
            以下のプロジェクトを完全に削除します。この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Information */}
          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="font-medium">{project?.examName}</h4>
            {project?.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
            <div className="flex items-center gap-2">
              {project?.subject && (
                <Badge variant="outline" className="text-xs">
                  {project.subject}
                </Badge>
              )}
              {project?.examDate && (
                <Badge variant="outline" className="text-xs">
                  {new Date(project.examDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>

          {/* Data Summary */}
          {hasData && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-muted-foreground">
                削除されるデータ
              </h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {projectData.masterImageCount > 0 && (
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-blue-500" />
                    <span>模範解答: {projectData.masterImageCount}件</span>
                  </div>
                )}
                {projectData.layoutRegionCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-green-500" />
                    <span>採点領域: {projectData.layoutRegionCount}件</span>
                  </div>
                )}
                {projectData.answerSheetCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-orange-500" />
                    <span>答案: {projectData.answerSheetCount}件</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>警告:</strong> この操作は取り消せません。
              {hasData && "関連するすべてのデータも同時に削除されます。"}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "削除中..." : "削除する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}