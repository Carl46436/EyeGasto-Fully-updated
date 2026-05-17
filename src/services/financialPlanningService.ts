import { CategoryBudget, DebtItem } from "../types";
import { withNetworkTimeout } from "./networkTimeout";
import { supabase } from "./supabaseClient";

type CategoryBudgetRow = {
  id: string;
  category: string;
  limit_amount: number;
  note: string | null;
};

type DebtItemRow = {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  person: string | null;
  note: string | null;
  is_paid: boolean;
  created_at: string;
};

class FinancialPlanningService {
  async getCategoryBudgets(userId: string): Promise<CategoryBudget[]> {
    const { data, error } = await withNetworkTimeout(
      supabase
        .from("category_budgets")
        .select("id, category, limit_amount, note")
        .eq("user_id", userId)
        .order("category", { ascending: true }),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (error || !data) {
      return [];
    }

    return (data as CategoryBudgetRow[]).map((row) => ({
      id: row.id,
      category: row.category,
      limit: Number(row.limit_amount) || 0,
      note: row.note ?? undefined,
    }));
  }

  async replaceCategoryBudgets(
    userId: string,
    budgets: CategoryBudget[],
  ): Promise<boolean> {
    const { error: deleteError } = await withNetworkTimeout(
      supabase
        .from("category_budgets")
        .delete()
        .eq("user_id", userId),
    ).catch(() => ({ error: new Error("Network timed out") }));

    if (deleteError) {
      return false;
    }

    if (budgets.length === 0) {
      return true;
    }

    const payload = budgets.map((budget) => ({
      id: budget.id,
      user_id: userId,
      category: budget.category,
      limit_amount: budget.limit,
      note: budget.note ?? null,
    }));

    const { error: insertError } = await withNetworkTimeout(
      supabase
        .from("category_budgets")
        .insert(payload),
    ).catch(() => ({ error: new Error("Network timed out") }));

    return !insertError;
  }

  async getDebtItems(userId: string): Promise<DebtItem[]> {
    const { data, error } = await withNetworkTimeout(
      supabase
        .from("debt_items")
        .select("id, title, amount, due_date, person, note, is_paid, created_at")
        .eq("user_id", userId)
        .order("due_date", { ascending: true }),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (error || !data) {
      return [];
    }

    return (data as DebtItemRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      amount: Number(row.amount) || 0,
      dueDate: row.due_date,
      person: row.person ?? undefined,
      note: row.note ?? undefined,
      isPaid: row.is_paid ?? false,
      createdAt: row.created_at ?? undefined,
    }));
  }

  async replaceDebtItems(userId: string, debts: DebtItem[]): Promise<boolean> {
    const { error: deleteError } = await withNetworkTimeout(
      supabase
        .from("debt_items")
        .delete()
        .eq("user_id", userId),
    ).catch(() => ({ error: new Error("Network timed out") }));

    if (deleteError) {
      return false;
    }

    if (debts.length === 0) {
      return true;
    }

    const payload = debts.map((debt) => ({
      id: debt.id,
      user_id: userId,
      title: debt.title,
      amount: debt.amount,
      due_date: debt.dueDate,
      person: debt.person ?? null,
      note: debt.note ?? null,
      is_paid: debt.isPaid ?? false,
      created_at: debt.createdAt ?? new Date().toISOString(),
    }));

    const { error: insertError } = await withNetworkTimeout(
      supabase.from("debt_items").insert(payload),
    ).catch(() => ({ error: new Error("Network timed out") }));

    return !insertError;
  }
}

export default new FinancialPlanningService();
