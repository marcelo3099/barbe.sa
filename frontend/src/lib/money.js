const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents) {
  return fmt.format(cents / 100).replace(/[  ]/g, " ");
}

// "45,00" | "45" | "R$ 1.234,56" → centavos; texto inválido → null
export function parsePriceInput(text) {
  let s = String(text ?? "").replace(/R\$/i, "").replace(/\s/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

// centavos → "45,00" para preencher o campo de edição
export function centsToInput(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
