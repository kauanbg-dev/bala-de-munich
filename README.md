# Bala de Munich

Site do time de Pro Clubs no EA FC 26. Elenco, chave da Super Copa dos Streamers, stats e votação de MVP.

A página em si é estática (`index.html`). Tabela ao vivo e urna de MVP usam as rotas `/api/copa` e `/api/mvp`. Em casa isso sobe com `npm start`. Na Vercel essas rotas viram funções serverless (já no repo).

## Colocar no ar (Vercel)

Não precisa de `npm start` na nuvem. A Vercel serve o HTML/CSS/JS e executa `/api/*` sob demanda.

1. Sobe o código no GitHub, branch `master` (na máquina de casa):

```powershell
git push https://github.com/kauanbg-dev/Balademunich.git main:master
```

Se o remoto já for o GitHub:

```powershell
git push origin main:master
```

2. Em [vercel.com](https://vercel.com) (mesma conta do Pilates): **Add New… → Project → Import** o repo **Balademunich**.
3. Framework Preset: **Other**. **Build Command** vazio. **Output Directory** vazio. Root `.`
4. **Environment Variables**: `MVP_ADMIN_PIN` = `tteuw`
5. **Storage** (ou **Storage** no projeto depois do primeiro deploy) → Create → **Upstash Redis** (às vezes aparece como KV / Redis) → **Connect** neste projeto.

   Isso cria `KV_REST_API_URL` + `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Sem Redis/KV, os votos da urna somem quando a função esfria.

6. Deploy. A URL fica tipo `https://balademunich.vercel.app` (ou o nome que a Vercel der). Dá pra apontar um domínio depois.

Depois de no ar:

- Site: a URL da Vercel
- Votar: `https://SUA-URL/#mvp`
- Admin (iniciar/pausar): `https://SUA-URL/?admin#mvp` · código `tteuw`

Cada push no GitHub (`master`) publica de novo. Copa e MVP já funcionam nessa URL; não precisa do Render.

## Colocar no ar (Render)

Alternativa se quiser um processo Node 24h (`npm start`):

1. Conta em [render.com](https://render.com) com o GitHub `kauanbg-dev`.
2. **New → Web Service** → repo **Balademunich** (branch `master`).
3. Runtime **Node**, build `npm install`, start `npm start`.
4. Variável `MVP_ADMIN_PIN` = `tteuw` (opcional; esse já é o padrão).
5. Create Web Service.

No plano gratuito o Render **dorme** ~15 min sem visita. Na Vercel isso não acontece.

## Como abrir em casa

No Windows:

```powershell
git clone https://github.com/kauanbg-dev/Balademunich.git
cd Balademunich
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

O script usa a primeira porta livre entre 8765 e 8769. Abre o endereço que aparecer no terminal (`listening 8765`, por exemplo).

Pra tabela ao vivo + votação juntas: `npm start` (precisa do Node).

## Sync ao vivo (Copa Streamers)

Tabela, chave, última/próxima série, artilharia e assistências vêm do [copastreamers.com.br](https://copastreamers.com.br). O site consulta `/api/copa` a cada 60s. Elenco, fotos, Instagram, MVP e Sociais continuam em `data.js`.

Cache local: `data/copa-cache.json` (gitignored). Na Vercel o cache vai em `/tmp`. Sem internet, cai no `data.js`.

## Votação de MVP

- Público: `/#mvp`
- Admin: `/?admin#mvp`
- Código: `tteuw` (ou `MVP_ADMIN_PIN` no host)
- **Iniciar 2h** abre a urna. **Pausar** / **Retomar** congelam o relógio. **Encerrar** fecha na hora e mantém os votos. **Recomeçar do 0** apaga tudo.
- Em casa os votos ficam em `data/votes.json` — **não** vão pro GitHub
- Na Vercel os votos ficam no Redis/KV. Sem banco, só no `/tmp` e somem no cold start
- Um voto por navegador, urna de 2 horas depois de **Iniciar**

## Como editar

O que o sync não cobre (elenco, fotos, feed, tática, MVP) fica em `data.js`. Depois de editar CSS/JS, sobe o `?v=` no `index.html`.
