import React, { useRef, useState } from "react"

interface ExamInfo {
  name: string
  date: string
}
const saveStatus = ["　", "保存しています...", "保存されました"] as const
type SaveStatus = (typeof saveStatus)[number]

const Info = (): JSX.Element => {
  const [examInfo, setExamInfo] = useState<ExamInfo>({
    name: "",
    date: "",
  })
  console.log(examInfo)
  const [saveStatusState, setSaveStatusState] = useState<SaveStatus>(
    saveStatus[0],
  )
  const timeoutId = useRef<NodeJS.Timeout | null>(null)

  const changeExamInfo = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSaveStatusState(saveStatus[1])
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current)
      timeoutId.current = null
    }
    timeoutId.current = setTimeout(() => {
      setSaveStatusState(saveStatus[2])
    }, 1000)
    setExamInfo((prev) => {
      return { ...prev, [e.target.name]: e.target.value }
    })
  }

  return (
    <div className="min-w-full px-20 py-10">
      <div className="border-2 border-stone-200 px-20 py-4">
        <div className="">
          <input
            name="name"
            type="text"
            placeholder="試験名"
            onChange={changeExamInfo}
            className="w-full border-2 border-stone-200/0 px-4 py-2 transition-all duration-300 focus:border-stone-200/100 focus:outline-none"
          />
        </div>
        <div className="">
          <input
            name="date"
            type="date"
            placeholder="試験日"
            onChange={changeExamInfo}
            className="w-full border-2 border-stone-200/0 px-4 py-2 transition-all duration-300 focus:border-stone-200/100 focus:outline-none"
          />
        </div>
        <div className="mt-4 text-center text-sm">{saveStatusState}</div>
      </div>
    </div>
  )
}

export default Info
