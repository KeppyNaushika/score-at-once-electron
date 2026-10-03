import { Kbd } from "@/components/ui/kbd"

/** ショートカットキー表示用ヘルパー */
export function KeyHint({ label }: { label: string }) {
  return (
    <div className="mt-1 text-xs text-gray-400">
      キー: <Kbd>{label}</Kbd>
    </div>
  )
}
