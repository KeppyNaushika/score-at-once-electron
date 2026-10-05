/**
 * 事業者の SDK の `models.list()` の偽物。SDK の PagePromise と同じく、待てば最初のページ、
 * for await で回せば全件が順に来る。`error` を渡すと、待っても回しても失敗する
 */
export function createFakeModelPage<TModel>(
  models: readonly TModel[],
  error?: Error
): PromiseLike<unknown> & AsyncIterable<TModel> {
  const firstPage: Promise<unknown> = error
    ? Promise.reject(error)
    : Promise.resolve({ data: models })
  // 待たれずに捨てられたときの未処理の reject を出さない
  firstPage.catch(() => undefined)
  return {
    then: (onFulfilled, onRejected) => firstPage.then(onFulfilled, onRejected),
    async *[Symbol.asyncIterator]() {
      if (error) throw error
      yield* models
    },
  }
}
