"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import AdditionalActions from "@/components/projects/detail/AdditionalActions"
import ProjectHeader from "@/components/projects/detail/ProjectHeader"
import ProjectStats from "@/components/projects/detail/ProjectStats"
import WorkflowProgress from "@/components/projects/detail/WorkflowProgress"
import WorkflowSteps from "@/components/projects/detail/WorkflowSteps"
import EditProjectWindow from "@/components/projects/forms/EditProjectWindow"
import DeleteProjectModal from "@/components/projects/shared/DeleteProjectModal"
import { useProjectDetail } from "@/hooks/useProjectDetail"
import type { Project } from "@prisma/client"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const {
    project,
    isLoading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    updateProject,
  } = useProjectDetail(projectId)

  const handleProjectUpdated = async (
    updatedProjectData: Partial<
      Pick<Project, "examName" | "description" | "examDate" | "subject">
    >,
  ) => {
    const success = await updateProject(updatedProjectData)
    if (success) {
      setShowEditModal(false)
    }
  }

  const handleProjectDeleted = () => {
    router.push("/projects")
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground mt-4">読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">
              プロジェクトが見つかりません
            </h1>
            <button
              onClick={() => router.push("/")}
              className="rounded bg-blue-500 px-4 py-2 text-white"
            >
              プロジェクト一覧に戻る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>{project?.examName || "プロジェクト"} - 一括採点</title>
      </Head>
      <div className="h-full overflow-auto">
        <div className="container mx-auto p-6">
          <ProjectHeader
            project={project}
            onEdit={() => setShowEditModal(true)}
            onDelete={() => setShowDeleteModal(true)}
          />

          <ProjectStats
            masterImageCount={modelAnswerCount}
            cropRegionCount={cropRegionCount}
            questionRegionCount={questionRegionCount}
            studentCount={studentCount}
            answerSheetCount={answerSheetCount}
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <WorkflowSteps
              projectId={projectId}
              masterImageCount={modelAnswerCount}
              cropRegionCount={cropRegionCount}
              questionRegionCount={questionRegionCount}
              studentCount={studentCount}
              answerSheetCount={answerSheetCount}
            />

            <AdditionalActions
              projectId={projectId}
              masterImageCount={modelAnswerCount}
              cropRegionCount={cropRegionCount}
              questionRegionCount={questionRegionCount}
              studentCount={studentCount}
              answerSheetCount={answerSheetCount}
            />
          </div>

          <WorkflowProgress
            masterImageCount={modelAnswerCount}
            cropRegionCount={cropRegionCount}
            questionRegionCount={questionRegionCount}
            studentCount={studentCount}
            answerSheetCount={answerSheetCount}
          />

          {/* Modals */}
          {project && showEditModal && (
            <EditProjectWindow
              projectToEdit={project as any}
              setIsShowEditProjectWindow={setShowEditModal}
              onSave={handleProjectUpdated}
            />
          )}
          {project && (
            <DeleteProjectModal
              project={project}
              open={showDeleteModal}
              onOpenChange={setShowDeleteModal}
              onProjectDeleted={handleProjectDeleted}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
