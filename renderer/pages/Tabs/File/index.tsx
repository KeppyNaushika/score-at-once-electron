import React, { useEffect, useState } from "react"
import { MdRadioButtonChecked, MdRadioButtonUnchecked } from "react-icons/md"
import { VscChevronDown, VscChevronUp, VscFile } from "react-icons/vsc"
import { type Exam, type ExamSort, type Field, type Sorted } from "./index.type"
import CreateProjectWindow from "./CreateProjectWindow"

const fetchExams = async (): Promise<Exam[] | null> => {
  try {
    const exams = await window.electronAPI.fetchProjects("")
    return exams ?? [] // データが null の場合に空の配列として扱う
  } catch (error) {
    // エラーハンドリング
    console.error("エラーが発生しました:", error)
    return null
  }
}

const File = (): JSX.Element => {
  const [exams, setExams] = useState<Exam[]>([])
  const [examSorted, setExamSorted] = useState<ExamSort>({
    field: null,
    sorted: null,
  })
  const [isShowCreateProjectWindow, setIsShowCreateProjectWindow] =
    useState(false)

  const clickExam = (clickIndex: number): void => {
    setExams((prev) =>
      prev.map((exam, index) => ({
        ...exam,
        selected: index === clickIndex,
      })),
    )
  }
  const clickToSort = (field: Field): void => {
    setExamSorted((prev) => {
      const newSorted: Sorted =
        prev.field === field && prev.sorted === "ascending"
          ? "descending"
          : "ascending"
      const newSortState = { field, sorted: newSorted }

      setExams(sortExams([...exams], newSortState))
      return newSortState
    })
  }
  const sortExams = (exams: Exam[], sortState: ExamSort): Exam[] => {
    const field = sortState.field
    if (field === null) return exams

    return [...exams].sort((a, b) => {
      if (sortState.sorted === "ascending") {
        return a[field] < b[field] ? -1 : 1
      } else {
        return a[field] > b[field] ? -1 : 1
      }
    })
  }

  useEffect(() => {
    fetchExams()
      .then((exams) => {
        if (exams !== null) {
          setExams(exams)
        } else {
          setExams([])
        }
      })
      .catch((err) => {
        console.log(err)
      })
  }, [])

  return (
    <>
      {isShowCreateProjectWindow && (
        <CreateProjectWindow
          setIsShowCreateProjectWindow={setIsShowCreateProjectWindow}
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
            onClick={() => {
              clickToSort("name")
            }}
          >
            <div className="text-xs">名前</div>
            <div className="text-xs">
              {examSorted.field === "name" &&
                examSorted.sorted === "ascending" && <VscChevronUp />}
              {examSorted.field === "name" &&
                examSorted.sorted === "descending" && <VscChevronDown />}
            </div>
          </div>
          <div className="h-6 border-l-2 bg-slate-200"></div>
          <div
            className="flex w-80 cursor-pointer justify-between px-4"
            onClick={() => {
              clickToSort("date")
            }}
          >
            <div className="text-xs">日時</div>
            <div className="text-xs">
              {examSorted.field === "date" &&
                examSorted.sorted === "ascending" && <VscChevronUp />}
              {examSorted.field === "date" &&
                examSorted.sorted === "descending" && <VscChevronDown />}
            </div>
          </div>
        </div>
        {exams.map((exam, index) => {
          return (
            <div className="flex py-4" key={index}>
              <div
                className="flex w-20 cursor-pointer items-center justify-center"
                onClick={() => {
                  clickExam(index)
                }}
              >
                {exam.selected ? (
                  <MdRadioButtonChecked size={"1.5em"} />
                ) : (
                  <MdRadioButtonUnchecked size={"1.5em"} />
                )}
              </div>
              <div className="border-l-2 bg-slate-200"></div>
              <div className="w-full select-text px-4">{exam.name}</div>
              <div className="border-l-2 bg-slate-200 "></div>
              <div className="w-80 px-4">{exam.date}</div>
            </div>
          )
        })}
      </div>
      <div className="absolute bottom-0 flex min-w-full animate-pop-in justify-center px-32 py-16">
        <div className="flex rounded-full bg-white shadow-md">
          <div
            className="flex w-36 cursor-pointer justify-center p-2"
            onClick={() => {
              setIsShowCreateProjectWindow(true)
            }}
          >
            新規作成
          </div>
          <div className="border-l-2"></div>
          <div className="flex w-36 cursor-pointer justify-center p-2">
            編集
          </div>
          <div className="border-l-2"></div>
          <div className="flex w-36 cursor-pointer justify-center p-2">
            削除
          </div>
        </div>
      </div>
    </>
  )
}
export default File
