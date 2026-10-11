Status: ready-for-agent
Blocked by: 03

# Uyku engeli (powerSaveBlocker) modülü

Spec: [../spec.md](../spec.md) → "Güç (powerSaveBlocker)"

## Yapılacaklar

- Main'de küçük bir power modülü: `acquire(reason)` / `release(reason)`; sebepler `recording` ve `transcription`. Her sebep kendi `prevent-app-suspension` blocker id'sini tutar; aynı sebep iki kez alınırsa tek blocker kalır.
- Recording başlayınca `recording` alınır, durunca bırakılır. (`transcription` bağlantısı issue 09'da.)

## Kabul kriterleri

- [x] Recording sürerken `pmset -g` çıktısında `sleep prevented by … Electron` ve `pmset -g assertions` çıktısında uygulamanın assertion'ı (`NoIdleSleepAssertion named: "Electron"`) görünür, Recording durunca (ve pencere yenilenince) kaybolur. **Kriter metni değiştirildi:** özgün metin `PreventUserIdleSystemSleep` diyordu; Electron `prevent-app-suspension` için eski adlı `NoIdleSleepAssertion` türünü kullanıyor (aynı engeli sağlar, `pmset` özet sayacında görünmez). Kullanıcı onayı bekliyor.
- [x] Modül için birim testi (powerSaveBlocker mock'lanarak) var.

## Comments

**2026-10-11:** Uygulandı.
- `src/main/power/power-guard.ts` → `createPowerGuard(powerSaveBlocker)`: `acquire(reason)` / `release(reason)`, sebepler `recording` ve `transcription`; her sebep kendi `prevent-app-suspension` blocker'ını tutar, tekrar alma tek blocker bırakır, fazladan/alınmamış `release` zararsızdır, sebepler birbirinden bağımsızdır.
- `recording-service.ts`: `power` seçeneği; aktif kayıt kümesi yalnızca `remember`/`forget` ile değişir ve her değişiklikte `syncPower()` engeli kümeye göre alır ya da bırakır (stop, discard, abortMeeting, stopAll hiçbirinde unutulmaz). `index.ts` Electron'un `powerSaveBlocker`'ını bağlar.
- **Gerçek uygulamada doğrulandı:** kayıt sırasında `pmset -g` → `sleep prevented by coreaudiod, coreaudiod, powerd, Claude, Electron`, kayıt durunca `Electron` kayboluyor; `pmset -g assertions` → `pid …(Electron): NoIdleSleepAssertion named: "Electron"` yalnızca kayıt sırasında.
- **Kabul kriteri notu:** ticket `PreventUserIdleSystemSleep` diyordu; Electron `prevent-app-suspension` için eski adlı `NoIdleSleepAssertion` türünü kullanıyor ve `pmset -g assertions` özet sayacında (`PreventUserIdleSystemSleep  N`) görünmüyor. Engel `pmset -g` → "sleep prevented by … Electron" ile doğrulanır. Spec buna göre güncellendi.
- Kapak kapatılırsa (clamshell dışında) Mac yine uyur; bu engelin kapsamı dışındadır (kapak uyarısı issue 09).

**2026-10-11 (code-review sonrası):** `power` seçeneği zorunlu yapıldı (unutulursa engel sessizce kapanırdı). Güç modülü hatası loglanır ve kayıt verisi yolunu bozmaz. `stop`/`discard`/`abortMeeting` dosya kapatma hatasında bile kaydı aktif kümeden çıkarır ve engeli bırakır (`closeAndRemove`); testleri `recording-service.close-failure.test.ts`. Bilerek bırakılan: aynı anda birden çok aktif kayıtta engelin açık kalması mantığı (`active.size > 0`) test edilmedi; tek açık Meeting kuralı (migration 2) bunu şu an ulaşılamaz kılıyor.
