# Bala de Munich

Site do time de Pro Clubs no EA FC 26. Elenco, chave da Super Copa dos Streamers, stats e votação de MVP.

A página em si é estática (`index.html`). Tabela ao vivo e urna de MVP usam as rotas `/api/copa` e `/api/mvp`. As lives do elenco (Kick e Twitch) têm um site irmão em `/lives` — mesma cara do Bala, player só abre quando clica. Em casa isso sobe com `npm start`. Na Vercel essas rotas viram funções serverless (já no repo).

## Colocar no ar (Vercel)

Não precisa de `npm start` na nuvem. A Vercel serve o HTML/CSS/JS e executa `/api/*` sob demanda.

1. Sobe o código no GitHub. Se o repo veio do botão **Create repo** do Cursor, isso já está feito. Se for empurrar da máquina de casa:

```powershell
git push origin main
```

2. Em [vercel.com](https://vercel.com) (mesma conta do Pilates): **Add New… → Project → Import** e escolhe o repo do site.
3. Framework Preset: **Other**. **Build Command** vazio. **Output Directory** vazio. Root `.`
4. **Environment Variables**: `MVP_ADMIN_PIN` = um código novo, só seu.

   O padrão do código é `866283`, que está escrito em `scripts/mvp.mjs`. Se o repo for público, qualquer um consegue ler ele ali. Definindo `MVP_ADMIN_PIN` na Vercel com outro número, esse valor manda e o do código deixa de valer.
5. **Storage** (ou **Storage** no projeto depois do primeiro deploy) → Create → **Upstash Redis** (às vezes aparece como KV / Redis) → **Connect** neste projeto.

   Isso cria `KV_REST_API_URL` + `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Sem Redis/KV, os votos da urna somem quando a função esfria.

6. Deploy. A URL fica tipo `https://balademunich.vercel.app` (ou o nome que a Vercel der). Dá pra apontar um domínio depois.

Depois de no ar:

- Site: a URL da Vercel
- Votar: `https://SUA-URL/#mvp`
- Admin (iniciar/pausar): `https://SUA-URL/?admin#mvp` · código `866283` (ou o `MVP_ADMIN_PIN` que você definir)

Cada push no GitHub (`master`) publica de novo. Copa e MVP já funcionam nessa URL; não precisa do Render.

## Colocar no ar (Render)

Alternativa se quiser um processo Node 24h (`npm start`):

1. Conta em [render.com](https://render.com) com o GitHub `kauanbg-dev`.
2. **New → Web Service** → o repo do site.
3. Runtime **Node**, build `npm install`, start `npm start`.
4. Variável `MVP_ADMIN_PIN` = o código que você quiser (o padrão do código é `866283`).
5. Create Web Service.

No plano gratuito o Render **dorme** ~15 min sem visita. Na Vercel isso não acontece.

## Como abrir em casa

No Windows:

```powershell
git clone SUA-URL-DO-GITHUB.git
cd NOME-DA-PASTA
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

O script usa a primeira porta livre entre 8765 e 8769. Abre o endereço que aparecer no terminal (`listening 8765`, por exemplo).

Pra tabela ao vivo + votação juntas: `npm start` (precisa do Node).

## Sync ao vivo (Copa Streamers)

Tabela, chave, última/próxima série, artilharia e assistências vêm do [copastreamers.com.br](https://copastreamers.com.br). O site consulta `/api/copa` a cada 60s. Elenco, fotos, Instagram, MVP e Sociais continuam em `data.js`.

Os amistosos saem da página `/partidas` da Copa, que não tem API: o parser lê o payload do Next embutido no HTML e fica só com os jogos do Bala.

Dois cortes acontecem depois disso:

- **Jogo anterior a `COPA_AMISTOSOS_DESDE`** é descartado. O corte está em 10/09/2026: o que é mais velho vive no `friendlies` do `data.js`, conferido na mão. Pra mudar, é a constante `FRIENDLIES_SINCE` em `api/_lib/copa.mjs` ou a variável de ambiente.
- **Jogo quitado no meio** é descartado: fica sempre 0–0 e não diz nada sobre o time.

O `paintFriendlies` mostra o que veio ao vivo e emenda o histórico do `data.js` embaixo. Como o ao vivo só traz jogo depois do corte, a ordem sai certa sem precisar reordenar.

Data e horário aparecem só nos jogos que vieram ao vivo, em horário de Brasília e sem remendo de madrugada (jogo que terminou 00:21 de quarta é quarta). O carimbo vem do fim da partida, que é o que a EA registra. No histórico manual não tem data: o card cai pro rótulo "Amistoso" e a ordem da lista é a única referência temporal.

Um cuidado pro futuro: o acervo da Copa é o histórico bruto do EA FC, e em alguns times a série oficial aparece lá junto dos amistosos — dá pra ver reconstruindo Botafofo 3x1 Osempic e Narizes 3x2 Cobra, que batem com o placar oficial das quartas. Nas quartas do Bala isso não aconteceu (os jogos daquela noite não fecham o 3x1 oficial), então nada é filtrado. Vale reconferir depois da semifinal.

Se a página mudar de formato, a seção mantém o último acervo em cache e a Copa continua atualizando normalmente.

### Faixa "Bala ao vivo" (topo)

Fica no hero, logo abaixo dos botões, e está sempre visível. Nem a Copa nem a EA publicam partida em andamento — o placar só existe depois que o jogo acaba —, então o estado "em campo agora" é deduzido de dois sinais concretos, em `paintLiveNow` (`app.js`):

- **Série oficial**: confronto do Bala cujo horário (`iso`, o `quando` cru do confronto) já passou e que ainda está sem placar. Vale por 3h. O card não inventa parcial: mostra "Em andamento" e a que horas começou.
- **Amistoso recente**: jogo que entrou no acervo há menos de 28 min. No Pro Clubs as partidas são emendadas, então resultado recém-chegado quer dizer que o time ainda está em campo. A partir do primeiro, os anteriores entram enquanto o intervalo entre eles for menor que 40 min — é a sessão daquela noite, não o acervo inteiro.

Sem nenhum dos dois, a faixa mostra o escudo apagado, "Ninguém em campo agora" e o próximo confronto. O ponto vermelho para de piscar. A faixa se repinta sozinha a cada 30s pro "há 3 min" não congelar, mesmo sem dado novo da Copa.

Cache local: `data/copa-cache.json` (gitignored). Na Vercel o cache vai em `/tmp`. Sem internet, cai no `data.js`.

## Feed do Instagram

O bloco "Feed" puxa os posts do `@balademunich` sozinho. A ordem e os posts novos vêm do perfil público. O [Feedframer](https://feedframer.com/pricing) (plano **Free**, sem marca d'água) entra como CDN estável das fotos que ele já tiver — o grátis só atualiza o Instagram **1× por dia**. Sem as duas fontes, cai no token da Meta (`IG_TOKEN`). Se as três falharem, a seção fica com as fotos locais do `gallery` no `data.js` — nunca fica vazia.

Por que não Elfsight/SnapWidget/LightWidget: o plano grátis deles ou coloca marca d'água, ou **não funciona em site HTTPS** (caso do LightWidget). O site desenha os cards com o visual do Bala, então não tem logo de terceiro.

Como ligar o Feedframer (opcional, uma vez):

1. Cria conta em [feedframer.com/register](https://feedframer.com/register) e confirma o e-mail.
2. **Connect Instagram Account** e entra com a `@balademunich` (conta profissional).
3. **Settings → API Keys** → copia a chave da conta (64 caracteres).
4. No site: `https://balademunich.vercel.app/?admin#mvp` → entra com o código admin → bloco **Instagram · Feed** (é o retângulo dourado, separado da urna) → cola a chave → **Ligar**.

A chave fica no Redis (o mesmo do MVP), não no GitHub. Dá pra colar `FEEDFRAMER_KEY` na Vercel também; se as duas existirem, a do painel manda. **Tirar o Feedframer** apaga só a chave do painel — o perfil público continua no ar. **Atualizar agora** zera o cache e busca de novo.

Não cola a chave no chat nem no GitHub. O site consulta `/api/feed` a cada 3 min. Fotos que ainda não estão no CDN do Feedframer passam por `/api/ig-media`.

Variáveis:

- `FEEDFRAMER_KEY` — chave do Feedframer na Vercel. Opcional se a chave foi colada no painel admin.
- `IG_TOKEN` — token longo da Meta (reserva). Só entra se o Instagram público e o Feedframer falharem.
- `IG_LIMIT` — quantos posts mostrar (padrão 3; o grátis do Feedframer entrega até 6).
- `IG_CACHE_MS` — validade do cache em memória do feed misturado (padrão 2 min).
- `IG_WEB_CACHE_MS` — validade do cache do perfil público (padrão 5 min).

Se usar só `IG_TOKEN`: o token se renova sozinho depois de 30 dias e o novo vai pro Redis (as mesmas `KV_REST_API_URL` / `KV_REST_API_TOKEN` do MVP). As URLs de imagem da Meta são assinadas e expiram em horas, por isso esse cache é curto e só em memória.

## Votação de MVP

## Votação de MVP

- Público: `/#mvp`
- Admin: `/?admin#mvp`
- Código: `866283` (ou o `MVP_ADMIN_PIN` definido no host, que tem prioridade)
- **Iniciar 2h** abre a urna. **Pausar** / **Retomar** congelam o relógio. **Encerrar** fecha na hora e mantém os votos. **Recomeçar do 0** apaga tudo.
- Em casa os votos ficam em `data/votes.json` — **não** vão pro GitHub
- Na Vercel os votos ficam no Redis/KV. Sem banco, só no `/tmp` e somem no cold start
- Um voto por navegador, urna de 2 horas depois de **Iniciar**
- Com a urna aberta dá pra trocar de jogador (clicando em outro) ou tirar o voto. Trocar não infla o total. Depois de **Encerrar** o voto trava, senão daria pra sacar voto do vencedor depois do resultado.
- Se o Redis não responder, a API devolve `503` e **recusa gravar**. Escrever um estado vazio por cima apagaria a urna inteira, então nesse caso ninguém vota até o banco voltar — e nenhum voto se perde.
- O público só vê a porcentagem. A contagem de votos aparece só pra quem está logado no admin.

## Como editar

O que o sync não cobre (elenco, fotos, feed, tática, MVP) fica em `data.js`. Depois de editar CSS/JS, sobe o `?v=` no `index.html`.
