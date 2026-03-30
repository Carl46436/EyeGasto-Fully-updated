import { Expense } from "../types";
import { supabase } from "./supabaseClient";
import authService from "./authService";
import expenseStorage from "./expenseStorage";

class ExpenseService {
  private mapExpenseRecord(record: any): Expense {
    const resolvedImageUrl =
      expenseStorage.getReceiptPublicUrl(record.receipt_path) ||
      record.image_url ||
      undefined;

    return {
      id: record.id,
      description: record.description,
      amount: record.amount,
      date: new Date(record.date),
      category: record.category ?? undefined,
      notes: record.notes ?? undefined,
      imageUrl: resolvedImageUrl,
      receiptPath: record.receipt_path ?? undefined,
    };
  }

  async addExpense(
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
  ): Promise<{ success: boolean; expense?: Expense; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      if (!description || !amount) {
        return { success: false, error: "Description and amount are required" };
      }

      if (amount <= 0) {
        return { success: false, error: "Amount must be greater than 0" };
      }

      let uploadedReceipt:
        | { imageUrl?: string; path?: string }
        | undefined;

      if (imageUri) {
        const uploadResult = await expenseStorage.uploadReceipt(imageUri);
        if (!uploadResult.success) {
          return {
            success: false,
            error: uploadResult.error || "Failed to upload receipt",
          };
        }
        uploadedReceipt = uploadResult;
      }

      const { data, error } = await supabase
        .from("expenses")
        .insert({
          user_id: currentUser.id,
          description,
          amount,
          date: new Date().toISOString(),
          category: category || null,
          notes: notes || null,
          image_url: uploadedReceipt?.imageUrl || null,
          receipt_path: uploadedReceipt?.path || null,
        })
        .select("*")
        .single();

      if (error || !data) {
        return {
          success: false,
          error: error?.message || "Failed to add expense",
        };
      }

      return { success: true, expense: this.mapExpenseRecord(data) };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to add expense",
      };
    }
  }

  async getExpenses(): Promise<Expense[]> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return [];
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

      if (error || !data) {
        console.error("Error fetching expenses:", error);
        return [];
      }

      return data.map((e: any) => this.mapExpenseRecord(e));
    } catch (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }
  }

  async deleteExpense(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const { data, error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id)
        .select("receipt_path")
        .single();

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to delete expense",
        };
      }

      await expenseStorage.removeReceipt(data?.receipt_path);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete expense",
      };
    }
  }

  async updateExpense(
    id: string,
    updates: Partial<Expense>,
  ): Promise<{ success: boolean; expense?: Expense; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const { data: existingExpense } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      const updatePayload: Record<string, any> = {
        description: updates.description,
        amount: updates.amount,
        category: updates.category,
        notes: updates.notes,
        date:
          updates.date instanceof Date
            ? updates.date.toISOString()
            : updates.date,
      };

      if (updates.imageUrl !== undefined) {
        if (
          updates.imageUrl &&
          !/^https?:\/\//i.test(updates.imageUrl) &&
          !updates.imageUrl.startsWith("data:")
        ) {
          const uploadResult = await expenseStorage.uploadReceipt(
            updates.imageUrl,
          );
          if (!uploadResult.success) {
            return {
              success: false,
              error: uploadResult.error || "Failed to upload receipt",
            };
          }
          updatePayload.image_url = uploadResult.imageUrl ?? null;
          updatePayload.receipt_path = uploadResult.path ?? null;
        } else {
          updatePayload.image_url = updates.imageUrl;
          updatePayload.receipt_path = updates.receiptPath ?? null;
        }
      }

      Object.keys(updatePayload).forEach((key) => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

      const { data, error } = await supabase
        .from("expenses")
        .update(updatePayload)
        .eq("id", id)
        .eq("user_id", currentUser.id)
        .select("*")
        .maybeSingle();

      if (error) {
        return {
          success: false,
          error: error?.message || "Failed to update expense",
        };
      }

      const shouldRemoveOldReceipt =
        existingExpense?.receipt_path &&
        existingExpense.receipt_path !== data?.receipt_path &&
        (updates.imageUrl !== undefined || updates.receiptPath === null);

      if (shouldRemoveOldReceipt) {
        await expenseStorage.removeReceipt(existingExpense.receipt_path);
      }

      const resolvedExpense = data ?? {
        ...existingExpense,
        id,
        description: updates.description ?? existingExpense?.description ?? "",
        amount: updates.amount ?? existingExpense?.amount ?? 0,
        category:
          updates.category !== undefined
            ? updates.category
            : existingExpense?.category,
        notes:
          updates.notes !== undefined ? updates.notes : existingExpense?.notes,
        date: updates.date ?? existingExpense?.date ?? new Date().toISOString(),
        image_url:
          updatePayload.image_url !== undefined
            ? updatePayload.image_url
            : existingExpense?.image_url,
        receipt_path:
          updatePayload.receipt_path !== undefined
            ? updatePayload.receipt_path
            : existingExpense?.receipt_path,
      };

      return { success: true, expense: this.mapExpenseRecord(resolvedExpense) };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update expense",
      };
    }
  }

  async getTotalExpenses(): Promise<number> {
    const expenses = await this.getExpenses();
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  async getMonthlyExpenses(month: number, year: number): Promise<Expense[]> {
    const expenses = await this.getExpenses();
    return expenses.filter((e) => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === month && eDate.getFullYear() === year;
    });
  }

  async getCategoryBreakdown(): Promise<Record<string, number>> {
    const expenses = await this.getExpenses();
    const breakdown: Record<string, number> = {};

    expenses.forEach((e) => {
      const category = e.category || "Uncategorized";
      breakdown[category] = (breakdown[category] || 0) + e.amount;
    });

    return breakdown;
  }

  async searchExpenses(query: string): Promise<Expense[]> {
    const expenses = await this.getExpenses();
    const lowerQuery = query.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(lowerQuery) ||
        e.notes?.toLowerCase().includes(lowerQuery),
    );
  }

  async clearAllExpenses(): Promise<boolean> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) return false;

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", currentUser.id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error clearing expenses:", error);
      return false;
    }
  }
}

export default new ExpenseService();
