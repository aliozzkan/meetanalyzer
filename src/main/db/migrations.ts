// Sıralı şema migration'ları. Her eleman bir sürümdür; uygulanan son sürüm
// SQLite `user_version` pragma'sında tutulur. Mevcut bir migration'ı değiştirme,
// yenisini sona ekle.
export const migrations: string[] = [
  `
  CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL CHECK (language IN ('tr', 'en')),
    -- Tek sıralı durum alanı; bkz. docs/meeting-lifecycle.md
    state TEXT NOT NULL
      CHECK (state IN ('recording', 'closed', 'transcribing', 'transcribed', 'approved')),
    last_error TEXT,
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    approved_at INTEGER
  );

  CREATE TABLE recordings (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    transcribed_at INTEGER,
    UNIQUE (meeting_id, seq)
  );

  -- Bir Recording birden çok kanal içerebilir (şimdilik yalnızca 'mic').
  -- file_path, Approved'dan sonra ses silinince NULL olur.
  CREATE TABLE recording_channels (
    recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('mic')),
    file_path TEXT,
    duration_ms INTEGER,
    PRIMARY KEY (recording_id, kind)
  );

  CREATE TABLE segments (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    UNIQUE (recording_id, seq)
  );

  -- Ham Transcription çıktısı; yazıldıktan sonra değişmez. Correction'lar ayrı tutulur.
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    segment_id TEXT NOT NULL REFERENCES segments (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    confidence REAL NOT NULL,
    is_suspect INTEGER NOT NULL CHECK (is_suspect IN (0, 1)),
    UNIQUE (segment_id, seq)
  );

  CREATE TABLE corrections (
    word_id TEXT PRIMARY KEY REFERENCES words (id) ON DELETE CASCADE,
    original TEXT NOT NULL,
    corrected TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('tr', 'en')),
    created_at INTEGER NOT NULL
  );

  CREATE TABLE approved_transcripts (
    meeting_id TEXT PRIMARY KEY REFERENCES meetings (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE transcription_queue (
    meeting_id TEXT PRIMARY KEY REFERENCES meetings (id) ON DELETE CASCADE,
    enqueued_at INTEGER NOT NULL
  );
  `,
  // Aynı anda en fazla bir Meeting 'recording' durumunda olabilir (docs/meeting-lifecycle.md).
  // Servis de kontrol eder; bu, veritabanı düzeyindeki son güvencedir.
  `
  CREATE UNIQUE INDEX one_recording_meeting ON meetings (state) WHERE state = 'recording';
  `,
  // Kullanıcı ayarları (ör. Default Language). Değerler uygulama tarafında doğrulanır.
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // Meeting'in isteğe bağlı, yalnızca lokal adı (GLOSSARY → Title). Kırpma ve uzunluk servis tarafında.
  `
  ALTER TABLE meetings ADD COLUMN title TEXT;
  `,
  // Sistem sesi (system-audio dilimi): bir Recording'in iki kanalı olur ('mic' = Self, 'system' = Others) ve
  // Transcription kanal başına izlenir. SQLite CHECK kısıtını değiştiremediği için tablo yeniden kurulur;
  // mevcut Recording'lerin transcribed_at değeri 'mic' kanalına taşınır. `recordings.transcribed_at`
  // "tüm kanallar bitti" anlamında kalır.
  `
  CREATE TABLE recording_channels_v2 (
    recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('mic', 'system')),
    file_path TEXT,
    duration_ms INTEGER,
    transcribed_at INTEGER,
    PRIMARY KEY (recording_id, kind)
  );

  INSERT INTO recording_channels_v2 (recording_id, kind, file_path, duration_ms, transcribed_at)
    SELECT c.recording_id, c.kind, c.file_path, c.duration_ms, r.transcribed_at
    FROM recording_channels c JOIN recordings r ON r.id = c.recording_id;

  DROP TABLE recording_channels;
  ALTER TABLE recording_channels_v2 RENAME TO recording_channels;
  `,
  // Segment hangi kanaldan (mikrofon = Self, sistem sesi = Others) geldiğini taşır; mevcut segmentler 'mic'.
  // Kanal başına Transcription segment numaralarını Recording içinde sürdürür (UNIQUE (recording_id, seq)).
  `
  ALTER TABLE segments ADD COLUMN channel TEXT NOT NULL DEFAULT 'mic' CHECK (channel IN ('mic', 'system'));
  `,
  // Approved Transcript Side bloklarını saklar: JSON dizisi [{ side, text }]. `text` düz metin görünümü olarak kalır.
  // Bu migration'dan önce onaylananlarda blocks NULL'dır ve tek bir Self bloğu sayılır.
  `
  ALTER TABLE approved_transcripts ADD COLUMN blocks TEXT;
  `
]
