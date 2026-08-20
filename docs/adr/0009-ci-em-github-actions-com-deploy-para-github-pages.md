---
status: accepted
date: 2026-08-19
builds-on: []
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# CI em GitHub Actions com deploy para GitHub Pages

## Contexto e problema
O repo ganhou um git remote (`origin` → `github.com/gugacarbo/algo-graph`) e o
usuário pediu deploy automatizado. O build é um único `dist/index.html`
auto-contido (ADR-0007), então a pergunta forçada é: onde publicar e quem valida
antes de publicar?

## Direcionadores da decisão
- Zero backend continua valendo: o deploy precisa ser estático, sem servidor nosso.
- O app abre até via `file://` — não há asset paths absolutos a quebrar; um host
  de arquivos estáticos é suficiente.
- O DoD local (typecheck, lint, test, docs-check) deve valer igual na CI — o que
  passa no CI deveria passar no `main`.
- Package manager é bun (nunca npm/npx — ADR-0007).

## Opções consideradas

### Opção 1 — Sem CI: push manual e distribuição por cópia do `dist/index.html`
**Prós:**
- Menos superfície de configuração; nada novo quebra.
**Contras:**
- Sem URL compartilhável estável; cada distribuição é um arquivo solto.
- Sem gate automático — só os hooks locais (contornáveis com `--no-verify`).

### Opção 2 — GitHub Actions + GitHub Pages (escolhida)
**Prós:**
- Zero infra própria: Pages serve arquivos estáticos, sem backend nem banco.
- O mesmo workflow roda o DoD completo antes de publicar — gate que não depende
  do hook local.
- Build single-file (ADR-0007) cai no place: artefato do Pages = `dist/` inteiro,
  um arquivo.
**Contras:**
- Novo estado a manter (workflow, Pages habilitado, remote) — o repo deixa de ser
  "só local".
- O site vive sob o domínio `*.github.io` do usuário.

## Decisão
CI e deploy em **GitHub Actions** (`.github/workflows/deploy.yml`), publicando
o `dist/` para **GitHub Pages** (site `https://gugacarbo.github.io/algo-graph/`).
Um único workflow dispara em push para `main` e manualmente: roda o DoD
(typecheck, lint, test, docs-check), faz o build e só então faz upload + deploy.
Actions pinadas pelas majors oficiais mais recentes (`actions/checkout@v7`,
`oven-sh/setup-bun@v2`, `actions/upload-pages-artifact@v5`,
`actions/deploy-pages@v5`).

## Consequências
- Positivas: URL pública permanente; gate de DoD roda a cada push sem depender
  dos hooks locais.
- Negativas: o `main` vira "o que está no ar" — commit direto no `main`
  publica.
- Obrigatório: nunca commitar `dist/` (já valia) — o artefato vem do build na CI;
  manter o workflow com as majors de actions atuais.
- Proibido por esse ADR: nada que adicione backend/DB — o deploy é estático.

## Confirmação
```bash
gh run list --limit 5          # último push em main deve ter workflow verde
curl -sI https://gugacarbo.github.io/algo-graph/ | head -1   # HTTP/2 200
```

## Notas
- O build single-file (ADR-0007) mantém o deploy banal: sem asset paths,
  `vite base` fica relativo e o site funciona do subpath do Pages.
- Fonte externa em runtime (Google Fonts) continua — o site funciona offline com
  as fallback stacks do CSS.
