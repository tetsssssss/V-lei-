# Hospedagem gratuita (Cloudflare Pages) — a configurar depois

**Status: NÃO configurado e NÃO publicado.** Nada foi enviado ao Cloudflare. O repositório é público; o site publicado traz **só o código** (abre vazio).

## Passo a passo (quando quiser)
1. Cloudflare → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → este repositório.
2. **Build command:** `node scripts/build-packages.mjs dist --frontend-only`
3. **Build output directory:** `dist/frontend`
4. Variável de ambiente: `NODE_VERSION` = `22`
5. Salvar. A cada push na branch escolhida, o site é reconstruído.
O comando monta o site público (sem `seed/`, sem fotos, com CSP) e **falha** se achar dado privado (`leak-scan`). O arquivo `_headers` gerado (CSP, `nosniff`, sem referrer) é lido pelo Cloudflare Pages.

## Depois de publicar
Abra o endereço no celular (HTTPS), “Adicionar à tela inicial”, e importe o ZIP em *Pacote do aparelho*. A voz do navegador precisa de HTTPS e Chrome.

## Cuidados
- Site estático **não protege dados**: nunca coloque a lista de convidados no site. O ZIP privado só vai para o aparelho, nunca para o repositório/hospedagem.
- Cloudflare Pages (plano gratuito) não exige cartão para sites estáticos; confira os limites atuais no painel.
