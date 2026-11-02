# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 5 SSR (mesmo padrão do 3d-lib: `output: server`), TypeScript, Tailwind v4. Leitura readonly do catálogo via Cloudflare D1 REST (server-only). Sem React/Solid na fase 1 — islands mínimas só quando houver interatividade que justifique.

## Users

 makers/profissionais de impressão 3D que compram o Dash 3D e ganham créditos mensais de download no 3DE; usam o catálogo para achar peças, ver fotos e baixar dentro do limite do plano.

## Product Purpose

3d-Everyday (3DE) é a vitrine e área de downloads do acervo 3D: catálogo navegável por categoria/tag (taxonomia Jev herdada do 3d-lib), contas com carteira de créditos mensais por plano, gate de download. O 3d-lib atual segue intocado como fonte de dados (watcher + PG + D1). Sucesso = usuário acha a peça, vê foto, baixa dentro dos créditos, sem tocar no sistema legado.

## Positioning

O único acervo 3D com curadoria automática por taxonomia validada (Jev) + créditos vinculados ao Dash 3D: o 3d-lib organiza, o 3DE distribui. Concorrentes vendem arquivos avulsos; aqui o download é benefício do plano.

## Operating Context

Fonte de dados: D1 (espelho do PG do 3d-lib) somente leitura — 3DE nunca escreve no catálogo. Ritual Akila: teste → commit → push → PR → RedTeam ≥90 → merge → verificar no ar → kanban. Domínio: `3de.focol.ai` (3d-lib fica em `lib3d.focol.ai`). Referência visual/estrutural: withastro/storefront (em /tmp, nunca commitada) — estrutura e design com nosso material, baseline nunca réplica.

## Capabilities and Constraints

Fase 1 (em construção): repo + casco storefront + leitura readonly (busca/categoria/modelo espelhando o 3d-lib). Fase 2: contas + `credits_ledger` + gate de download + extrato (planos fixos em config). Fase 3: Medusa p/ assinaturas reais (nunca no 3d-lib). Restrições: sem Stripe/pagamento até a fase 3; sem React; sem escrever no D1 do catálogo; fotos via `/api/thumb` + fallback Drive; placeholders visíveis onde faltar dado real; OpenRouter proibido.

## Brand Commitments

Nome: 3d-Everyday (3DE). Domínio `3de.focol.ai`. Visual: estrutura do withastro/storefront adaptada ao acervo real. (inferido: paleta/tipografia ainda sem decisão — registrar quando Marcus aprovar a primeira tela.)

## Evidence on Hand

Catálogo real: D1 `a7e167fd-b914-4fde-965c-500e0ba12c45` (33k itens, 92k files, 56 tags, taxonomia Jev com 23 mapeamentos). Fonte: `~/apps/3d-lib`. Fotos: amostra de 100 rebaixadas do Telegram (02/11/26). Ausências que não devem ser fabricadas: reviews, preços, depoimentos.

## Product Principles

1. O 3d-lib é fonte intocável; o 3DE só lê.
2. Crédito é benefício do plano Dash 3D, nunca produto avulso na fase 1–2.
3. Sem foto real, sem promessa: placeholder visível, nunca mockup passado como real.
4. Baseline própria sobre referência externa, nunca réplica commitada.
5. Cada fase só é done pelo DONE GATE completo.

## Accessibility & Inclusion

Padrão ui acessível do storefront (Button/Drawer/Input com guidelines modernas) portado junto com os componentes. (inferido: sem requisito WCAG formal — declarar se Marcus exigir.)
