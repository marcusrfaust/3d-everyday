# 3d-Everyday (3DE)

Vitrine e downloads do acervo 3D por créditos do plano Dash 3D.

- Domínio: `3de.focol.ai` (3d-lib segue em `lib3d.focol.ai`, intocado como fonte).
- Base estrutural: withastro/storefront (referência em `/tmp/storefront-ref`, nunca commitada).
- Leitura readonly do D1 do 3d-lib. Este app nunca escreve no catálogo.

## Dev

```sh
cp .env.example .env  # preencher D1_* (segredos, nunca no repo)
npm install
npm run dev    # :4322
npm run check
```

Fases: 1) casco + readonly → 2) contas + `credits_ledger` + gate → 3) Medusa.
Detalhes: `PRODUCT.md`, `implementation-notes.html`.
