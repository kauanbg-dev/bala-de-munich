# Bala de Munich

Site do time de Pro Clubs no EA FC 26. Elenco, chave da Super Copa dos Streamers, stats e votação de MVP.

Votação e tabela ao vivo **só funcionam** com o servidor Node (`npm start`). Abrir o HTML no GitHub Pages ou na Vercel estática não conta voto e não puxa a Copa.

## Colocar no ar (Render)

1. Conta em [render.com](https://render.com) com o GitHub `kauanbg-dev`.
2. **New → Web Service** → repo **Balademunich** (branch `master`).
3. Runtime **Node**, build `npm install`, start `npm start`.
4. Variável `MVP_ADMIN_PIN` = `tteuw` (opcional; esse já é o padrão).
5. Create Web Service. O endereço fica `https://bala-de-munich.onrender.com` (ou o nome que o Render der).

Depois de no ar:

- Site: a URL do Render
- Votar: `https://SUA-URL/#mvp`
- Admin (iniciar/pausar): `https://SUA-URL/?admin#mvp` · código `tteuw`

No plano gratuito o Render **dorme** ~15 min sem visita. A primeira abertura do dia pode demorar ~1 min. No horário do jogo, com gente no site, a urna fica de pé.

Cada push no GitHub (`master`) publica de novo.

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

Cache local: `data/copa-cache.json` (gitignored). Sem internet, cai no `data.js`.

## Votação de MVP

- Público: `/#mvp`
- Admin: `/?admin#mvp`
- Código: `tteuw` (ou `MVP_ADMIN_PIN` no host)
- **Iniciar 2h** abre a urna. **Pausar** / **Retomar** congelam o relógio. **Encerrar** fecha na hora e mantém os votos. **Recomeçar do 0** apaga tudo.
- Votos em `data/votes.json` — **não** vão pro GitHub
- Um voto por navegador, urna de 2 horas depois de **Iniciar**

## Como editar

O que o sync não cobre (elenco, fotos, feed, tática, MVP) fica em `data.js`. Depois de editar CSS/JS, sobe o `?v=` no `index.html`.
