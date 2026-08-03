/**
 * TanStack Table の拡張ポイント（`TableMeta` / `ColumnMeta`）へ、
 * `EditableTable` が列とテーブルの間で受け渡す項目を宣言マージで入れる。
 *
 * 型パラメータ名は元の宣言と揃えること（`TData` / `TValue`）。
 * 改名するとマージが成立せず、`meta` が暗黙の any に落ちて誤りを検出しなくなる。
 * 末尾の `export {}` も同じ理由で必須で、無いとこのファイルが
 * module augmentation ではなく ambient module 宣言として扱われる。
 */
import type { RowData } from "@tanstack/react-table"

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    /**
     * 編集セルの確定値をテーブルの外へ渡す。
     *
     * 任意にする。宣言マージはリポジトリ内の全 `useReactTable` に効くので、必須に
     * すると `meta` を持つ別のテーブル（行アクションのコールバック等）まで
     * `EditableTable` の契約を満たす義務を負い、使いもしない `updateData` を
     * でっち上げないとコンパイルできなくなる。
     */
    updateData?: (rowIndex: number, columnId: string, value: string) => void
  }

  interface ColumnMeta<TData extends RowData, TValue> {
    /** 編集不可の列。セルは元のレンダラーのまま、貼り付けの対象からも外れる */
    readOnly?: boolean
    /** 編集セルの入力欄に出すプレースホルダ */
    placeholder?: string
    /** 非空の入力の検証。false なら赤背景で「保存されない」ことを示す */
    validate?: (value: string) => boolean
  }
}

export {}
