import React, { useState } from "react"
import { type ColorResult, SketchPicker } from "react-color"

import {
  Close,
  ContentCopy,
  ContentPaste,
  CropSquare,
  Delete,
  DeleteForever,
  DeleteForeverOutlined,
  DeleteOutline,
  DeleteOutlined,
  EditOutlined,
  PanToolOutlined,
  Straighten,
  TextFields,
} from "@mui/icons-material"

const CommentWindow = (props: {
  setIsShowCommentWindow: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element => {
  const { setIsShowCommentWindow } = props

  const [isShowColorPicker, setIsShowColorPicker] = useState(false)
  const [textColor, setTextColor] = useState<string>("#FFFFFF")
  const changeTextColor = (color: ColorResult): void => {
    const hex: string = color.hex
    setTextColor(hex)
  }

  return (
    <div className="fixed z-30 min-h-full min-w-full animate-float-in bg-white/80 p-20">
      <div className="flex min-w-full select-none justify-center overflow-x-auto bg-slate-100 py-2 shadow-md">
        <div className="flex px-4">
          <div
            className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md"
            onClick={() => {
              setIsShowCommentWindow(false)
            }}
          >
            <Close />
          </div>
        </div>
        <div className="border-l-2 border-stone-200"></div>
        <div className="flex px-4">
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <PanToolOutlined />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <ContentCopy />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <ContentPaste />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <Delete />
          </div>
        </div>
        <div className="border-l-2 border-stone-200"></div>
        <div className="flex px-4">
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <EditOutlined />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <Straighten />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <CropSquare />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-stone-200 shadow-md">
            <TextFields />
          </div>
        </div>
        <div className="border-l-2 border-stone-200"></div>
        <div className="flex items-center px-4">
          <div className="mx-1 h-8 w-8">
            <div className="absolute flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-4 border-stone-300 bg-black shadow-md"></div>
          </div>
          <div className="mx-1 h-8 w-8">
            <div className="absolute flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-4 border-stone-300 bg-red-600 shadow-md"></div>
          </div>
          <div className="mx-1 h-8 w-8">
            <div
              className="absolute flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-4 border-stone-300 bg-white shadow-md"
              onClick={() => {
                setIsShowColorPicker(true)
              }}
              style={{ backgroundColor: textColor }}
            ></div>
            {isShowColorPicker && (
              <div className="">
                <div className=" absolute z-50 translate-y-10">
                  <div className="animate-float-in">
                    <SketchPicker
                      color={textColor}
                      onChange={changeTextColor}
                      disableAlpha={true}
                    />
                  </div>
                </div>
                <div
                  className="fixed left-0 top-0 z-40 min-h-full min-w-full"
                  onClick={() => {
                    setIsShowColorPicker(false)
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>
        {/* <SketchPicker /> */}
      </div>
    </div>
  )
}

export default CommentWindow
