import Image from "next/image"
import React from "react"

const DialogRemoveModelSheet = (props: {
  modelSheets: string[]
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>>
  dialogRemoveModelSheet: number | null
  setDialogRemoveModelSheet: React.Dispatch<React.SetStateAction<number | null>>
}): JSX.Element => {
  const {
    modelSheets,
    setModelSheets,
    dialogRemoveModelSheet,
    setDialogRemoveModelSheet,
  } = props

  const clickConfirmRemoveModelSheet = (index: number): void => {
    setDialogRemoveModelSheet(null)
    setModelSheets((prev) => {
      prev.splice(index, 1)
      return prev
    })
  }

  return (
    <>
      {dialogRemoveModelSheet !== null && (
        <div className="absolute inset-0 z-20 flex min-h-full min-w-full animate-float-in flex-col items-center justify-center border-2 bg-white/80">
          <div className="py-4 text-2xl">模範解答画像の削除</div>
          <div className="relative h-1/2 w-1/2">
            <Image
              className="absolute object-contain"
              src={modelSheets[dialogRemoveModelSheet]}
              alt={`thumbnail-${dialogRemoveModelSheet}`}
              fill={true}
            />
          </div>
          <div className="">
            採点データがありますが、本当に削除しても良いですか？
          </div>
          <div className="">
            この模範解答を削除すると、採点データも全て削除されます
          </div>
          <div className="flex py-4">
            <div
              className="flex h-16 w-40 items-center justify-center rounded-md bg-red-500 text-white"
              onClick={() => {
                clickConfirmRemoveModelSheet(dialogRemoveModelSheet)
              }}
            >
              削除する
            </div>
            <div className="w-20"></div>
            <div
              className="flex h-16 w-40 items-center justify-center rounded-md bg-gray-300"
              onClick={() => {
                setDialogRemoveModelSheet(null)
              }}
            >
              削除せず戻る
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default DialogRemoveModelSheet
