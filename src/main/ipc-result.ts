import type { IpcResult } from '../shared/ipc-result'

// Servis hataları kodlarıyla döner. Beklenmeyen hatalar (geçersiz IPC girdisi, SQLite, dosya sistemi)
// loglanır ve renderer'a genel bir sonuç olarak iletilir; böylece UI hep bir cevap alır.
export async function toIpcResult<T, Code extends string>(
  knownError: new (...args: never[]) => Error & { code: Code },
  internalErrorCode: Code,
  action: () => T | Promise<T>
): Promise<IpcResult<T, Code>> {
  try {
    return { ok: true, value: await action() }
  } catch (error) {
    if (error instanceof knownError) {
      return { ok: false, code: error.code, message: error.message }
    }
    console.error('Beklenmeyen IPC hatası:', error)
    return { ok: false, code: internalErrorCode, message: 'Beklenmeyen bir hata oluştu.' }
  }
}
