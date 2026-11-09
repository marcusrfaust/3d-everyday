// src/lib/rotulos.ts
var ROTULOS = {
  "collectibles": "Colecion\xE1veis",
  "keychains": "Chaveiros",
  "miniatures": "Miniaturas",
  "toys-games": "Brinquedos e jogos",
  "home-decor": "Decora\xE7\xE3o",
  "household": "Utilidades dom\xE9sticas",
  "fashion": "Moda",
  "hobby-diy": "Hobby e DIY",
  "print-guides": "Guias de impress\xE3o",
  "adults-only": "Adulto +18"
};
function rotuloCategoria(slug, name) {
  const s = String(slug ?? "").toLowerCase();
  if (s && ROTULOS[s]) return ROTULOS[s];
  const n = String(name ?? s ?? "").trim();
  return n || "Categoria";
}
export {
  rotuloCategoria
};
