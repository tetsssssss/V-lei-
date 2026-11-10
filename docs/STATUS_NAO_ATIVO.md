# Registro do que NÃO está ativo (e do que é concreto)

Legenda: ✅ implementado e testado · 🟡 implementado, **não** verificado contra o serviço real · ❌ não existe

| Item | Estado | Detalhe |
|---|---|---|
| Voz local (STT/TTS do navegador), orbe, push-to-talk, interrupção por toque | ✅ | Testado com voz **simulada**; teste físico no telefone: ver `tests/roteiro_teste_telefone.md` |
| Ferramentas sobre o estado real, confirmação por risco, desfazer, auditoria | ✅ | Unitários + e2e |
| Central de comando e painéis vivos | ✅ | |
| Fotos dos padrinhos (vínculo, recorte, enquadramento) | ✅ | Local ao aparelho |
| PWA offline (casca do app) | ✅ | Testado em Chromium; voz **não** funciona offline |
| IA externa (Anthropic / compatível OpenAI) | 🟡 | Verificado contra upstream falso; **sem chave real não houve teste** |
| STT e TTS premium via backend | 🟡 | Idem. O STT remoto foi exercitado com microfone falso do Chromium + backend mock |
| Sincronização entre celulares | ❌ | Os dados são locais por aparelho. Mover = exportar/importar JSON. Próximo passo: login + banco com regras de acesso |
| Login por pessoa (Gabriel/Isabelle) | ❌ | Há só o seletor "falando como" (sem biometria de voz). Senha do backend é compartilhada |
| Wake word "Íris" | ❌ | PWA não escuta em segundo plano; reconhecimento contínuo gasta bateria e envia áudio ao Google |
| Barge-in por voz (interromper falando) | ❌ | Risco de eco/microfonia; só por toque |
| Histórico de áudio | ❌ | Por design, áudio não é guardado |
| Integração com calendário | ❌ | |
| Envio de mensagens, pagamentos, compras, contratações | ❌ | **Nunca** serão feitos pela Íris |
| Comparação real de 10 lojas por SKU | ❌ | Há só referências pontuais com fonte/data; a Íris não inventa "média" |
| Autenticação/PIN para ações sensíveis | ❌ | Ações sensíveis exigem toque; não há PIN |
| Fotos nos backups JSON | ❌ | Backup leva vínculo/enquadramento, não os bytes |
| Voz "feminina" garantida | ❌ | O navegador não informa gênero; é estimativa pelo nome + escolha manual |
