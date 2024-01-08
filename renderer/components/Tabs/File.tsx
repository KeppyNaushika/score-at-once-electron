import React, { useState } from "react"
import { MdRadioButtonChecked, MdRadioButtonUnchecked } from "react-icons/md"
import { VscChevronDown, VscChevronUp, VscFile } from "react-icons/vsc"

type Field = "name" | "date"
type Sorted = "ascending" | "descending"

interface ExamSort {
  field: null | Field
  sorted: null | Sorted
}

interface Exam {
  selected: boolean
  name: string
  date: string
}
const defaultExams = [
  {
    selected: true,
    name: "テスト１",
    date: "2024 / 3 / 15",
  },
  {
    selected: false,
    name: "テスト２",
    date: "2024 / 7 / 28",
  },
]

const File = (): JSX.Element => {
  const [exams, setExams] = useState(defaultExams)
  const [examSorted, setExamSorted] = useState<ExamSort>({
    field: null,
    sorted: null,
  })

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

  return (
    <div className="flex min-w-full flex-col">
      <div className="flex py-2">
        <div className="mx-8 inline-block cursor-pointer rounded-lg bg-slate-200 px-8 py-2 shadow-md">
          試験一覧
        </div>
        <div className="inline-block cursor-pointer rounded-lg px-8 py-2 shadow-md">
          生徒名簿
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
          <div
            className="flex py-4"
            key={index}
            onClick={() => {
              clickExam(index)
            }}
          >
            <div className="flex w-20 items-center justify-center">
              {exam.selected ? (
                <MdRadioButtonChecked size={"1.5em"} />
              ) : (
                <MdRadioButtonUnchecked size={"1.5em"} />
              )}
            </div>
            <div className="border-l-2 bg-slate-200 "></div>
            <div className="w-full px-4">{exam.name}</div>
            <div className="border-l-2 bg-slate-200 "></div>
            <div className="w-80 px-4">{exam.date}</div>
          </div>
        )
      })}
    </div>
  )
}
export default File
