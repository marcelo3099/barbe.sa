const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents) {
  return fmt.format(cents / 100).replace(/[  ]/g, " ");
}
