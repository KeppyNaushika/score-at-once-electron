/**
 * 共通「生徒追加パネル」の型
 *
 * 試験(exam)・成績(grade)で共有する。host（モーダル/インライン）は adapter で
 * データ取得・追加処理を差し込み、exam固有の examDate/status/customOrder などは
 * host 側で内部解決する。
 *
 * 学級候補・生徒候補はいずれも境界が返す行（`ClassroomWithMemberships` /
 * `StudentWithMemberships`）をそのまま持つ。以前は「パネルが読む列だけ」の手写しを
 * 置いて host ごとに詰め替えていたが、供給側は3経路とも同じ Prisma payload なので、
 * 写し違いに気付けないだけだった（資料の host は生徒名を空配列で潰していた）。
 */

import type { Student } from "@prisma/client"

import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

/**
 * 追加候補の学級1件（学級の実体に、パネルが導いた分を隣へ添えたもの）
 *
 * 学級には在籍と生徒が同梱されて降ってくるが、同一生徒が複数の在籍歴で現れうるので、
 * 「この学級から追加できる生徒」は studentId で畳んでから読む。実体（classroom）と
 * 導出（addableStudents / isSelected）は混ぜずに並べる。
 */
export interface AddPanelClassroomCandidate {
  /** 学級の行（在籍と生徒を同梱）。名前は classroom.name */
  classroom: ClassroomWithMemberships
  /**
   * この学級から追加できる生徒（在籍歴を畳んだもの、出席番号順）。人数は .length
   *
   * 在籍スイッチで境界の候補から消えた選択済みの学級は空（＝0名）。追加できる生徒が
   * 0人だから消えたので、選んだ時点の人数は持ち回らない。
   */
  addableStudents: Student[]
  isSelected: boolean
}

/**
 * 追加候補の生徒1件（生徒の行に、選んでいるかどうかを添えたもの）
 *
 * 学級と違い、候補から消えた選択済みの生徒を作り直すことはないので、行をそのまま
 * 広げて `isSelected` を隣に置く。
 */
export interface SelectableStudent extends StudentWithMemberships {
  isSelected: boolean
}

/** host が差し込むデータ取得・追加処理 */
export interface StudentAddPanelAdapter {
  /** この追加パネルが誰のものか（キャッシュのキーはこれで区切る） */
  scopeId: string
  /** 追加可能な学級候補を取得（activeOnly=在籍中のみ） */
  fetchAvailableClassrooms: (
    activeOnly: boolean
  ) => Promise<ClassroomWithMemberships[]>
  /** 追加可能な生徒候補を取得（activeOnly=在籍中の所属が1件以上ある生徒のみ） */
  fetchAvailableStudents: (
    activeOnly: boolean
  ) => Promise<StudentWithMemberships[]>
  /** 選択した学級（指定順）を一括追加 */
  addClassrooms: (
    orderedClassroomIds: string[],
    activeOnly: boolean
  ) => Promise<void>
  /** 選択した生徒を個別追加 */
  addStudents: (studentIds: string[]) => Promise<void>
}

export interface StudentAddPanelProps {
  adapter: StudentAddPanelAdapter
  /** 追加完了時に呼ばれる（host 側のロスター再読込などに使う） */
  onAdded: () => void
  /** 親の高さいっぱいに広げ、候補リストを内部スクロールにするか（モーダル用、既定 false） */
  fillHeight?: boolean
  /** 学級タブの在籍スイッチ初期値（既定 true） */
  classroomActiveOnlyDefault?: boolean
  /** 個別タブの在籍スイッチ初期値（既定 true） */
  studentActiveOnlyDefault?: boolean
}
