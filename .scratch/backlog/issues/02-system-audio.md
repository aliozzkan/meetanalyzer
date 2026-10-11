Status: needs-triage

# Sistem sesini (toplantıdaki diğer katılımcılar) kaydet

İlk dilim yalnızca mikrofon kaydediyor. Recording şeması baştan çok kanallı kuruldu. macOS'te `session.setDisplayMediaRequestHandler` + `audio: 'loopback'` + `getDisplayMedia` ile sistem sesini ayrı kanal olarak al. Açık sorular: Screen Recording izni akışı, iki kanalın ayrı mı birleşik mi transcribe edileceği (ayrı transcribe 'ben / diğerleri' ayrımını bedavaya verir), katılımcı rızası ve KVKK.
