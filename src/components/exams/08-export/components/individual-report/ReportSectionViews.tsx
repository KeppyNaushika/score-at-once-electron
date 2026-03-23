/**
 * 個人成績表の小さなセクション用純粋ビューコンポーネント
 * hooks不使用 - プレビューとPDF出力（renderToStaticMarkup）の両方で使用可能
 */
import type { IndividualReportData } from "@/electron-src/lib/export/individual-report/types"

import { formatDate } from "./computeReportData"

// ============================
// HeaderView
// ============================

interface HeaderViewProps {
  report: IndividualReportData
  fontScale: number
}

export function HeaderView({ report, fontScale }: HeaderViewProps) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "6mm",
        paddingBottom: "4mm",
        borderBottom: "2px solid #333",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: `${18 * fontScale}px`,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          {report.examInfo.examName}
        </h1>
        {report.examInfo.tags.length > 0 && (
          <p
            style={{
              fontSize: `${12 * fontScale}px`,
              color: "#666",
              margin: "2mm 0 0 0",
            }}
          >
            {report.examInfo.tags.join(", ")}
          </p>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        {report.examInfo.examDate && (
          <p
            style={{
              fontSize: `${12 * fontScale}px`,
              color: "#666",
              margin: 0,
            }}
          >
            {formatDate(report.examInfo.examDate)}
          </p>
        )}
        <p
          style={{
            fontSize: `${14 * fontScale}px`,
            fontWeight: "bold",
            margin: "2mm 0 0 0",
          }}
        >
          個人成績表
        </p>
      </div>
    </header>
  )
}

// ============================
// StudentInfoView
// ============================

interface StudentInfoViewProps {
  report: IndividualReportData
  fontScale: number
}

export function StudentInfoView({ report, fontScale }: StudentInfoViewProps) {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "6mm",
        padding: "4mm",
        backgroundColor: "#f5f5f5",
        borderRadius: "2mm",
      }}
    >
      <div>
        <p
          style={{
            fontSize: `${16 * fontScale}px`,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          {report.studentInfo.fullName}
        </p>
        <p
          style={{
            fontSize: `${11 * fontScale}px`,
            color: "#666",
            margin: "1mm 0 0 0",
          }}
        >
          {report.studentInfo.studentNumber}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p
          style={{
            fontSize: `${12 * fontScale}px`,
            margin: 0,
          }}
        >
          {report.studentInfo.grade && `${report.studentInfo.grade}年`}
          {report.studentInfo.className && ` ${report.studentInfo.className}`}
          {report.studentInfo.attendanceNumber != null &&
            ` ${report.studentInfo.attendanceNumber}番`}
        </p>
      </div>
    </section>
  )
}

// ============================
// StatsSummaryView
// ============================

interface StatsSummaryViewProps {
  items: { label: string; value: string }[]
  fontScale: number
}

export function StatsSummaryView({ items, fontScale }: StatsSummaryViewProps) {
  if (items.length === 0) return null

  return (
    <section
      style={{
        display: "flex",
        gap: "3mm",
        marginBottom: "6mm",
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            padding: "3mm 2mm",
            backgroundColor: "#f0f7ff",
            borderRadius: "2mm",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: `${10 * fontScale}px`,
              color: "#666",
              margin: 0,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: `${16 * fontScale}px`,
              fontWeight: "bold",
              margin: "1mm 0 0 0",
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </section>
  )
}

// ============================
// CommentSectionView
// ============================

interface CommentSectionViewProps {
  fontScale: number
}

export function CommentSectionView({ fontScale }: CommentSectionViewProps) {
  return (
    <section
      style={{
        marginTop: "6mm",
        padding: "4mm",
        border: "1px solid #ccc",
        borderRadius: "2mm",
      }}
    >
      <p
        style={{
          fontSize: `${11 * fontScale}px`,
          fontWeight: "bold",
          margin: "0 0 2mm 0",
        }}
      >
        コメント:
      </p>
      <div
        style={{
          minHeight: "20mm",
          borderBottom: "1px dotted #ccc",
        }}
      />
    </section>
  )
}

// ============================
// SignatureSectionView
// ============================

interface SignatureSectionViewProps {
  fontScale: number
}

export function SignatureSectionView({ fontScale }: SignatureSectionViewProps) {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "10mm",
        marginTop: "6mm",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: `${10 * fontScale}px`,
            margin: "0 0 2mm 0",
          }}
        >
          保護者印
        </p>
        <div
          style={{
            width: "20mm",
            height: "20mm",
            border: "1px solid #ccc",
            borderRadius: "2mm",
          }}
        />
      </div>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: `${10 * fontScale}px`,
            margin: "0 0 2mm 0",
          }}
        >
          担任印
        </p>
        <div
          style={{
            width: "20mm",
            height: "20mm",
            border: "1px solid #ccc",
            borderRadius: "2mm",
          }}
        />
      </div>
    </section>
  )
}
