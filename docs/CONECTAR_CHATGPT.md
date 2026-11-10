# Conectar a Íris à OpenAI (ChatGPT)

**Importante:** a assinatura do ChatGPT (Plus/Pro) **não** dá acesso para outros apps. A Íris usa a **API da OpenAI**, com chave própria e cobrança por uso (consulte os preços atuais no site). Nunca cole a chave no chat nem no código.

1. Em platform.openai.com crie uma chave de API (e defina um limite mensal de gasto).
2. No computador: `cp server/.env.example server/.env` e preencha:
   ```
   IRIS_PASSCODE=<senha só de vocês>
   IRIS_TOKEN_SECRET=<openssl rand -hex 32>
   IRIS_LLM_PROVIDER=openai
   OPENAI_API_KEY=<sua chave>
   IRIS_LLM_MODEL=<nome do modelo, conforme a lista atual da OpenAI>
   ```
3. `node server/server.mjs` e abra http://localhost:8080. Se faltar algo, *Configurações → Privacidade e dados* mostra o NOME da variável que falta.
4. No app: Configurações → entrar com a senha → ligar "Usar IA externa" → escolher o nível de dados (0 = só totais, é o padrão).
5. Fale algo que o modo local não entende (ex.: "me ajuda a decidir entre dois fornecedores"). A IA **propõe** ferramentas; o app executa localmente e **continua pedindo confirmação** para qualquer alteração (adicionar, editar, excluir).

Para usar no celular fora de casa o backend precisa estar hospedado (ver COMO_RODAR_A_IRIS.md, seção 4) com as mesmas variáveis no painel do Netlify.
**Status:** o adaptador foi testado contra um servidor falso; ainda não contra a OpenAI real (sem chave aqui). Se algo falhar na 1ª conexão, me diga a mensagem.
