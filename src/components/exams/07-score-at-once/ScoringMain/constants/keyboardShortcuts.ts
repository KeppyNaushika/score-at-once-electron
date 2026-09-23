import { SHORTCUT_CATEGORIES } from "../../constants/shortcutCatalog"

/**
 * 採点画面の「キーボード」一覧に出す項目。
 *
 * ここにはコマンドの並びだけを置き、**キーは書かない**。表示のたびに実際の割り当て
 * （利用者の設定を反映したもの）から引く。キーを書き写すと、設定で変えたキーや
 * 既定の変更が一覧にだけ反映されない。並びは設定画面の分類をそのまま使う。
 */
export const KEYBOARD_HELP_SECTIONS: readonly {
  title: string
  commandIds: readonly string[]
  /** 数字キーで部分点の入力を始めることを1行にまとめて添える */
  showPartialScoreStart?: boolean
}[] = [
  {
    title: SHORTCUT_CATEGORIES.scoring.label,
    commandIds: SHORTCUT_CATEGORIES.scoring.keys,
  },
  {
    title: SHORTCUT_CATEGORIES.navigation.label,
    commandIds: SHORTCUT_CATEGORIES.navigation.keys,
  },
  {
    title: SHORTCUT_CATEGORIES.filter.label,
    commandIds: SHORTCUT_CATEGORIES.filter.keys,
  },
  {
    title: SHORTCUT_CATEGORIES.view.label,
    commandIds: SHORTCUT_CATEGORIES.view.keys,
  },
  {
    title: SHORTCUT_CATEGORIES.tool.label,
    commandIds: SHORTCUT_CATEGORIES.tool.keys,
  },
  // 数字の1つずつは並べても読まれないので、入力欄の出入りと、
  // 数字キーで入力を始めること（1行にまとめる）だけを出す
  {
    title: SHORTCUT_CATEGORIES.modal.label,
    commandIds: ["modal.backspace", "modal.cancel"],
    showPartialScoreStart: true,
  },
]
