# Nosso Sim V3.1 — guia dos recursos novos

Tudo roda **no aparelho**. Nada é enviado à internet (exceto o link do WhatsApp, que **você** toca para enviar).
Menu: *Convites · WhatsApp*, *Parcelas e vencimentos*, *Chácara em planta*, *Cronograma do dia*, *Cerimonialista Virtual*, *Pacote do aparelho*.

## 1. Convites e respostas pelo WhatsApp
1. Em cada convite, digite o telefone (DDD + número). O app confere o formato.
2. Toque em **Enviar pelo WhatsApp**: o app monta a mensagem (editável, com `{nome}`, `{casal}`, `{data}`, `{local}`, `{limite}`) e abre o WhatsApp. **Você** toca em enviar.
3. Quando a pessoa responder, toque em **Vai / Não vai / Talvez**. Só nesse momento a presença muda (“Confirmado” nunca é presumido).
- O app marca “WhatsApp aberto”, que **não prova** que a mensagem foi enviada; por isso o nome do botão de desmarcar.

## 2. Parcelas e vencimentos
Escolha o item do orçamento, o valor, o nº de parcelas e o 1º vencimento. Os centavos são divididos exatamente (1000 em 3 = 333,33 + 333,33 + 333,34). Marcar paga **soma** ao “pago” do item; “Desfazer pago” devolve. Parcela vencida / vencendo em 30 dias aparece em destaque e na Cerimonialista.

## 3. A chácara em planta
1. **Importe o print** do Google (satélite). A imagem fica só neste aparelho.
2. **Calibre a escala**: toque em 2 pontos cuja distância real você sabe (ex.: o comprimento do salão) e digite os metros.
   *(Ou, sem imagem, informe só a área em metros.)*
3. **Adicione** mesas (redonda, retangular, dos noivos), **mesa de frios**, doces, bar, palco. O tamanho vem como **sugestão rotulada** (você ajusta). **Áreas** (cerimônia, pista, cobertura…) você **desenha** arrastando; o tamanho vem das suas medidas.
4. Arraste as peças; use o painel para medidas exatas, giro, lugares e **sentar convites**. “Distribuir convites nas mesas” mantém cada convite junto.
5. **Vista 3D** com ☀ Dia / ☾ Noite, hora do dia, pôr do sol estimado, girar e aproximar. Sombras e luzes são **ilustrativas**.
6. Baixe PNG da planta e da vista 3D.

> O app **não presume** medida nem capacidade da Chácara Veneza. As medidas da chácara só existem depois que você calibrar o print ou informar a área.
> O pôr do sol usa coordenadas **aproximadas da cidade** (Agudos) e é estimativa (±5 min); dá para ajustar latitude/longitude (e a folga mínima entre mesas) na tela da Cerimonialista Virtual.

## 4. Cronograma do dia
Adicione momentos (início, duração, onde na planta, responsável). “Gerar modelo sugerido” parte do horário da cerimônia (ponto de partida, tudo editável). Conflitos de horário ficam marcados.

## 5. Cerimonialista Virtual
**Regras** (não é IA) conferem: mesas sobrepostas/fora da planta/pouca folga (folga mínima configurável, padrão 1,0 m — *regra de bolso, não medida da chácara*); lugares × confirmados/pendentes; mesa estourada; convites sem mesa; área coberta para chuva; conflitos e refeição no cronograma; cerimônia depois do pôr do sol; parcelas vencidas/próximas/soma diferente do item; convites sem telefone/prazo de resposta; fornecedores “Fechado” (pesquisar ≠ contratado).
**IA só redige**: se você ligar a IA externa (nível de privacidade ≥ 1), o botão reescreve os achados numa mensagem à cerimonialista. A IA recebe só o texto dos achados (sem ferramentas e sem nomes de convidados) e não decide nada.

## 6. Exportações para a cerimonialista
Dossiê imprimível (HTML → “Imprimir → PDF”), CSV de convidados/mesas/cronograma (Excel pt-BR), PNG da planta/3D, e **ZIP com tudo**. Por padrão **sem telefones e sem valores**; você marca se quiser.

## 7. Pacote do aparelho (ZIP)
O app abre **vazio**. Em *Pacote do aparelho* → **Escolher o ZIP** você importa:
- o pacote exportado por este app (`nosso-sim-backup.json` + print da planta + fotos), ou
- o pacote privado (`seed/seed-casal.js` + fotos de padrinhos em `assets/padrinhos/`).
O app **mostra o que achou** antes de substituir os dados. Recusa ZIPs com caminhos perigosos ou corrompidos. **Exportar ZIP** gera o pacote para levar a outro celular. O pacote tem dados pessoais: guarde bem, nunca publique.
Limite desta versão: as 4 fotos do casal da capa (`assets/casal/`) **não** são importadas pelo ZIP.
