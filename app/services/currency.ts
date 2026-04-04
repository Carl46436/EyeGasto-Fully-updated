export type CurrencyCode =
  | "PHP"
  | "USD"
  | "EUR"
  | "SGD"
  | "VND"
  | "GBP"
  | "JPY"
  | "AUD"
  | "CAD";

export const SUPPORTED_CURRENCIES: {
  code: CurrencyCode;
  label: string;
}[] = [
  { code: "PHP", label: "Philippine Peso" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "VND", label: "Vietnamese Dong" },
  { code: "GBP", label: "British Pound" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "CAD", label: "Canadian Dollar" },
];

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  PHP: "en-PH",
  USD: "en-US",
  EUR: "de-DE",
  SGD: "en-SG",
  VND: "vi-VN",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
};

export const formatCurrency = (
  amount: number,
  currencyCode: CurrencyCode,
  maximumFractionDigits = 2,
) =>
  new Intl.NumberFormat(CURRENCY_LOCALES[currencyCode], {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits,
  }).format(amount);

export const getCurrencyLabel = (currencyCode: CurrencyCode) =>
  SUPPORTED_CURRENCIES.find((item) => item.code === currencyCode)?.label ??
  currencyCode;
