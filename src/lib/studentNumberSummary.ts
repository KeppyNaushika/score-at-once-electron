/** 通知に並べる学籍番号の上限。残りは件数で言う */
const LISTED_STUDENT_NUMBER_LIMIT = 10

/**
 * 学籍番号の一覧を通知の本文向けに縮める。
 *
 * 取り込みで見つからない・書けなかった生徒を、1件ずつ知らせると何十回も閉じさせることになる。
 * まとめて1つの通知に載せ、多いときは先頭だけ並べて残りを件数で言う。
 */
export function summarizeStudentNumbers(studentNumbers: string[]): string {
  const listed = studentNumbers.slice(0, LISTED_STUDENT_NUMBER_LIMIT).join("、")
  const restCount = studentNumbers.length - LISTED_STUDENT_NUMBER_LIMIT
  return restCount > 0 ? `${listed} ほか${restCount}件` : listed
}
