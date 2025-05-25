import { useState, useCallback } from "react"

export interface ReactTagType {
  id: string
  text: string
  className?: string
  [key: string]: any
}

const defaultSuggestions: ReactTagType[] = [
  { id: "数学", text: "数学" },
  { id: "英語", text: "英語" },
  { id: "物理", text: "物理" },
  { id: "化学", text: "化学" },
  { id: "国語", text: "国語" },
  { id: "歴史", text: "歴史" },
]

export const useTags = (
  initialTags: ReactTagType[] = [],
  suggestionsList: ReactTagType[] = defaultSuggestions,
) => {
  const [tags, setTags] = useState<ReactTagType[]>(initialTags)
  const [suggestions] = useState<ReactTagType[]>(suggestionsList)

  const handleDelete = useCallback((i: number) => {
    setTags((prevTags) => prevTags.filter((_tag, index) => index !== i))
  }, [])

  const handleAddition = useCallback((tag: ReactTagType) => {
    // id が text と同じでない場合や、より複雑な id 生成が必要な場合は調整
    const newTag = { ...tag, id: tag.id || tag.text }
    setTags((prevTags) => [...prevTags, newTag])
  }, [])

  const handleDrag = useCallback(
    (tag: ReactTagType, currPos: number, newPos: number) => {
      setTags((prevTags) => {
        const newTags = [...prevTags]
        newTags.splice(currPos, 1)
        newTags.splice(newPos, 0, tag)
        return newTags
      })
    },
    [],
  )

  // 必要に応じてタグを初期化/リセットする関数
  const resetTags = useCallback((newInitialTags: ReactTagType[] = []) => {
    setTags(newInitialTags)
  }, [])

  return {
    tags,
    setTags, // 外部から直接設定したい場合のために公開
    suggestions,
    handleDelete,
    handleAddition,
    handleDrag,
    resetTags,
  }
}
