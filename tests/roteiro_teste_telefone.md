# Roteiro de teste FÍSICO no celular (o que os testes automáticos NÃO provam)

Os testes automáticos usam voz **simulada** (stubs). Só vocês podem confirmar o critério central: *falar no celular, ver o app responder, ouvir resposta, interromper, pedir alteração e confirmar*.
**Preparação:** Chrome no Android; app aberto por **https** (ZIP público no Netlify) ou `adb reverse tcp:8080 tcp:8080` + `http://localhost:8080`; fone de ouvido ajuda; volume de mídia alto. Anotem ✅/❌ e o modelo do aparelho.

| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Abrir o app, tocar no ícone flutuante | Tela de voz abre; ela diz a frase inicial (1ª vez) |
| 2 | Tocar no microfone grande | Aviso de consentimento → "Concordo" → pedido de permissão do Android → "Permitir" |
| 3 | Falar: "Íris, quantos dias faltam?" | Legenda mostra o que entendeu; ela responde **falando** (voz do aparelho) |
| 4 | Falar: "Íris, mostra nossos padrinhos e me diga quanto ainda falta organizar" | Abre Padrinhos (tela encolhe para "espiar"), mostra as fotos, diz o que falta |
| 5 | Durante a fala dela, tocar no microfone | Ela **para na hora** e já começa a ouvir |
| 6 | "Íris, adicione despesa hipotética R$ 300" | Mostra cartão antes/depois; **não grava** ainda |
| 7 | "Não, cancele" | Cancela; nada muda |
| 8 | Repetir o 6 e dizer "confirme" | Grava como hipótese (fora dos totais); "mostre saldo" cita as hipóteses |
| 9 | "Desfaça" | Remove; recarregar a página confirma que ficou removido |
| 10 | Negar a permissão do microfone (Config. do site) e tocar no mic | Mensagem explica como liberar; campo de texto continua funcionando |
| 11 | Modo avião e tocar no mic | "Sem internet"; digitar funciona |
| 12 | Em *Configurações → Voz*, ouvir a amostra de cada voz pt-BR | Escolher a que soa feminina; anotar o nome da voz |
| 13 | "Íris, repete mais devagar" / "para de falar" | Repete mais lento / para imediatamente |
| 14 | Isabelle repete 3, 6 e 8 trocando "Falando como" | Ações aparecem no histórico em nome dela |
| 15 | Instalar como app; segurar o ícone → "Conversar com a Íris" | Abre direto na assistente |
| 16 | Girar a tela, abrir o teclado no campo de texto | Sem sobreposição; orbe compacta; mic e campo visíveis |

**Se algo falhar**, anotem: aparelho, versão do Chrome, o que disseram, o que apareceu na tela e a mensagem de erro (se houver).
