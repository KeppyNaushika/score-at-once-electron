import React, { use, useContext, useEffect, useState } from "react"

import { MdRadioButtonChecked, MdRadioButtonUnchecked } from "react-icons/md"
import { VscChevronDown, VscChevronUp, VscFile } from "react-icons/vsc"

import { type ExamSort, type Field, type Sorted } from "./index.type"
import CreateProjectWindow from "./CreateProjectWindow"
import { type Project } from "@prisma/client"
import { ProjectContext } from "../../../components/Context/ProjectContext"

const File = (): JSX.Element => {
  // useState
  const { projects, setProjects, selectedProjectId, setSelectedProjectId } =
    useContext(ProjectContext)
  const [projectSorted, setProjectSorted] = useState<ExamSort>({
    field: "examName",
    sorted: "ascending",
  })
  const [isShowCreateProjectWindow, setIsShowCreateProjectWindow] =
    useState(false)

  // load projects
  const loadProjects = async (): Promise<void> => {
    try {
      const fetchedProjects = await window.electronAPI.fetchProjects()
      fetchedProjects?.map((project) => {
        console.log(project)
      })
      setProjects(fetchedProjects ?? [])
    } catch (error) {
      console.error("エラーが発生しました:", error)
    }
  }

  // click exam
  const clickExam = async (clickIndex: number): Promise<void> => {
    console.log(`========= ${projects[clickIndex].examName}`)
    const selectedProject = projects[clickIndex]
    if (selectedProject) {
      localStorage.setItem("selectedProjectId", selectedProject.projectId)
      console.log(`selectedProjectId: ${selectedProject.projectId}`)
      setSelectedProjectId((prev) => selectedProject.projectId)
      await loadProjects()
      console.log(`selectedProjectId: ${selectedProjectId}`)
    }
  }

  // click to sort
  const clickToSort = (field: Field): void => {
    setProjectSorted((prev) => {
      const newSorted: Sorted =
        prev.field === field && prev.sorted === "ascending"
          ? "descending"
          : "ascending"
      const newSortState = { field, sorted: newSorted }

      setProjects((prevProjects) => sortExams([...prevProjects], newSortState))
      return newSortState
    })
  }

  // sort exams
  const sortExams = (projects: Project[], sortState: ExamSort): Project[] => {
    const { field, sorted } = sortState

    if (!field) return projects

    return [...projects].sort((a, b) => {
      if (sorted === "ascending") {
        return a[field] < b[field] ? -1 : 1
      } else {
        return a[field] > b[field] ? -1 : 1
      }
    })
  }

  // useEffect
  useEffect(() => {
    loadProjects()
  }, [setProjects])

  return (
    <>
      {isShowCreateProjectWindow && (
        <CreateProjectWindow
          setIsShowCreateProjectWindow={setIsShowCreateProjectWindow}
          loadProjects={loadProjects}
        />
      )}
      <div className="flex min-w-full flex-col">
        <div className="flex px-4 py-2">
          <div className="mx-4 inline-block w-36 cursor-pointer rounded-lg bg-slate-200 px-8 py-2 text-center shadow-md">
            試験一覧
          </div>
          <div className="mx-4 inline-block w-36 cursor-pointer rounded-lg px-8 py-2 text-center shadow-md">
            生徒名簿
          </div>
          <div className="mx-4 inline-block w-36 cursor-pointer rounded-lg px-8 py-2 text-center shadow-md">
            設定
          </div>
        </div>
        <div className="flex items-center border-b-2 border-slate-200 py-1">
          <div className="flex w-20 items-center justify-center">
            <VscFile size={"1em"} />
          </div>
          <div className="h-6 border-l-2 bg-slate-200"></div>
          <div
            className="flex w-full cursor-pointer justify-between px-4"
            onClick={() => clickToSort("examName")}
          >
            <div className="text-xs">名前</div>
            <div className="text-xs">
              {projectSorted.field === "examName" &&
                (projectSorted.sorted === "ascending" ? (
                  <VscChevronUp />
                ) : (
                  <VscChevronDown />
                ))}
            </div>
          </div>
          <div className="h-6 border-l-2 bg-slate-200"></div>
          <div
            className="flex w-80 cursor-pointer justify-between px-4"
            onClick={() => clickToSort("examDate")}
          >
            <div className="text-xs">日時</div>
            <div className="text-xs">
              {projectSorted.field === "examDate" &&
                (projectSorted.sorted === "ascending" ? (
                  <VscChevronUp />
                ) : (
                  <VscChevronDown />
                ))}
            </div>
          </div>
        </div>
        {projects.map((project, index) => (
          <div className="flex py-4" key={index}>
            <div
              className="flex w-20 cursor-pointer items-center justify-center"
              onClick={() => clickExam(index)}
            >
              {project.projectId ===
              localStorage.getItem("selectedProjectId") ? (
                <MdRadioButtonChecked size={"1.5em"} />
              ) : (
                <MdRadioButtonUnchecked size={"1.5em"} />
              )}
            </div>
            <div className="border-l-2 bg-slate-200"></div>
            <div className="w-full select-text px-4">{project.examName}</div>
            <div className="border-l-2 bg-slate-200"></div>
            <div className="w-80 px-4">
              {project.examDate.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 flex min-w-full animate-float-in justify-center px-32 py-16">
        <div className="flex rounded-full bg-white shadow-md">
          <div
            className="flex w-36 cursor-pointer justify-center p-2"
            onClick={() => setIsShowCreateProjectWindow(true)}
          >
            新規作成
          </div>
          <div className="border-l-2"></div>
          <div className="flex w-36 cursor-pointer justify-center p-2">
            読み込み
          </div>
          <div className="border-l-2"></div>
          <div className="flex w-36 cursor-pointer justify-center p-2">
            編集
          </div>
          <div className="border-l-2"></div>
          <div
            className="flex w-36 cursor-pointer justify-center p-2"
            onClick={() => {
              const selectedProject = projects.find(
                (project) =>
                  project.projectId ===
                  localStorage.getItem("selectedProjectId"),
              )
              if (selectedProject) {
                window.electronAPI
                  .deleteProject(selectedProject)
                  .then(async () => {
                    await loadProjects()
                  })
              }
            }}
          >
            削除
          </div>
        </div>
      </div>
    </>
  )
}

export default File
