# Relatório de mudanças — Nosso Sim V3.0 (assistente Íris)

Escrito com a regra do prompt: **nada aqui é declarado como testado se não foi executado**. Onde o teste usou voz simulada ou serviço falso, está dito.

## 1. Resumo
O app V2.1 foi preservado e ganhou: assistente de voz **Íris** (nome configurável), 40 ferramentas sobre o estado real (as 26 do prompt + 14 extras: 22 de leitura, 7 reversíveis leves, 7 reversíveis relevantes e 4 sensíveis), com confirmação por risco, desfazer e auditoria, **Central de comando** com 9 painéis, **painéis vivos** na tela de voz, fotos dos padrinhos (vínculo, recorte, enquadramento), temas **Romântico** e **Jarvis**, backend opcional (IA/voz premium) e empacotamento com verificação de vazamento.
Sem dependências de runtime: JS puro (≈245 KB sem minificar, **≈81 KB gzip** com o CSS) + backend Node sem pacotes.

## 2. Decisões que moldaram a entrega
| Decisão | Efeito |
|---|---|
| **O repositório GitHub é público** (você confirmou: só código + dados fictícios) | Seeds reais (44 convites, padrinhos), fotos, PDFs e a mensagem-surpresa saíram do código e vivem em `seed/`, `private/`, `assets/` (no `.gitignore`). O `index.html` público não contém nomes de terceiros. |
| Despesa hipotética **fora dos totais** (você confirmou) | `hypothetical:true`, selo "Hipótese", linha separada; a Íris diz "saldo sem/com hipóteses". |
| Jarvis + dashboards bonitos são centrais (seu feedback) | Orbe-íris, modo "espiar", Central de comando, tema Jarvis. |
| Couple names/data/chácara/catálogo Elizete/presentes ficaram no código | São dados do próprio casal/comerciais. *Avise se quiser anonimizar.* |

## 3. O que mudou
### Novos (resumo; ver árvore do repositório)
- `iris/core/` — `text` (números por extenso, R$, datas, comandos compostos), `intents` (motor local), `tools` (40 ferramentas), `risk`, `audit` (desfazer por operações inversas), `memory`, `store`, `schema`, `briefing`, `specialists`.
- `iris/voice/` — `mic`, `stt`, `tts`, `session` (estados), `remote` (backend opcional).
- `iris/ui/` — `panel` (tela de voz), `orb`, `settings`, `charts` (SVG próprio), `live-panels`, `dashboard`, `padrinhos-fotos`, `dom`.
- `iris/themes.css`, `iris/iris.css`, `iris/boot.js`.
- `server/` + `netlify/` — backend sem dependências (auth por senha→token HMAC, limite de taxa, CORS, adaptadores Anthropic / OpenAI-compatível / mock).
- `scripts/` — `extract-seed`, `leak-scan`, `build-packages`.
- `tests/` — unitários, servidor, e2e (Playwright), roteiro de teste no telefone. `docs/` — este relatório, README, privacidade, status.

### Modificados
| Arquivo | Mudança |
|---|---|
| `index.html` | Edições cirúrgicas (lista fechada): seeds pessoais → `window.NS_SEED` (arquivo privado); mensagem-surpresa pessoal → seed; `onerror` nas fotos opcionais; `sums()` ignora hipóteses (+ selo); ponte `window.NossoSim`; registro de seções extras + ganchos pós-render; eventos `nossosim:ready`/`data-replaced`; `data-couple-id` nos padrinhos + texto sem nomes; formulário de convidado com adultos/crianças validados; aviso de "Primeiro acesso"; `padrinhoFotos`, `nameEquivalences`, `sourceNotes` (aditivos); tags dos scripts/CSS. De 123 KB para 112 KB (os dados saíram). |
| `sw.js` | Cache `nosso-sim-v3-0-iris`; instalação resiliente (`allSettled`); ignora `/api/`. |
| `manifest.webmanifest` | Atalho "Conversar com a Íris" (`?iris=1`). |
| `LEIA-ME.txt` | Seção V3.0. |

## 4. Dependências, migrações e preservação
- **Runtime: nenhuma.** Testes usam o Playwright/Chromium já instalado no ambiente.
- **`localStorage` legado `nosso-sim-ateliê-v1` preservado** (mesma chave, mesma estrutura). Campos novos são **aditivos** (`padrinhoFotos`, `nameEquivalences`, `sourceNotes`, `hypothetical`, `author`); `normalize()` os completa sem apagar nada. A migração v1→v2 e export/import têm testes.
- O estado da Íris usa chave **separada** (`nosso-sim-iris-v1`) e não polui o backup. Import/reset invalida o "desfazer" antigo.
- O ZIP original V2.1 está **intacto** em `private/pacote_original/` (só no pacote privado). Nenhum ZIP anterior foi sobrescrito.

## 5. Riscos do baseline (Fase 0) e destino
| Risco | Destino |
|---|---|
| Dados pessoais de terceiros embutidos no `index.html` | **Corrigido** (seed externalizado + scan). Se o V2.1 já foi publicado, retirem. |
| Nomes conflitantes entre listas (convidados × padrinhos × fotos) | **Só sinalizado** (`nameEquivalences`, vínculos "sugerido"); nada mesclado. |
| Contagens divergentes entre fontes | Aviso permanente na Íris e no painel de convidados. |
| Form de convidado não mantinha adultos/crianças | **Corrigido** + validação. |
| `sw.js` falhava a instalação sem as fotos | **Corrigido** (testado no pacote público). |
| Teto 0 → "saldo" sem sentido | A Íris diz "teto não definido". |

## 6. Falhas que os testes e a inspeção visual acharam durante o desenvolvimento (todas corrigidas)
Número por extenso "quatro e cinquenta" lido como 54 · `\b` não separava `ANTHROPIC_API_KEY` no scanner (**buraco no scanner**, achado pelo autoteste do scanner) · `"type":"module"` no `package.json` quebrava os módulos UMD · tabelas de acessibilidade ocultas criavam rolagem horizontal · **cartão de confirmação coberto por um painel no celular** · microfone cortado no modo "espiar" · modo conversa nunca engatava no 1º toque · textos do centro dos gráficos estouravam · dourado dos gráficos com contraste 2,57:1 (mín. 3:1) · o orbe parecia um olho humano (redesenhado) · fibras com *moiré*.

## 7. Testes executados (todos passaram na última rodada)
| Suíte | Resultado | O que prova | Real ou simulado |
|---|---|---|---|
| Unitários (texto, motor, ferramentas, gráficos, contraste WCAG, PWA, scanner) | 56 | Lógica, números, risco, confirmação, desfazer, contraste dos 2 temas, scanner pega vazamentos plantados | Real (Node) |
| Servidor | 14 | Auth, token, limite de taxa, CORS, validação, **segredos não vazam em respostas nem logs**, caminhos bloqueados, formato das requisições aos provedores | Real; provedores = mock/servidor **falso** |
| Baseline do V2.1 (`baseline.mjs`) | **38/38 no original e 38/38 no app novo** | Nada do que funcionava quebrou (13 seções, CRUD, dedupe fornecedor→orçamento, doces, backup, migração v1, sem rolagem horizontal nos 5 tamanhos) | Real |
| Íris e2e | 70 | Abrir, permissão, consentimento, texto↔voz mantendo contexto, hipótese→cancelar→confirmar→desfazer com recarga, barge-in, erros, 5 viewports | UI real; **STT/TTS simulados** |
| Padrinhos | 12 + 8 | Importar/enquadrar/trocar/remover; bytes fora do backup; **8 checagens com o seed privado real** (12 pares + 2 entradas, 5 fotos, 44 convites = 102 pessoas) | Real |
| Central de comando | 26 | Cada painel confere com o estado; tabelas acessíveis; sem estouro em 5 tamanhos × 2 temas | Real |
| UX/acessibilidade | 24 | Teclado, foco preso, Esc, nomes acessíveis, voz/velocidade/tema/nome, modo conversa, memória, retenção, nenhum áudio guardado | UI real; voz simulada |
| Backend + IA externa e2e | 18 | Login, minimização por nível (nomes só no nível 2), a IA propor excluir **não** executa sem toque, STT remoto com **microfone falso real** + MediaRecorder, nenhuma chave no navegador | Real; "IA" = mock |
| Pacote **público** | 16 | CSP efetiva (script injetado bloqueado), abre vazio, PWA instala sem fotos, **offline**, atalho, fluxos sob CSP | Real (Chromium) |
| Build | 3 ZIPs | `leak-scan` limpo no deploy e no backend | Real |

**Total: 282 verificações.** Prints reais do layout (Chromium, não de aparelho Android) em `docs/prints/` (dados fictícios); versão com seus dados reais só em `private/prints_reais/` no pacote privado.

## 8. NÃO executado / pendente (não declarado como feito)
- **Microfone, reconhecimento e voz reais num celular Android**: o critério central do prompt só pode ser comprovado por vocês. Roteiro exato: `tests/roteiro_teste_telefone.md`.
- **IA, STT e TTS com chave real**: nenhuma chave existe neste ambiente. Os adaptadores passaram contra um servidor "upstream" falso, não contra Anthropic/OpenAI.
- Desempenho em aparelho (FPS do orbe, bateria): não medido. As animações usam só `transform/opacity` e há opção de reduzir.
- Qualidade/gênero da voz do aparelho: depende do Android; o app não consegue garantir "feminina".
- PWA instalado no Android e Samsung Internet/Firefox/Safari: não testados.

## 9. Limitações reais
Dados locais por aparelho (sem sincronização); voz só no Chrome e em https/localhost; o STT do Chrome envia áudio ao Google (há consentimento); sem wake word, sem barge-in por voz, sem login por pessoa nem PIN; o motor local entende um conjunto grande, mas **finito**, de frases — fora dele, pergunta de volta ou usa a IA externa, se configurada; "especialistas" são regras e sugestões curadas (não LLM); enquadramento padrão das fotos é um palpite para capturas de tela (ajustável por foto).

## 10. Autoauditoria (seção 13 do prompt)
| Pergunta | Resposta |
|---|---|
| A voz realmente ouve? | O código usa `SpeechRecognition` real e foi exercitado com **stub** e, no modo remoto, com **microfone falso do Chromium**. Audição real: **pendente no telefone**. |
| A resposta realmente é falada? | `speechSynthesis` real no código; testado com stub. Voz real: pendente no telefone. |
| O botão de microfone foi testado ou só desenhado? | Testado de ponta a ponta (permitir/negar, ouvir, interromper, enviar) com voz simulada; tamanho ≥48 px verificado em 5 viewports. |
| As ações modificam o estado persistente ou simulam? | Modificam o `localStorage` real; verificado com recarga da página. |
| A IA tem acesso só ao que precisa? | Contexto mínimo por nível; nomes só no nível 2; fotos nunca; resultado de ferramenta com nomes é omitido nos níveis baixos (testado). |
| O app preserva os saves? | Sim: mesma chave, campos aditivos, migração v1 testada, original intacto. |
| Tela pequena? | 360×800, 390×844, 412×915, 430×932 e 1440: sem rolagem horizontal, mic/campo visíveis, tela de voz, Central e todas as seções. |
| Serviço pago não configurado é explicado? | "IA externa não configurada" na tela, no `/health` e nos docs. |
| Há afirmações indevidas de contrato/RSVP? | Não: "Pesquisando ≠ contratado", simulação rotulada, presença "Confirmada" só por afirmação direta, data tratada como referência. |
| Foi entregue código de verdade? | Sim: 3 pacotes + código no GitHub. |

## 11. Estado do GitHub
Código público-seguro enviado para a branch `claude/peaceful-lovelace-ak2wd7`. **O PR draft não pôde ser criado**: o repositório remoto está vazio (sem `main`), então não há branch-base. Crie a `main` (por exemplo, adicionando um README pelo site do GitHub) e abra o PR dessa branch, ou me diga outra base.

## 12. Adendo: APK Android
- **Entregue:** `NossoSim-Iris-v3.0.0-PRIVADO.apk` e `…-PUBLICO.apk` (mesma assinatura), construídos por `scripts/build-apk.mjs` com `aapt`, `javac`, `dx`, `zipalign` e `apksigner` (pacotes do Ubuntu, sem o SDK completo da Google, que estava bloqueado aqui).
- **Arquitetura:** WebView sem dependências servindo os arquivos do APK em `https://appassets.androidplatform.net` (contexto seguro); como o WebView **não tem Web Speech**, a voz usa `SpeechRecognizer` e `TextToSpeech` nativos do Android via `window.IrisAndroid`; salvar backup em Downloads; botão voltar; seletor de arquivos; atalho do ícone; navegação restrita à própria origem; `allowBackup=false`; sem tráfego em texto puro; só as permissões `RECORD_AUDIO` e `INTERNET`.
- **Verificado:** assinatura (`apksigner verify`), manifest/permissões/SDK (`aapt dump`), presença de classes e assets no dex/APK, scan anti-vazamento no APK público (e confirmação de que o scanner **reprova** o privado), 13 verificações do JS da ponte com **ponte simulada**.
- **NÃO verificado:** o Java **nunca rodou** (sem emulador/aparelho). Riscos conhecidos: comportamento do `SpeechRecognizer` conforme o fabricante e o app Google instalado; `onShowFileChooser`/permissões em versões específicas; ícone sem versão adaptativa. Compilado contra a API 23 (único `android.jar` disponível) com `targetSdk 34`.
- O variante PRIVADO embute dados pessoais no arquivo: é para uso dos dois, nunca para publicar.


---

# V3.1 — convites, planta, parcelas, cronograma, Cerimonialista Virtual, PWA e APK (Capacitor)

Regra mantida: **nada aqui é declarado como testado se não foi executado**; “simulado” está dito.

## 1. O que foi entregue
| Pedido | Onde | Estado |
|---|---|---|
| Convidados e RSVP via WhatsApp (local) | `v31/core/rsvp.js`, tela *Convites · WhatsApp* | ✅ testado (WhatsApp real **não** aberto) |
| Chácara em planta: print + escala calibrada, mesas, mesa de frios, vista isométrica, dia/noite | `v31/core/{geo,plan,solar}.js`, `v31/ui/planta.js` | ✅ testado com print **sintético** |
| Parcelas e vencimentos | `v31/core/installments.js`, tela *Parcelas e vencimentos* | ✅ |
| Cronograma do dia | `v31/core/schedule.js`, tela *Cronograma do dia* | ✅ |
| Exportações para a cerimonialista | `v31/core/exports.js` (dossiê HTML, CSV, PNG, ZIP) | ✅ |
| Cerimonialista Virtual (regras; IA só redige) | `v31/core/ceri.js`, `Iris.remote.draft` | ✅ regras · 🟡 IA só com **mock** |
| App abre vazio e importa o ZIP privado no aparelho | `v31/core/zip.js`, `v31/ui/kit.js` (tela *Pacote do aparelho*) | ✅ |
| PWA | `sw.js` (cache v3.1), `build-packages.mjs --frontend-only` | ✅ Chromium, CSP, offline |
| APK via Capacitor no GitHub Actions | `capacitor/`, `.github/workflows/android-apk.yml`, `iris/voice/capacitor.js` | 🟡 **APK nunca compilado** |
| Hospedagem Cloudflare Pages | `docs/HOSPEDAGEM_CLOUDFLARE.md` | só documentado, **não configurado** |

Preservação: `index.html` só ganhou tags `<script>`/`<link>` (e o `capacitor.js`); **nenhuma** função antiga foi alterada. Os dados novos vivem em `data.v31` (aditivo; `normalize()` já preserva chaves extras). As suítes antigas continuam passando (seção 3).

## 2. Decisões e o que NÃO foi presumido (regra 2)
- **Nenhuma medida/capacidade da Chácara Veneza foi inventada.** A planta só tem metros depois que o usuário calibra o print (2 pontos + distância real) ou informa a área; sem escala, o app **recusa** criar objetos (testado). Zonas (cerimônia, pista, cobertura…) só nascem de retângulo **desenhado** pelo usuário.
- Mesas/bar/palco vêm com tamanho **sugerido e rotulado** (“não é medida do seu fornecedor”); ao editar, o selo some.
- “Folga mínima entre mesas” (1,0 m) é **regra de bolso configurável**, rotulada como tal.
- Coordenadas do pôr do sol: **aproximadas da cidade**, editáveis. Resultado conferido contra referência independente (São Paulo ≈18:22 + ~10 min de longitude ⇒ ≈18:32; calculado 18:35).
- WhatsApp: o app só monta `wa.me`; **não envia**. “WhatsApp aberto” ≠ “mensagem enviada”. Presença só muda quando o usuário registra a resposta.

## 3. Testes executados (última rodada)
| Suíte | Resultado | Real ou simulado |
|---|---|---|
| Unitários (`npm test`) | 94 ok, 1 pulado (já existia) — **24 novos** (núcleo V3.1 e adaptador Capacitor) | Node real; Capacitor com plugins **simulados** |
| **V3.1 e2e** (`tests/e2e/v31.mjs`) | **65/65** no código-fonte **e** 64/64 no pacote público (CSP) | Chromium real: arrastar com mouse, calibrar, importar/baixar arquivos de verdade; **print sintético**, WhatsApp bloqueado |
| PWA no pacote público (`pwa.mjs`) | 17/17 (inclui as telas V3.1 **offline**) | Chromium real |
| Regressão: baseline V2.1 · Íris · Central · UX · padrinhos · ponte Android | 37/37 · 70/70 · 26/26 · 24/24 · 12/12 · 13/13 | Voz simulada, como antes |
| Backend + IA externa | 21/21 (+3 novos: IA só redige, consentimento, sem ferramentas, sem nomes) | Servidor real, **IA = mock** |
Nota de ambiente: neste checkout faltam os arquivos privados (`seed/`, fotos), o que gera 404 e reprova só o item “sem erros de console” das suítes antigas (já era assim antes da V3.1: baseline 36/37). Com stubs vazios nesses caminhos (ignorados pelo git, apagados depois), **todas** passaram.
Prints das telas: gerados durante o desenvolvimento (não commitados: `.png` está no `.gitignore` por privacidade).

## 4. Falhas que os testes/inspeção acharam e foram corrigidas
`toMin` aceitava “25:99” · `ensure()` recriava `data.v31` (referências ficavam velhas → remover parcela paga não devolvia o valor) · o módulo da planta só recebia a ponte ao abrir a tela (exportar o dossiê antes quebrava) · **o dossiê “sem valores” vazava um R$ na seção de achados** · texto “null” solto na barra do 3D (`append(null)`) · o **modelo de cronograma gerava conflitos** e “dava a volta” na meia-noite · cerimônia às 18:00 embaralhava a ordem · na vista 3D de um terreno grande as mesas ficavam minúsculas (ganhou “Focando nas mesas”/zoom) · botão duplicado “Exportar ZIP” (título × botão) no teste.

## 5. NÃO executado / pendente
- **APK**: nunca compilado nem executado (ver `APK_CAPACITOR.md`). Voz, microfone, compartilhar arquivo, WhatsApp e importar ZIP no Android real: **não testados**.
- **Print verdadeiro da chácara e medidas reais**: ainda não fornecidos; toda a planta foi exercitada com imagem fictícia.
- **Toque (celular) para arrastar/zoom** na planta: testado só com mouse e viewport de celular, não com dedo.
- **Cloudflare Pages**: não configurado. **IA real**: não testada. Desempenho em aparelho: não medido.
- Fotos de capa do casal (`assets/casal/`) não entram pelo ZIP.

## 6. Estado do GitHub (regra 3)
Branches: o trabalho está na branch da sessão (`ccr-2f1349ca-0wbz8s`) e na `claude/peaceful-lovelace-ak2wd7`, que você indicou. **O remoto continua sem `main`**; por isso **nenhum PR foi criado** (você pediu para criar a `main` ou abrir contra a branch que indicar apenas quando pedir PR).

## 7. Ideias extras (separadas do pedido, por ordem de benefício)
1. Neutralizar o site/APK público (nomes, data, chácara) lendo tudo do ZIP — hoje restam no código (ver `PRIVACIDADE.md`).
2. Passar a planta a ser editável por toque com “pinça” e menu de alças (girar/redimensionar arrastando).
3. Importar contatos do celular para preencher telefones (com permissão), em vez de digitar.
4. Lista de “quem trazer/quem fornece” por mesa (ex.: mesa de frios com responsável e horário de montagem) ligada ao cronograma.
5. Aviso de chuva/previsão do tempo na semana do casamento (exige internet; opt-in).
