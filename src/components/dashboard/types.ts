import { CurrencyCode } from "@/src/services/currency";
import { AppLanguage } from "@/src/i18n/appLanguage";

export type InfoSheet = "terms" | "privacy" | "faq" | "about" | null;
export type ThemeMode = "dark" | "light";
export type ExportFormat = "csv" | "pdf" | "summary";
export type DateRangeKey =
  | "today"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "last30Days"
  | "allTime";
export type MomentumWindow = "7d" | "30d" | "90d";

export interface InfoSection {
  heading: string;
  body: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface DashboardPreferences {
  themeMode: ThemeMode;
  monthlyBudget: number;
  activeTab: "overview" | "budget" | "stats" | "gallery" | "profile";
  selectedCategory: string | "All";
  dateRange: DateRangeKey;
  preferredCurrency: CurrencyCode;
  preferredLanguage?: AppLanguage;
  onboardingSeenForUserId?: string;
}

export interface BudgetCategoryEntry {
  id: string;
  category: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface DebtReminderEntry {
  id: string;
  title: string;
  amount: number;
  lender: string;
  dueDate: string;
  note?: string;
  paid: boolean;
  createdAt: string;
  paidAt?: string;
}

export interface ConfirmationDialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
}
