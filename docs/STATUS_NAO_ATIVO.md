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
| APK Android (WebView + voz nativa) | 🟡 | Compila, é assinado e passa na verificação estrutural (manifest, permissões, conteúdo, assinatura). **Nunca foi executado em aparelho ou emulador.** O lado JavaScript da ponte foi testado com uma ponte simulada. Pode haver falhas só visíveis no Android real |
| APK na Play Store | ❌ | Assinatura própria e ícone sem versão adaptativa; serve para instalar direto (sideload) |
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
| **V3.1** · Convites e RSVP por WhatsApp (link `wa.me`, registro manual da resposta) | ✅ | Testado (unitário + e2e). O app **não envia** nada: abre o WhatsApp e você toca em enviar. O WhatsApp real **não** foi aberto nos testes (rota bloqueada) |
| **V3.1** · Parcelas e vencimentos | ✅ | Centavos exatos, pago↔item reversível, vencidas/próximas |
| **V3.1** · Planta: print + escala calibrada, mesas, mesa de frios, zonas desenhadas | ✅ | Testado com um print **sintético**; arrastar com mouse real do Chromium. **Não testado com toque real no celular** nem com o print verdadeiro da chácara (você ainda não o forneceu) |
| **V3.1** · Vista 3D isométrica, dia/noite, pôr do sol | ✅/🟡 | Renderização e “noite mais escura” medidas no PNG; aparência avaliada em capturas de tela. Sombras/luzes são **ilustrativas** (norte desconhecido). Pôr do sol = estimativa (±5 min) com coordenadas **aproximadas da cidade** |
| **V3.1** · Cronograma do dia | ✅ | Modelo sugerido (editável) sem conflitos nem passagem da meia-noite |
| **V3.1** · Exportações (dossiê HTML, CSV, PNG, ZIP) | ✅ | Padrão sem telefones e sem R$ (verificado no conteúdo gerado). Impressão para PDF depende do navegador |
| **V3.1** · Cerimonialista Virtual (regras) | ✅ | Só regras sobre os dados cadastrados; **não** sabe nada da chácara real. Folga mínima entre mesas é número de bolso configurável (1,0 m), **não** medida do local |
| **V3.1** · Cerimonialista: IA só redige | 🟡 | Testado contra o backend **mock** (consentimento, sem ferramentas, sem nomes). Nunca testado com IA real |
| **V3.1** · Importar/exportar ZIP no aparelho | ✅ | Testado: ZIP exportado pelo app, ZIP real do utilitário `zip`, ZIP no formato privado (seed) fictício, ZIP malicioso/corrompido recusado. As 4 fotos de capa do casal **não** são importadas pelo ZIP |
| **V3.1** · PWA (site estático, offline) | ✅ | Testado em Chromium com CSP rígida e offline. Cloudflare Pages **não configurado** (ver `HOSPEDAGEM_CLOUDFLARE.md`) |
| **V3.1** · APK via Capacitor + GitHub Actions | 🟡 | Projeto Android gerado e ajustado localmente; **o APK nunca foi compilado** (sem Android SDK aqui) nem executado em aparelho. Plugin de voz da comunidade (v7) com Capacitor 8 sem compilar. Ver `APK_CAPACITOR.md` |
| Sincronização entre celulares, login por pessoa | ❌ | Continua não existindo (dados por aparelho; mover = ZIP) |
