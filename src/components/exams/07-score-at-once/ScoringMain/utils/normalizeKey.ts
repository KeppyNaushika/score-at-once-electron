/**
 * キー入力を「割り当て文字列と突き合わせられる形」へ正規化する。
 *
 * 採点画面のキー割当（`DEFAULT_KEYBINDINGS` とユーザー設定）は `"x"` / `"Shift+d"` /
 * `"Alt+q"` / `"Escape"` という文字列で持っている。押した側（`ShortcutProvider` の
 * keydown）も、コマンド表を通らない直の購読（模範解答の keyup）も、**この関数だけで**
 * 突き合わせる。規則が2つに割れると、片方だけ設定変更に追随しない、という壊れ方をする
 * （実際、離す側が `"x"` 直書きで、キーを変えると模範解答が出たままになっていた）。
 */

/**
 * macOSデッドキーのKeyCodeマッピング
 * Option+E などがデッドキーとして検出される問題に対応
 */
const DEAD_KEY_CODE_MAP: { [code: string]: string } = {
  KeyQ: "q",
  KeyE: "e",
  KeyF: "f",
  KeyJ: "j",
  KeyO: "o",
  KeyP: "p",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyW: "w",
  KeyR: "r",
  KeyT: "t",
  KeyY: "y",
  KeyU: "u",
  KeyI: "i",
  KeyG: "g",
  KeyH: "h",
  KeyK: "k",
  KeyL: "l",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "n",
  KeyM: "m",
}

/**
 * 大文字小文字を保持すべき特殊キー
 * これらのキーはキーバインディング設定と同じ形式で返す
 */
const SPECIAL_KEYS = new Set([
  "Escape",
  "Backspace",
  "Enter",
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Delete",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
])

/**
 * キー入力を正規化する
 * macOSデッドキー対応と修飾キーの処理を含む
 */
export function normalizeKey(event: KeyboardEvent): string {
  let key = event.key

  // macOSデッドキー対応
  if (key === "Dead" && event.code && DEAD_KEY_CODE_MAP[event.code]) {
    key = DEAD_KEY_CODE_MAP[event.code]
  } else if (event.code && DEAD_KEY_CODE_MAP[event.code]) {
    key = DEAD_KEY_CODE_MAP[event.code]
  }

  // 特殊キーは大文字小文字を保持、通常キーは小文字に正規化
  if (!SPECIAL_KEYS.has(key)) {
    key = key.toLowerCase()
  }

  // スペースキーの正規化
  if (key === " ") {
    key = "Space"
  }

  // 修飾キーを含める（順序: Ctrl, Alt, Shift, Meta）
  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl")
  if (event.altKey) modifiers.push("Alt")
  if (event.shiftKey) modifiers.push("Shift")

  if (modifiers.length > 0) {
    return `${modifiers.join("+")}+${key}`
  }

  return key
}
