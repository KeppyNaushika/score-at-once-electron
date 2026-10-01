/**
 * キー入力を「割り当て文字列と突き合わせられる形」へ正規化する。
 *
 * 採点画面のキー割当（`DEFAULT_KEYBINDINGS` とユーザー設定）は `"x"` / `"Shift+d"` /
 * `"Alt+q"` / `"Escape"` という文字列で持っている。押した側（`ShortcutProvider` の
 * keydown）も、コマンド表を通らない直の購読（模範解答の keyup）も、**この関数だけで**
 * 突き合わせる。規則が2つに割れると、片方だけ設定変更に追随しない、という壊れ方をする
 * （実際、離す側が `"x"` 直書きで、キーを変えると模範解答が出たままになっていた）。
 *
 * **離す側（keyup）だけは修飾キーを外して突き合わせる**ので、そのための
 * `baseKeyOfEvent` / `baseKeyOfBinding` もここに置く（理由は各関数の説明）。
 * デッドキーの読み替えも大文字小文字の規則も同じものを通す必要があるため、
 * 別のファイルへ分けると上で言った「規則が2つに割れる」を自分で作ることになる。
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

/** 割り当て文字列で、キー本体の前に並ぶ修飾キーの名前（`normalizeKey` が出す綴り） */
const MODIFIER_NAMES = new Set(["Ctrl", "Alt", "Shift", "Meta"])

/**
 * 押されたキーの**本体だけ**を、割り当て文字列と同じ綴りで取り出す。
 * デッドキーの読み替えと大文字小文字の規則は `normalizeKey` と同じもの。
 */
export function baseKeyOfEvent(event: KeyboardEvent): string {
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

  return key
}

/**
 * 割り当て文字列から**本体のキーだけ**を取り出す（`"Shift+d"` → `"d"`、`"x"` → `"x"`）。
 *
 * 先頭から修飾キーの名前が続く間だけを捨てる。残り全部を本体として返すのは、
 * 本体そのものが `+` である割り当て（`"Shift++"`。US配列で Shift+= を記録すると
 * こうなる）を、最後の `+` で切って空文字にしないため。
 */
export function baseKeyOfBinding(binding: string): string {
  const segments = binding.split("+")
  let bodyIndex = 0
  while (
    bodyIndex < segments.length - 1 &&
    MODIFIER_NAMES.has(segments[bodyIndex])
  ) {
    bodyIndex++
  }
  const body = segments.slice(bodyIndex).join("+")
  // `"Shift++"` は ["Shift", "", ""] に割れる。join で戻すと `"+"` になるはずだが、
  // `"Shift+"`（本体なし）のような壊れた割り当ては空文字になるのでそのまま返す
  return body
}

/**
 * キー入力を正規化する
 * macOSデッドキー対応と修飾キーの処理を含む
 */
export function normalizeKey(event: KeyboardEvent): string {
  const key = baseKeyOfEvent(event)

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
