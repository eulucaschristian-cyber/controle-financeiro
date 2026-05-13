export const CATEGORIES = {
  alimentacao_fora: { label: "Alimentação Fora", emoji: "🍔", color: "bg-orange-100 text-orange-700" },
  lazer: { label: "Lazer / Rolê", emoji: "🎉", color: "bg-purple-100 text-purple-700" },
  compras_online: { label: "Compras Online", emoji: "🛒", color: "bg-blue-100 text-blue-700" },
  mimos_outros: { label: "Mimos / Outros", emoji: "🎁", color: "bg-pink-100 text-pink-700" },
  supermercado: { label: "Supermercado", emoji: "🏪", color: "bg-green-100 text-green-700" },
  pet: { label: "Pet", emoji: "🐾", color: "bg-amber-100 text-amber-700" },
  assinatura: { label: "Assinatura", emoji: "📺", color: "bg-red-100 text-red-700" },
  academia: { label: "Academia", emoji: "💪", color: "bg-indigo-100 text-indigo-700" },
  despesas_carro: { label: "Despesas Carro", emoji: "🚗", color: "bg-gray-100 text-gray-700" },
  gasolina: { label: "Gasolina", emoji: "⛽", color: "bg-yellow-100 text-yellow-700" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([key, val]) => ({
  value: key as CategoryKey,
  label: `${val.emoji} ${val.label}`,
}));

export const PAYMENT_METHODS = {
  debito: { label: "Débito", emoji: "💳", color: "bg-sky-100 text-sky-700" },
  credito: { label: "Crédito", emoji: "💳", color: "bg-violet-100 text-violet-700" },
  pix: { label: "Pix", emoji: "⚡", color: "bg-teal-100 text-teal-700" },
  dinheiro: { label: "Dinheiro", emoji: "💵", color: "bg-lime-100 text-lime-700" },
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;

export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHODS).map(([key, val]) => ({
  value: key as PaymentMethodKey,
  label: `${val.emoji} ${val.label}`,
}));
