# Bala de Munich

Site do time de Pro Clubs no EA FC 26. Elenco, chave da Super Copa dos Streamers, stats e vota├º├úo de MVP.

O site ├® est├ítico, com uma p├ígina por aba (`/`, `/confrontos`, `/mvp`, `/tabela`, `/stats`, `/elenco`, `/tatica`, `/jogos`, `/amistosos`, `/feed`, `/sociais`). Tabela ao vivo e urna de MVP usam as rotas `/api/copa` e `/api/mvp`. As lives do elenco (Kick e Twitch) ficam em `/lives` ÔÇö mesma cara do Bala, player s├│ abre quando clica. Links antigos com hash (`/#mvp`) redirecionam sozinhos. Em casa isso sobe com `npm start`. Na Vercel essas rotas viram fun├º├Áes serverless (j├í no repo).

## Colocar no ar (Vercel)

N├úo precisa de `npm start` na nuvem. A Vercel serve o HTML/CSS/JS e executa `/api/*` sob demanda.

1. Sobe o c├│digo no GitHub. Se o repo veio do bot├úo **Create repo** do Cursor, isso j├í est├í feito. Se for empurrar da m├íquina de casa:

```powershell
git push origin main
```

2. Em [vercel.com](https://vercel.com) (mesma conta do Pilates): **Add NewÔÇª ÔåÆ Project ÔåÆ Import** e escolhe o repo do site.
3. Framework Preset: **Other**. **Build Command** vazio. **Output Directory** vazio. Root `.`
4. **Environment Variables**: `MVP_ADMIN_PIN` = um c├│digo novo, s├│ seu.

   O padr├úo do c├│digo ├® `866283`, que est├í escrito em `scripts/mvp.mjs`. Se o repo for p├║blico, qualquer um consegue ler ele ali. Definindo `MVP_ADMIN_PIN` na Vercel com outro n├║mero, esse valor manda e o do c├│digo deixa de valer.
5. **Storage** (ou **Storage** no projeto depois do primeiro deploy) ÔåÆ Create ÔåÆ **Upstash Redis** (├ás vezes aparece como KV / Redis) ÔåÆ **Connect** neste projeto.

   Isso cria `KV_REST_API_URL` + `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Sem Redis/KV, os votos da urna somem quando a fun├º├úo esfria.

6. Deploy. A URL fica tipo `https://balademunich.vercel.app` (ou o nome que a Vercel der). D├í pra apontar um dom├¡nio depois.

Depois de no ar:

- Site: a URL da Vercel
- Votar: `https://SUA-URL/mvp`
- Admin (iniciar/pausar): `https://SUA-URL/mvp?admin` ┬À use o `MVP_ADMIN_PIN` da Vercel

Cada push no GitHub (`master`) publica de novo. Copa e MVP j├í funcionam nessa URL; n├úo precisa do Render.

## Colocar no ar (Render)

Alternativa se quiser um processo Node 24h (`npm start`):

1. Conta em [render.com](https://render.com) com o GitHub `kauanbg-dev`.
2. **New ÔåÆ Web Service** ÔåÆ o repo do site.
3. Runtime **Node**, build `npm install`, start `npm start`.
4. Vari├ível `MVP_ADMIN_PIN` = o c├│digo que voc├¬ quiser (o padr├úo do c├│digo ├® `866283`).
5. Create Web Service.

No plano gratuito o Render **dorme** ~15 min sem visita. Na Vercel isso n├úo acontece.

## Como abrir em casa

No Windows:

```powershell
git clone SUA-URL-DO-GITHUB.git
cd NOME-DA-PASTA
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

O script usa a primeira porta livre entre 8765 e 8769. Abre o endere├ºo que aparecer no terminal (`listening 8765`, por exemplo).

Pra tabela ao vivo + vota├º├úo juntas: `npm start` (precisa do Node).

Na primeira visita a home abre direto, sem intro. `/lives` tamb├®m.

## Sync ao vivo (Copa Streamers)

Tabela, chave, ├║ltima/pr├│xima s├®rie, artilharia e assist├¬ncias v├¬m do [copastreamers.com.br](https://copastreamers.com.br). O site consulta `/api/copa` a cada 60s. Elenco, fotos, Instagram, MVP e Sociais continuam em `data.js`.

A Super Copa dos Streamers (Edi├º├úo 2) acabou. O site guarda a campanha do Bala at├® a final contra o Botafofo.

Os amistosos saem da p├ígina `/partidas` da Copa, que n├úo tem API: o parser l├¬ o payload do Next embutido no HTML e fica s├│ com os jogos do Bala.

Dois cortes acontecem depois disso:

- **Jogo anterior a `COPA_AMISTOSOS_DESDE`** ├® descartado. O corte est├í em 10/09/2026: o que ├® mais velho vive no `friendlies` do `data.js`, conferido na m├úo. Pra mudar, ├® a constante `FRIENDLIES_SINCE` em `api/_lib/copa.mjs` ou a vari├ível de ambiente.
- **Jogo quitado no meio** ├® descartado: fica sempre 0ÔÇô0 e n├úo diz nada sobre o time.

O `paintFriendlies` mostra o que veio ao vivo e emenda o hist├│rico do `data.js` embaixo. Como o ao vivo s├│ traz jogo depois do corte, a ordem sai certa sem precisar reordenar.

Data e hor├írio aparecem s├│ nos jogos que vieram ao vivo, em hor├írio de Bras├¡lia e sem remendo de madrugada (jogo que terminou 00:21 de quarta ├® quarta). O carimbo vem do fim da partida, que ├® o que a EA registra. No hist├│rico manual n├úo tem data: o card cai pro r├│tulo "Amistoso" e a ordem da lista ├® a ├║nica refer├¬ncia temporal.

Um cuidado pro futuro: o acervo da Copa ├® o hist├│rico bruto do EA FC, e em alguns times a s├®rie oficial aparece l├í junto dos amistosos ÔÇö d├í pra ver reconstruindo Botafofo 3x1 Osempic e Narizes 3x2 Cobra, que batem com o placar oficial das quartas. Nas quartas do Bala isso n├úo aconteceu (os jogos daquela noite n├úo fecham o 3x1 oficial), ent├úo nada ├® filtrado. Vale reconferir depois da semifinal.

Se a p├ígina mudar de formato, a se├º├úo mant├®m o ├║ltimo acervo em cache e a Copa continua atualizando normalmente.

### Faixa "Bala ao vivo" (topo)

Fica no hero, logo abaixo dos bot├Áes, e est├í sempre vis├¡vel. Nem a Copa nem a EA publicam partida em andamento ÔÇö o placar s├│ existe depois que o jogo acaba ÔÇö, ent├úo o estado "em campo agora" ├® deduzido de dois sinais concretos, em `paintLiveNow` (`app.js`):

- **S├®rie oficial**: confronto do Bala cujo hor├írio (`iso`, o `quando` cru do confronto) j├í passou e que ainda est├í sem placar. Vale por 3h. O card n├úo inventa parcial: mostra "Em andamento" e a que horas come├ºou.
- **Amistoso recente**: jogo que entrou no acervo h├í menos de 28 min. No Pro Clubs as partidas s├úo emendadas, ent├úo resultado rec├®m-chegado quer dizer que o time ainda est├í em campo. A partir do primeiro, os anteriores entram enquanto o intervalo entre eles for menor que 40 min ÔÇö ├® a sess├úo daquela noite, n├úo o acervo inteiro.

Sem nenhum dos dois, a faixa mostra o escudo apagado, "Ningu├®m em campo agora" e o pr├│ximo confronto. O ponto vermelho para de piscar. A faixa se repinta sozinha a cada 30s pro "h├í 3 min" n├úo congelar, mesmo sem dado novo da Copa.

Cache local: `data/copa-cache.json` (gitignored). Na Vercel o cache vai em `/tmp`. Sem internet, cai no `data.js`.

## Feed do Instagram

O bloco "Feed" puxa os posts do `@balademunich` sozinho. A ordem e os posts novos v├¬m do perfil p├║blico. O [Feedframer](https://feedframer.com/pricing) (plano **Free**, sem marca d'├ígua) entra como CDN est├ível das fotos que ele j├í tiver ÔÇö o gr├ítis s├│ atualiza o Instagram **1├ù por dia**. Sem as duas fontes, cai no token da Meta (`IG_TOKEN`). Se as tr├¬s falharem, a se├º├úo fica com as fotos locais do `gallery` no `data.js` ÔÇö nunca fica vazia.

Por que n├úo Elfsight/SnapWidget/LightWidget: o plano gr├ítis deles ou coloca marca d'├ígua, ou **n├úo funciona em site HTTPS** (caso do LightWidget). O site desenha os cards com o visual do Bala, ent├úo n├úo tem logo de terceiro.

Como ligar o Feedframer (opcional, uma vez):

1. Cria conta em [feedframer.com/register](https://feedframer.com/register) e confirma o e-mail.
2. **Connect Instagram Account** e entra com a `@balademunich` (conta profissional).
3. **Settings ÔåÆ API Keys** ÔåÆ copia a chave da conta (64 caracteres).
4. Cola em `FEEDFRAMER_KEY` nas vari├íveis da Vercel.

A chave fica na Vercel, n├úo no GitHub. Sem ela o site ainda tenta o Instagram p├║blico e, se falhar, as fotos locais.

N├úo cola a chave no chat nem no GitHub. O site consulta `/api/feed` a cada 3 min. Fotos que ainda n├úo est├úo no CDN do Feedframer passam por `/api/ig-media`.

Vari├íveis:

- `FEEDFRAMER_KEY` ÔÇö chave do Feedframer na Vercel.
- `IG_TOKEN` ÔÇö token longo da Meta (reserva). S├│ entra se o Instagram p├║blico e o Feedframer falharem.
- `IG_LIMIT` ÔÇö quantos posts mostrar (padr├úo 3). O gr├ítis do Feedframer aceita no m├íximo 6 por pedido.
- `IG_CACHE_MS` ÔÇö validade do cache em mem├│ria do feed misturado (padr├úo 2 min).
- `IG_WEB_CACHE_MS` ÔÇö validade do cache do perfil p├║blico (padr├úo 5 min).

Se usar s├│ `IG_TOKEN`: o token se renova sozinho depois de 30 dias e o novo vai pro Redis (as mesmas `KV_REST_API_URL` / `KV_REST_API_TOKEN` do MVP). As URLs de imagem da Meta s├úo assinadas e expiram em horas, por isso esse cache ├® curto e s├│ em mem├│ria.

## Vota├º├úo de MVP

- P├║blico: `/mvp`
- Admin: `/mvp?admin` (o atalho `/?admin` ainda redireciona)
- C├│digo: o `MVP_ADMIN_PIN` do host. Sem a vari├ível, vale o padr├úo do c├│digo.
- **Iniciar 2h** abre a urna. **Pausar** / **Retomar** congelam o rel├│gio. **Encerrar** fecha na hora e mant├®m os votos. **Recome├ºar do 0** apaga tudo.
- No admin, **Placar da final** liga o MD5 ao vivo e soma o resultado. O p├║blico v├¬ na faixa da home e na chave.
- No admin, **Quem jogou** escolhe o elenco da partida (ou **Todos jogaram** / **Ningu├®m jogou**). S├│ quem est├í dourado entra na urna. O p├║blico v├¬ **Jogador n├úo jogou** nos outros e n├úo consegue votar neles. Votos j├í dados nesses nomes saem da urna.
- Em casa os votos ficam em `data/votes.json` ÔÇö **n├úo** v├úo pro GitHub
- Na Vercel os votos ficam no Redis/KV. Sem banco, s├│ no `/tmp` e somem no cold start
- Um voto por IP. Atualizar a p├ígina n├úo libera outro voto. Com a urna aberta ainda d├í pra trocar de jogador (clicando em outro) ou tirar o voto ÔÇö continua um voto s├│ naquele IP. Depois de **Encerrar** o voto trava.
- Se o Redis n├úo responder, a API devolve `503` e **recusa gravar**. Escrever um estado vazio por cima apagaria a urna inteira, ent├úo nesse caso ningu├®m vota at├® o banco voltar ÔÇö e nenhum voto se perde.
- O p├║blico s├│ v├¬ a porcentagem. A contagem de votos aparece s├│ pra quem est├í logado no admin.

## Como editar

O que o sync n├úo cobre (elenco, fotos, feed, t├ítica, MVP) fica em `data.js`. Depois de editar CSS/JS, sobe o `?v=` nos HTMLs.
