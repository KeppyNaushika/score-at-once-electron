/**
 * 個人成績表PDF用スタイル定義
 */
import { StyleSheet } from "@react-pdf/renderer"

export const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // ヘッダー
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
  },
  examName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  examDate: {
    fontSize: 10,
    color: "#666",
  },
  // 生徒情報
  studentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f5f5f5",
  },
  studentName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  studentDetail: {
    fontSize: 10,
    color: "#333",
  },
  // 統計サマリー
  statsSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#e8f4fc",
    borderRadius: 4,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  // テーブル
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e0e0e0",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
    backgroundColor: "#fafafa",
  },
  tableCell: {
    paddingHorizontal: 4,
  },
  tableCellLabel: {
    flex: 3,
    paddingHorizontal: 4,
  },
  tableCellNumber: {
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  tableCellMark: {
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  // 評価マーク
  markCorrect: {
    color: "#22c55e",
    fontWeight: "bold",
  },
  markIncorrect: {
    color: "#ef4444",
    fontWeight: "bold",
  },
  markPartial: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  // セクション
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  // グラフエリア
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  chartContainer: {
    width: 160,
    height: 120,
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 8,
    marginBottom: 4,
    color: "#666",
  },
  // 学習アドバイス
  adviceSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 4,
  },
  adviceTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
  },
  adviceItem: {
    fontSize: 9,
    marginBottom: 2,
    paddingLeft: 10,
  },
  // コメント欄
  commentSection: {
    marginTop: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    minHeight: 60,
  },
  commentLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 5,
  },
  // 署名欄
  signatureSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
    gap: 20,
  },
  signatureBox: {
    width: 80,
    alignItems: "center",
  },
  signatureLabel: {
    fontSize: 8,
    marginBottom: 5,
  },
  signatureArea: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: "#999",
  },
  // 合計行
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#e8e8e8",
    borderTopWidth: 2,
    borderTopColor: "#666",
    paddingVertical: 6,
    fontWeight: "bold",
  },
})

// 色定義
export const colors = {
  correct: "#22c55e",
  incorrect: "#ef4444",
  partial: "#f59e0b",
  primary: "#3b82f6",
  secondary: "#6b7280",
  background: "#f5f5f5",
  border: "#e0e0e0",
}
