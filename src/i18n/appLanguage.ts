export type AppLanguage = "English" | "Filipino";

export const SUPPORTED_APP_LANGUAGES: {
  key: AppLanguage;
  label: string;
  nativeLabel: string;
}[] = [
  { key: "English", label: "English", nativeLabel: "English" },
  { key: "Filipino", label: "Filipino", nativeLabel: "Filipino" },
];

export const normalizeAppLanguage = (language?: string): AppLanguage => {
  switch (language) {
    case "English":
    case "Filipino":
      return language;
    default:
      return "English";
  }
};

export const resolveUiLanguage = (
  language?: AppLanguage,
): "English" | "Filipino" => {
  return language === "Filipino" ? "Filipino" : "English";
};
