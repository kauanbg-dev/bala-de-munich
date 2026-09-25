# Bala de Munich

Site do time de Pro Clubs (EA FC) na Super Copa dos Streamers: elenco, chave, tabela, stats, votação de MVP e lives.

**Ao vivo:** [balademunich.vercel.app](https://balademunich.vercel.app/)

## O que tem

- Páginas por seção (home, confrontos, tabela, stats, elenco, tática, jogos, amistosos, feed, sociais, lives)
- Tabela e chave com sync da Copa dos Streamers (`/api/copa`)
- Urna de MVP com painel admin (`/mvp`)
- Lives do elenco (Kick / Twitch)
- Feed do Instagram do time

## Stack

- HTML, CSS e JavaScript
- API serverless na Vercel (`/api/*`)
- Redis / KV para votos do MVP (produção)

## Como rodar

```bash
npm install
npm start
```

Ou, no Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

## Deploy (Vercel)

1. Importa o repo na Vercel (Framework: **Other**, sem build)
2. Variáveis úteis:
   - `MVP_ADMIN_PIN` — PIN do painel admin da urna
   - Redis/KV (`KV_REST_API_*` ou `UPSTASH_REDIS_REST_*`) — votos persistentes
   - `FEEDFRAMER_KEY` / `IG_TOKEN` — opcionais, para o feed do Instagram

Sem Redis, os votos da urna não persistem entre cold starts.

## Editar conteúdo

Elenco, fotos e o que o sync da Copa não cobre ficam em `data.js`.
