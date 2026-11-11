# Privacidade, LGPD e imagens

## O que fica onde
| Dado | Onde fica | Sai do aparelho? |
|---|---|---|
| Planejamento (orçamento, convidados, fornecedores...) | `localStorage` do navegador (chave `nosso-sim-ateliê-v1`) | Não. Só via backup JSON que **vocês** exportam. |
| Estado da Íris (preferências, conversa, memória, auditoria) | `localStorage`, chave separada `nosso-sim-iris-v1` | Não. |
| Fotos dos padrinhos importadas | IndexedDB (`nosso-sim-fotos`) | **Nunca**: nem backup JSON, nem backend, nem IA. |
| Áudio da voz | **Não é gravado nem guardado** pela Íris | No modo navegador, o Chrome envia ao serviço de voz dele (Google) para transcrever. Aviso e consentimento antes do 1º uso. |
| Texto enviado à IA externa (opcional) | Só se vocês ligarem e entrarem no backend | Mínimo necessário, por nível (0 totais · 1 + nomes de fornecedores/ideias/tarefas · 2 + nomes de convidados). **Fotos nunca.** |

## V3.1 — o que fica onde
| Dado | Onde fica | Sai do aparelho? |
|---|---|---|
| Telefones, envio/resposta de RSVP, parcelas, cronograma, planta (medidas e objetos) | dentro de `data.v31` no mesmo `localStorage` do planejamento (entra no backup JSON) | Só se você exportar |
| **Print da chácara** (imagem) | IndexedDB `nosso-sim-v31` (bytes **fora** do backup JSON; vão só no **ZIP**) | Só se você exportar o ZIP |
| Link do WhatsApp | montado localmente; abrir envia o **texto** ao WhatsApp (app de terceiros) quando **você** toca em enviar | Sim, para a pessoa escolhida, por ação sua |
| Exportações para a cerimonialista | arquivo gerado no aparelho; **sem telefones e sem R$ por padrão** | Só como você compartilhar |
| IA redigindo (opcional) | só o **texto dos achados** (sem ferramentas e sem nomes de convidados); exige IA externa ligada e nível ≥ 1 | Sim, ao backend, se ligado |

### O que ainda está no código público (decisão sua)
O repositório e o site/APK públicos **não** trazem convidados, padrinhos, fotos, telefones nem medidas. **Mas** o código ainda contém: os nomes do casal (Gabriel e Isabelle), a data de referência, a cidade, o nome/endereço/telefone comercial da Chácara Veneza (listagem pública do local), a lista de presentes e o catálogo de doces. Se quiser site/APK 100% neutros, é preciso trocar isso por padrões genéricos (e dados vindos só do ZIP). Diga e eu faço.

## Controles
Revogar a autorização de voz; apagar histórico; ver/corrigir/apagar a memória; retenção do histórico (não guardar / 7 / 30 dias / até apagar); desligar IA externa; sair do backend. Nada é guardado em áudio, então não há "histórico de áudio" a configurar.

## Regras que o código cumpre (e os testes verificam)
- Sem biometria: a Íris **não identifica pessoas por rosto**; mostra só a legenda que vocês atribuíram à foto. Crianças nas fotos não viram padrinhos.
- Presença "Confirmado" só quando vocês dizem diretamente; nunca por foto ou planilha antiga.
- Nenhum envio externo, pagamento, compra ou contratação é feito pela Íris.
- O app não carrega nada de terceiros (sem CDN, fontes ou analytics). O pacote público tem **CSP** (script inline liberado por hash).
- Chaves só no backend, via variáveis de ambiente. O navegador guarda apenas um **token de sessão** em `sessionStorage` (apagado ao sair).

## Publicar sem vazar
O repositório GitHub deste projeto é **público**. Por isso:
- `seed/`, `private/`, `assets/casal/`, `assets/padrinhos/`, PDFs e backups estão no `.gitignore` e **nunca** foram commitados.
- `node scripts/leak-scan.mjs --tracked` e o `build-packages.mjs` falham se acharem nomes reais (lidos do seed local em tempo de execução), arquivos privados por hash, chaves ou caminhos proibidos.
- Só o ZIP **DEPLOY_FRONTEND_PUBLICO** deve ser hospedado. O ZIP privado é só para vocês.
- Atenção: o site da versão V2.1, se já foi publicado, **embutia** a lista de convidados no `index.html`. Retirem essa publicação.
- Um site estático **não protege dados**: nunca coloquem a lista de convidados num deploy público. Para compartilhar entre os dois celulares com segurança, o próximo passo é login + banco com regras de acesso (ver STATUS_NAO_ATIVO.md).
