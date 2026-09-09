# Bala de Munich

Site do time de Pro Clubs no EA FC 26. Elenco, chave da Super Copa dos Streamers, stats e votação de MVP.

## Como abrir

No Windows:

```powershell
git clone https://github.com/kauanbg-dev/Balademunich.git
cd Balademunich
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

O script usa a primeira porta livre entre 8765 e 8769. Abre o endereço que aparecer no terminal (`listening 8765`, por exemplo).

Se o PowerShell não estiver disponível, dá pra subir com `npm start` (Node).

## Sync ao vivo (Copa Streamers)

Tabela, chave, última/próxima série, artilharia e assistências são puxados do [copastreamers.com.br](https://copastreamers.com.br) pelo servidor Node (`npm start`). O site consulta `/api/copa` a cada 60s. Elenco, fotos, Instagram, MVP e Sociais continuam manuais em `data.js`.

O `serve.ps1` do Windows sobe o site e a votação, mas **não** faz esse sync. Em casa, use `npm start` se quiser a chave/tabela ao vivo.

Cache local fica em `data/copa-cache.json` (gitignored). Sem internet, o site cai de volta no `data.js`.

## Votação de MVP

- Público: `/#mvp`
- Admin (iniciar, pausar, retomar): `/?admin#mvp`
- Código admin: `tteuw` (troca em `scripts/serve.ps1`, variável `$startPin`)
- Votos ficam em `data/votes.json` e **não** vão pro GitHub

## Como editar

O que o sync não cobre (elenco, fotos, feed, tática, MVP) fica em `data.js`. Depois de editar CSS/JS, sobe o `?v=` no `index.html`.
