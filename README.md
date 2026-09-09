# Bala de Munich

Site do time de Pro Clubs no EA FC 26.

## Como abrir

Na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

O script usa a primeira porta livre entre 8765 e 8769. Abre o endereço que aparecer no terminal (`listening 8765`, por exemplo).

## Votação de MVP

- Público: `/#mvp`
- Admin (iniciar, pausar, retomar): `/?admin#mvp`
- Código admin: `tteuw` (troca em `scripts/serve.ps1`, variável `$startPin`)
- Votos ficam em `data/votes.json` e **não** vão pro GitHub

## Como editar

O que muda de semana a semana está em `data.js` (elenco, chave, stats, feed). Depois de editar CSS/JS, sobe o `?v=` no `index.html`.
