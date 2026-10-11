Status: ready-for-agent
Blocked by: —

# Veri temeli: SQLite şeması, config modülü ve test altyapısı

Spec: [../spec.md](../spec.md) → "Veri", "Config"

## Yapılacaklar

- `better-sqlite3` ekle (native rebuild `postinstall` içindeki `electron-builder install-app-deps` ile). Veritabanı `app.getPath('userData')/meetanalyzing.db`.
- Basit, sıralı migration mekanizması (ör. `user_version` pragma) ve spec'teki taslak tabloları içeren ilk migration: `meetings`, `recordings`, `recording_channels`, `segments`, `words`, `corrections`, `approved_transcripts`, `transcription_queue`.
- `meetings.state` tek alan: `recording | closed | transcribing | transcribed | approved` (CHECK constraint). Ayrı bayrak yok (bkz. docs/meeting-lifecycle.md).
- Main process'te tek bir config modülü: `docs/tuning.md`'deki tüm değerler, her biri yorumla dokümana işaret eder. HF revision ve SHA-256 şimdilik `TODO` (bkz. issue 07).
- Repoda test runner yok: main process kodu için `vitest` ekle ve `test` script'i tanımla. DB testleri bellek içi veritabanıyla çalışsın.

## Kabul kriterleri

- [ ] Uygulama ilk açılışta DB'yi oluşturur, ikinci açılışta migration tekrar çalışmaz.
- [ ] Geçersiz `state` değeri DB tarafından reddedilir (test).
- [ ] `pnpm test` ve `pnpm typecheck` geçer.

## Comments

**2026-10-11:** Uygulandı.
- `openDatabase(path)` (`src/main/db/database.ts`): `user_version` tabanlı migration'ları uygular, WAL ve foreign key'leri açar. Şema `src/main/db/migrations.ts` içinde; `state` ve `language` CHECK'li, Meeting'e bağlı tüm veri `ON DELETE CASCADE` ile silinir.
- Config: `src/main/config.ts`. Thread sayısı issue 08'e, HF revision ve SHA-256 issue 07'ye bırakıldı.
- Testler Electron'un Node'unda koşar: `pnpm test` (`ELECTRON_RUN_AS_NODE=1 electron …/vitest.mjs run`), çünkü better-sqlite3 Electron ABI'sine göre derlenir.
- Review'dan issue 09'a not: `transcription_queue` FIFO sırası `ORDER BY enqueued_at, rowid` ile alınmalı (aynı ms'de eşitlik).
