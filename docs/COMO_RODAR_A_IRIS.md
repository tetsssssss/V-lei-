# Como rodar a Íris

A Íris é a assistente de voz do Nosso Sim. **Funciona sem internet de IA e sem conta paga**: o modo local entende comandos em português, lê e altera os dados do app (com confirmação) e responde falando, usando a voz do próprio navegador.

## 1. Requisitos reais da voz
| Item | Situação |
|---|---|
| Navegador | **Chrome (Android e computador)**. Outros navegadores: o reconhecimento pode não existir; o campo de texto faz tudo igual. |
| Página segura | A voz só funciona em **https** ou **localhost**. Abrir o `index.html` com duplo clique (`file://`) mostra o app, mas **sem microfone**. |
| Reconhecimento (STT) | Usa o serviço do navegador. **No Chrome o áudio passa pelo Google**; por isso há um aviso de consentimento antes do 1º uso. Precisa de internet. |
| Resposta falada (TTS) | `speechSynthesis` do aparelho. **A API não informa se a voz é feminina**: a lista mostra "feminina provável" (estimativa pelo nome). Escolham e ouçam a amostra. Sem voz em português instalada, o app avisa e usa a padrão. |
| Escuta em segundo plano / "Ei, Íris" | **Não existe.** O microfone só liga quando você toca no botão. |

## 2. No computador
```bash
node server/server.mjs
```
Abra **http://localhost:8080** no Chrome. (Node 20+; nenhuma dependência para instalar.)
Esse servidor serve o app **e** os arquivos privados do pacote completo (fotos/seed) só para você, em `127.0.0.1`.

## 3. No celular Android
**Opção A — publicar (recomendado para o dia a dia).** Envie o ZIP **`…_DEPLOY_FRONTEND_PUBLICO.zip`** ao Netlify Drop (ou outra hospedagem HTTPS). Esse pacote **não tem dados pessoais**: ele abre vazio.
1. No aparelho de origem: *Salvar backup* (JSON).
2. No celular: abra o endereço HTTPS no Chrome → **Importar backup JSON** (aviso "Primeiro acesso" no Início).
3. Fotos dos padrinhos: em *Padrinhos & entradas* → **＋ Foto** (ficam só nesse aparelho).
4. Opcional: menu ⋮ do Chrome → *Instalar app* (o atalho "Conversar com a Íris" aparece ao segurar o ícone).

**Opção B — testar do computador no celular (sem publicar).** Com depuração USB ativa:
```bash
adb reverse tcp:8080 tcp:8080
```
No Chrome do celular abra **http://localhost:8080** (para o Chrome, localhost é seguro).

**Permissão do microfone:** quando o Chrome perguntar, toque em *Permitir*. Se negou sem querer: cadeado ao lado do endereço → *Configurações do site* → *Microfone* → *Permitir*. Em app instalado: Android → Configurações → Apps → Nosso Sim → Permissões.

## 4. Backend opcional (IA e voz premium)
Nada disso é necessário. Sem ele a tela mostra **"IA externa não configurada"**.
```bash
cp server/.env.example server/.env     # preencha; NUNCA commite o .env
node server/server.mjs
```
- `IRIS_PASSCODE` + `IRIS_TOKEN_SECRET`: obrigatórios para qualquer rota além de `/health` (sem eles: 503).
- LLM: `IRIS_LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (modelo em `IRIS_LLM_MODEL`), ou `openai` (qualquer API compatível, `OPENAI_BASE_URL`). `mock` = respostas fixas, sem custo, só para testar.
- Voz premium: `IRIS_STT_PROVIDER` / `IRIS_TTS_PROVIDER` = `openai` (compatível) ou `mock`.
- No app: *Configurações → Privacidade e dados* → entrar com a senha → ligar "Usar IA externa" → escolher o **nível de dados** (0: só totais · 1: + nomes de fornecedores/ideias/tarefas · 2: + nomes de convidados). Fotos **nunca** são enviadas.
- **Netlify:** copie `server/`, `netlify/` e `netlify.toml`, configure as variáveis do `.env.example` no painel. O frontend precisa da linha `<meta name="iris-api" content="/api/iris">` no `<head>` (o servidor local já injeta).
- **Custos:** são cobrados **por uso pelos provedores que vocês escolherem**; consultem a tabela de preços atual de cada um. Este projeto não cobra nada e o modo local é gratuito.
- **Status honesto:** os adaptadores foram verificados contra um servidor "upstream" falso (formato de requisição/resposta). **Não foram testados contra os serviços reais** (não havia chaves neste desenvolvimento).

## 5. Falando com a Íris
Toque no botão grande de microfone (ou no ícone flutuante, em qualquer tela). Toque de novo para enviar; toque durante a fala dela para **interromper e já falar**. Exemplos: "quantos dias faltam?", "quanto falta organizar?", "mostre o saldo", "adicione despesa hipotética R$ 300" (ela mostra o que muda e pede confirmação), "desfaça", "mostra nossos padrinhos e me diga quanto ainda falta organizar", "quanto custam 250 doces de R$ 4,50?", "monta um cenário de 80, 100 e 120 convidados", "muda para o tema Jarvis", "para de falar", "repete mais devagar".
Ações **sensíveis** (excluir, mudar a data, fornecedor fechado, registrar pagamento) exigem **toque** no botão Confirmar; a voz sozinha não executa.

## 6. Solução de problemas de voz
| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "O microfone só funciona em páginas seguras" | Aberto por `file://` ou `http://` de outro host | Use https ou `localhost` |
| "O microfone está bloqueado" | Permissão negada | Cadeado → Configurações do site → Microfone → Permitir |
| "Este navegador não tem reconhecimento de voz" | Não é Chrome / WebView | Use o Chrome ou digite |
| "Sem conexão com o serviço de voz" | Sem internet (o STT do navegador precisa) | Conecte-se ou digite |
| Ela não fala | Sem voz pt-BR instalada, ou "Responder falando" desligado | Configurações → Voz; instale uma voz pt-BR no Android (Configurações → Idioma → Saída de texto para voz) |
| Fala cortando / robótica | Voz do aparelho | Escolha outra voz na lista; ou use voz premium via backend |
| "Não ouvi nada" | Silêncio ou ruído | Fale logo após tocar; use fone para reduzir eco |
| Eco / ela se ouve | Alto-falante + microfone | Use fones; barge-in por voz (sem tocar) **não** é ativado por padrão |

## 7. Testes
```bash
npm test            # unitários + backend (Node, sem dependências)
npm run test:e2e    # Playwright/Chromium (voz SIMULADA); ver tests/roteiro_teste_telefone.md para o teste físico
node scripts/build-packages.mjs <pasta>   # gera os 3 ZIPs e roda o scan anti-vazamento
```
