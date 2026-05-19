import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { CATEGORIES, CATEGORY_OPTIONS } from "@shared/categories";

export type CategoryInfo = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  isCustom?: boolean;
  id?: number;
};

/**
 * Hook que mescla categorias fixas com categorias customizadas do usuário.
 * Usar em todos os selects de categoria no app.
 */
export function useCategories() {
  const customQuery = trpc.customCategories.list.useQuery();
  const customList = customQuery.data ?? [];

  // Map completo: key → CategoryInfo (fixas + customizadas)
  const categoriesMap = useMemo<Record<string, CategoryInfo>>(() => {
    const map: Record<string, CategoryInfo> = {};

    // Categorias fixas
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      map[key] = { key, label: (cat as any).label, emoji: (cat as any).emoji, color: (cat as any).color };
    }

    // Categorias customizadas (sobrescrevem se mesma key, mas têm keys únicas)
    for (const cat of customList) {
      map[cat.key] = {
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        isCustom: true,
        id: cat.id,
      };
    }

    return map;
  }, [customList]);

  // Lista para selects (fixas primeiro, depois customizadas)
  const categoryOptions = useMemo(() => {
    const fixed = CATEGORY_OPTIONS;
    const custom = customList.map((cat) => ({
      value: cat.key,
      label: `${cat.emoji} ${cat.label}`,
    }));
    return [...fixed, ...custom];
  }, [customList]);

  const isLoading = customQuery.isLoading;

  return { categoriesMap, categoryOptions, customList, isLoading };
}
