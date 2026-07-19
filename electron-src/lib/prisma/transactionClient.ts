import type { PrismaClient } from "@prisma/client"

/**
 * `$transaction` のコールバックが受け取るトランザクションクライアント。
 *
 * 各モジュールで同じ型を private に書き直すと Prisma のメジャー更新時に全箇所を
 * 追う必要が出るため、定義はここ1箇所に集約する。
 */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]
