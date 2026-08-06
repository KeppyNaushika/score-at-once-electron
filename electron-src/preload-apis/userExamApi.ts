import { ipcRenderer } from "electron"

/** ユーザー-試験関連のIPC API（メンバー一覧・オーナー判定・招待・除名・ユーザー検索） */
export function createUserExamApi() {
  return {
    // UserExam
    userExam: {
      getMembers: (examId: string) =>
        ipcRenderer.invoke("user-exam:get-members", examId),
      isOwner: (userId: string, examId: string) =>
        ipcRenderer.invoke("user-exam:is-owner", userId, examId),
      invite: (options: {
        examId: string
        userId: string
        invitedBy: string
      }) => ipcRenderer.invoke("user-exam:invite", options),
      remove: (examId: string, userId: string, removedBy: string) =>
        ipcRenderer.invoke("user-exam:remove", examId, userId, removedBy),
      searchUsers: (examId: string, query: string) =>
        ipcRenderer.invoke("user-exam:search-users", examId, query),
    },
  }
}
