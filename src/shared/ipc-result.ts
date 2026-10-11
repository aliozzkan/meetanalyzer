// IPC üzerinden hata fırlatılınca `code` kaybolduğu için servis hataları sonuç olarak döner.
export type IpcResult<T, Code extends string> =
  { ok: true; value: T } | { ok: false; code: Code; message: string }
