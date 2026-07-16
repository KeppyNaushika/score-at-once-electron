/**
 * 共通「生徒追加パネル」の型
 *
 * 試験(exam)・成績(grade)で共有する。host（モーダル/インライン）は adapter で
 * データ取得・追加処理を差し込み、exam固有の examDate/status/customOrder などは
 * host 側で内部解決する。
 */

/** 学級候補（追加可能な学級） */
export interface AddPanelClassroomItem {
  id: string
  name: string
  /** この学級から新たに追加できる在籍生徒数 */
  studentCount: number
  /** 追加対象の生徒名（出席番号順、tooltip表示用） */
  studentNames: string[]
}

/** 生徒候補（個別追加用） */
export interface AddPanelStudentItem {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  memberships: {
    attendanceNumber?: number | null
    classroom: { id: string; name: string }
  }[]
}

/** host が差し込むデータ取得・追加処理 */
export interface StudentAddPanelAdapter {
  /** 追加可能な学級候補を取得（activeOnly=在籍中のみ） */
  fetchAvailableClassrooms: (
    activeOnly: boolean
  ) => Promise<AddPanelClassroomItem[]>
  /** 追加可能な生徒候補を取得（activeOnly=在籍中の所属が1件以上ある生徒のみ） */
  fetchAvailableStudents: (
    activeOnly: boolean
  ) => Promise<AddPanelStudentItem[]>
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
  /** 学級の追加順をドラッグで並び替え可能にするか（既定 true） */
  showClassroomReorder?: boolean
  /** 親の高さいっぱいに広げ、候補リストを内部スクロールにするか（モーダル用、既定 false） */
  fillHeight?: boolean
  /** 学級タブの在籍スイッチ初期値（既定 true） */
  classroomActiveOnlyDefault?: boolean
  /** 個別タブの在籍スイッチ初期値（既定 true） */
  studentActiveOnlyDefault?: boolean
}
