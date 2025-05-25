export type TabName =
  | "file"
  | "info"
  | "student" // Added from app/Tabs.tsx
  | "crop"
  | "import"
  | "score"
  | "export"

export interface TabInfo {
  name: TabName
  display: string
  enable: boolean
}

export const TABS: TabInfo[] = [
  { name: "file", display: "ファイル", enable: true },
  { name: "info", display: "情報", enable: true }, // Kept from Layout.tsx, student is separate
  { name: "student", display: "生徒", enable: true }, // From app/Tabs.tsx
  { name: "crop", display: "枠指定", enable: true }, // '解答枠指定' in app/Tabs.tsx
  { name: "import", display: "答案読込", enable: true },
  { name: "score", display: "一括採点", enable: true },
  { name: "export", display: "書き出し", enable: true },
]
