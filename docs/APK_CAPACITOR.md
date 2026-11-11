# APK via Capacitor (build no GitHub Actions)

**Status: configurado, NÃO executado.** O build do APK precisa do Android SDK, que não existe neste ambiente; ele só será compilado de fato quando o workflow rodar no GitHub. Por isso, **nenhum APK foi gerado nem testado**.

## Como gerar
GitHub → *Actions* → **APK Android (Capacitor)** → *Run workflow*. Ao terminar, baixe o artefato `nosso-sim-apk` (válido 30 dias). Também roda ao criar uma tag `apk-*`.
O que o workflow faz: confere privacidade do git → monta o site público (`--frontend-only`) → `npm ci` e `cap add android` → `scripts/patch-android.mjs` (microfone, sem backup automático do Android, ícone, versão) → `gradlew assembleDebug` → varre o APK contra vazamento → guarda o artefato.

## Instalar
Baixe o `.apk` no celular, permita “instalar de fontes desconhecidas” para o navegador/gerenciador e instale. Depois abra o app (vem **vazio**) e importe o ZIP em *Pacote do aparelho*. O APK é assinado com chave de **debug** (serve para instalar direto; não serve para a Play Store).

## O que foi verificado de verdade
- `npm install` e `cap add android` / `cap sync` funcionaram localmente; os 4 plugins foram reconhecidos.
- `patch-android.mjs`: roda 2× sem duplicar, manifest continua XML válido.
- O adaptador `iris/voice/capacitor.js` passou em testes com plugins **simulados** (5 testes).
- O site que entra no APK passou nos testes sob CSP rígida e offline (Chromium).

## O que NÃO foi verificado (riscos)
- **Compilação Gradle** e o APK em si (nunca rodou).
- `@capacitor-community/speech-recognition` 7.x com Capacitor 8: o pacote declara compatibilidade (`>=7`), mas não foi compilado. Se o build falhar por causa dele, remova-o de `capacitor/package.json`: o app continua funcionando por digitação.
- Voz, microfone, salvar/compartilhar arquivos, link do WhatsApp e importar ZIP **dentro do Android real**.
- Ícone sem versão adaptativa; sem tela de abertura personalizada.
