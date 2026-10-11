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
