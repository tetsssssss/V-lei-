// Função Netlify (v2): mesma lógica do servidor local. Configure as variáveis do .env.example no painel do Netlify.
import { readConfig } from '../../server/lib/env.mjs';
import { createApp } from '../../server/handlers/index.mjs';
const app = createApp(readConfig(process.env));
export default async (req, context) => app.handle(req, { ip: context && context.ip });
export const config = { path: '/api/iris/*' };
