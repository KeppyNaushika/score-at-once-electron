import { MdDeleteOutline, MdLoop } from "react-icons/md"
import Image from "next/image"
import React, { useRef, useState } from "react"
import DialogRemoveModelSheet from "../info/DialogRemoveModelSheet"
import DialogReplaceModelSheet from "../info/DialogReplaceModelSheet"
import AddModelSheet from "../info/AddModelSheets"

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

  const [modelSheets, setModelSheets] = useState<string[]>([])
  const [dialogRemoveModelSheet, setDialogRemoveModelSheet] = useState<
    number | null
  >(null)
  const [dialogReplaceModelSheet, setDialogReplaceModelSheet] = useState<
    number | null
  >(null)

  return (
    <>
      <DialogRemoveModelSheet
        modelSheets={modelSheets}
        setModelSheets={setModelSheets}
        dialogRemoveModelSheet={dialogRemoveModelSheet}
        setDialogRemoveModelSheet={setDialogRemoveModelSheet}
      />
      <DialogReplaceModelSheet
        modelSheets={modelSheets}
        setModelSheets={setModelSheets}
        dialogReplaceModelSheet={dialogReplaceModelSheet}
        setDialogReplaceModelSheet={setDialogReplaceModelSheet}
      />
      <div className="min-w-full px-20 py-10">
        <div className="border-2 border-stone-200 px-20 py-10">
          <div className="my-2 flex items-center">
            <div className="flex w-full border-b-2 border-black">
              <div className="flex w-24 items-center justify-center">
                試験名
              </div>
              <input
                name="name"
                type="text"
                placeholder="試験名"
                onChange={changeExamInfo}
                className="w-full border-2 border-stone-200/0 p-4 transition-all duration-300 placeholder:text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="my-2">
            <div className="w-24 py-2">模範解答画像</div>
            <div className="flex w-full flex-wrap border-2 border-gray-200 pl-2 pt-2">
              {modelSheets.map((thumbnail, index) => (
                <div className="flex flex-col items-center" key={index}>
                  <div className="relative mb-2 mr-2 h-40 w-28">
                    <Image
                      className="absolute border-2 border-gray-200 object-contain"
                      src={thumbnail}
                      alt={`thumbnail-${index}`}
                      fill={true}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <div
                        onClick={() => {
                          setDialogReplaceModelSheet(index)
                        }}
                      >
                        <MdLoop size="1.5em" />
                      </div>
                      <div
                        onClick={() => {
                          setDialogRemoveModelSheet(index)
                        }}
                      >
                        <MdDeleteOutline size="1.5em" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <AddModelSheet setModelSheets={setModelSheets} />
            </div>
          </div>
          <div className="mt-4 text-center text-sm">{saveStatusState}</div>
        </div>
      </div>
    </>
  )
}

export default Info
