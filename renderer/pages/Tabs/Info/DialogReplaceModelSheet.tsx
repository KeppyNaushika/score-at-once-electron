import Image from "next/image"
import React from "react"

const DialogReplaceModelSheet = (props: {
  modelSheets: string[]
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>>
  dialogReplaceModelSheet: number | null
  setDialogReplaceModelSheet: React.Dispatch<
    React.SetStateAction<number | null>
  >
}): JSX.Element => {
  const {
    modelSheets,
    setModelSheets,
    dialogReplaceModelSheet,
    setDialogReplaceModelSheet,
  } = props

  const clickConfirmReplaceModelSheet = (index: number): void => {
    setDialogReplaceModelSheet(null)
    setModelSheets((prev) => {
      prev.splice(index, 1)
      return prev
    })
  }

  return (
    <>
      {dialogReplaceModelSheet !== null && (
        <div className="absolute inset-0 z-20 flex min-h-full min-w-full animate-float-in flex-col items-center justify-center border-2 bg-white/80">
          <div className="py-4 text-2xl">模範解答画像の置換</div>
          <div className="relative h-1/2 w-1/2">
            <Image
              className="absolute object-contain"
              src={modelSheets[dialogReplaceModelSheet]}
              alt={`thumbnail-${dialogReplaceModelSheet}`}
              fill={true}
            />
          </div>
          <div className="">模範解答画像を置換しますか？</div>
          <div className="">
            この模範解答を置換すると、採点データは引き継がれます
          </div>
          <div className="flex py-4">
            <div
              className="flex h-16 w-40 flex-col items-center justify-center rounded-md bg-emerald-500 text-white"
              onClick={() => {
                clickConfirmReplaceModelSheet(dialogReplaceModelSheet)
              }}
            >
              <div className="">JPEG / PNG</div>
              <div className="">で置換する</div>
            </div>
            <div className="w-4"></div>
            <div
              className="flex h-16 w-40 flex-col items-center justify-center rounded-md bg-emerald-500 text-white"
              onClick={() => {
                clickConfirmReplaceModelSheet(dialogReplaceModelSheet)
              }}
            >
              <div className="">PDF</div>
              <div className="">で置換する</div>
            </div>
            <div className="w-20"></div>
            <div
              className="flex h-16 w-40 items-center justify-center rounded-md bg-gray-300"
              onClick={() => {
                setDialogReplaceModelSheet(null)
              }}
            >
              戻る
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default DialogReplaceModelSheet
