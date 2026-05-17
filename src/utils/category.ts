import type { AppLanguage } from "@/src/i18n/appLanguage";

const FILIPINO_CATEGORY_LABELS: Record<string, string> = {
  all: "Lahat",
  bills: "Bayarin",
  coffee: "Kape",
  education: "Edukasyon",
  entertainment: "Libangan",
  food: "Pagkain",
  groceries: "Pamilihan",
  health: "Kalusugan",
  lunch: "Tanghalian",
  other: "Iba pa",
  shopping: "Pamimili",
  transport: "Transportasyon",
  uncategorized: "Walang category",
  utilities: "Utilities",
};

export const normalizeCategoryName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizeCategoryKey = (value: string) =>
  normalizeCategoryName(value).toLowerCase();

export const getLocalizedCategoryName = (
  value: string,
  language?: AppLanguage,
) => {
  const normalizedName = normalizeCategoryName(value);

  if (language !== "Filipino") {
    return normalizedName;
  }

  return FILIPINO_CATEGORY_LABELS[normalizeCategoryKey(normalizedName)] ?? normalizedName;
};
