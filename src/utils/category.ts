export const normalizeCategoryName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizeCategoryKey = (value: string) =>
  normalizeCategoryName(value).toLowerCase();
