import { CategoryBudget, DebtItem } from "@/src/types";

import {
  BudgetCategoryEntry,
  DebtReminderEntry,
} from "./types";

export const toBudgetCategoryEntry = (
  budget: CategoryBudget,
): BudgetCategoryEntry => ({
  id: budget.id,
  category: budget.category,
  amount: Number(budget.limit) || 0,
  note: budget.note ?? undefined,
  createdAt: budget.updatedAt ?? new Date().toISOString(),
});

export const toDebtReminderEntry = (debt: DebtItem): DebtReminderEntry => ({
  id: debt.id,
  title: debt.title,
  amount: Number(debt.amount) || 0,
  lender: debt.person ?? "N/A",
  dueDate: debt.dueDate,
  note: debt.note ?? undefined,
  paid: debt.isPaid ?? false,
  createdAt: debt.createdAt ?? new Date().toISOString(),
  paidAt: debt.isPaid ? debt.createdAt ?? new Date().toISOString() : undefined,
});

export const toServiceCategoryBudget = (
  entry: BudgetCategoryEntry,
): CategoryBudget => ({
  id: entry.id,
  category: entry.category,
  limit: entry.amount,
  note: entry.note,
  updatedAt: entry.createdAt,
});

export const toServiceDebtItem = (entry: DebtReminderEntry): DebtItem => ({
  id: entry.id,
  title: entry.title,
  amount: entry.amount,
  dueDate: entry.dueDate,
  person: entry.lender,
  note: entry.note,
  isPaid: entry.paid,
  createdAt: entry.createdAt,
});

export const normalizeBudgetCategoryKey = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();
