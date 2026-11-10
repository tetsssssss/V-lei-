# Inventário baseline — Nosso Sim V2.1 (Fase 0)

> Documento público: **não contém nomes de convidados nem fotos**. Os dados reais ficam no pacote privado.

## Origem preservada
- ZIP recebido: `CASAMENTO_GABRIEL_ISABELLE_V2_1_CLAUDE.zip` (SHA-256 `7b7dd472…a6653a`). Copiado **intacto** para o pacote privado (`private/pacote_original/`). Nenhum arquivo original foi sobrescrito.
- Arquitetura: `index.html` único (~123 KB, JS vanilla numa IIFE), `sw.js`, `manifest.webmanifest`, `icons/`, `assets/casal/` (4 fotos).
- Persistência: `localStorage`, chave **`nosso-sim-ateliê-v1`** (versão do dado: 2). **Não há sincronização entre aparelhos.**

## Entidades do estado (`data`)
`settings, budget, guests, couples, sweetsQty, gifts, vendors, tasks, timeline, ideas`

| Entidade | Estado inicial no V2.1 |
|---|---|
| guests | 44 convites = 102 pessoas (83 adultos + 19 crianças), todos *Pendente* |
| couples | 14 = 12 pares de padrinhos + 2 entradas |
| vendors | 9, todos `quote: 0`, status *Pesquisando* (nenhum contrato) |
| sweetCatalog (código) | 101 itens (90 un. + 11 kg); mínimos 25/sabor, bolo 2 kg |
| gifts | 25 (7 com preço pontual; **não** é média de 10 lojas) |
| budget / ideas / timeline | vazios |

13 seções: início, nossa história, orçamento, convidados, padrinhos & entradas, catálogo de doces, presentes, chácara & atrações, fornecedores, cerimônia & tarefas, ideias & opiniões, consultores, personalizar.

## Suíte baseline (`tests/e2e/baseline.mjs`)
Resultado no **original intacto**: **38/38 ok** (Chromium headless, dados de teste fictícios injetados no `localStorage`).

Cobre: abertura sem erros de console e **zero requests externos**; as 13 seções renderizam; orçamento (criar/editar/excluir/persistir/rejeitar pago > planejado); convidados (status + busca); fornecedor → orçamento **sem duplicar** (3 cliques = 1 item); simulação de doces (250 × R$ 4,50 = R$ 1.125,00, sem virar orçamento); export/import JSON; migração do `localStorage` legado v1 → v2 preservando dados do usuário; ausência de rolagem horizontal nas 13 seções em 360×800, 390×844, 412×915, 430×932 e 1440×900.

## Riscos e pontos de atenção encontrados
1. **Dados pessoais de terceiros embutidos no `index.html`** (convites, padrinhos). Publicar como está expõe esses dados; o repositório GitHub é público. → Seeds externalizados para arquivo privado.
2. **Conflito de nomes entre listas** (convidados × padrinhos × fotos) e grafias variantes. → Apenas sinalizado; nunca mesclado.
3. **Contagem diverge entre fontes** (imagens: 102; planilha PDF antiga: base de 60 linhas e totais diferentes). → A Íris mostra a atual e avisa.
4. Formulário de convidado não mantém `adults/children` coerentes com `qty`. → Corrigido na Fase 2.
5. `sw.js`: `cache.addAll` falha por inteiro se qualquer asset der 404; cacheia qualquer GET same-origin (incluiria `/api/`). → Corrigido na Fase 4.
6. Teto de orçamento 0 → "saldo" não tem sentido; a Íris diz "teto não definido".
7. Import de backup v1 só migra no próximo carregamento (a baseline confirma que o carregamento migra e grava v2).
8. Nenhum acesso externo no app atual (sem `fetch`, sem CDN) — preservado: o modo local da Íris também não faz.

## Referência visual (para a Íris combinar)
Sidebar bordô `#4d303b`, texto creme, fundo `#fbf9f6`, títulos Georgia, acento dourado `#c49a65`, rosé `#a96974`, cartões brancos com raio 22 px.

## Fechamento (V3.0)
- A **mesma suíte baseline** roda hoje contra o app modificado: **38/38**, igual ao original. Registrado também no relatório de mudanças.
- Riscos 1–6 acima: tratados (ver `RELATORIO_DE_MUDANCAS.md`, seção 5). O risco 7 (import de um arquivo de backup v1) segue como observação **sem teste dedicado**: o que está testado é a migração do `localStorage` legado v1 no carregamento, que preserva os dados do usuário.
