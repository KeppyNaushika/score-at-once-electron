/**
 * 文字を打ち込める要素か（input・textarea・contentEditable）。
 *
 * キーボードショートカットは、ここが true の要素に入ったキーを横取りしない。
 * 打った文字や Backspace はその欄のためにあるので、採点キー・削除キーとして
 * 取ると、入力が黙って消えたり、選んでいた枠や描画まで消えたりする。
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
