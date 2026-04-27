import {
  CategoryBudget,
  DebtItem,
  RecurringExpenseTemplate,
  User,
} from "../types/index";
import { buildAuthRedirectUrl } from "./authRedirect";
import financialPlanningService from "./financialPlanningService";
import storageService, { StorageKeys } from "./storageService";
import { supabase } from "./supabaseClient";
import { normalizeCategoryName } from "../utils/category";

class AuthService {
  private async persistCurrentUser(user: User | null) {
    if (!user) {
      await storageService.removeItem(StorageKeys.CURRENT_USER);
      return;
    }

    await storageService.setItem(StorageKeys.CURRENT_USER, user);
  }

  private async getStoredUser() {
    return storageService.getItem<User>(StorageKeys.CURRENT_USER);
  }

  private async clearInvalidSession() {
    await storageService.removeItem(StorageKeys.SUPABASE_SESSION);
  }

  private mapRecurringExpenses(value: unknown): RecurringExpenseTemplate[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is RecurringExpenseTemplate => {
        return !!item && typeof item === "object" && "id" in item;
      })
      .map((item) => ({
        id: item.id,
        description: item.description,
        amount: Number(item.amount) || 0,
        category: item.category ?? undefined,
        notes: item.notes ?? undefined,
        frequency: "monthly",
        startDate: item.startDate,
        dayOfMonth: Number(item.dayOfMonth) || 1,
        lastGeneratedAt: item.lastGeneratedAt ?? undefined,
        isActive: item.isActive ?? true,
      }));
  }

  private mapCategoryBudgets(value: unknown): CategoryBudget[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is CategoryBudget => {
        return !!item && typeof item === "object" && "id" in item;
      })
      .map((item) => ({
        id: item.id,
        category: normalizeCategoryName(item.category),
        limit: Number(item.limit) || 0,
        note: item.note ?? undefined,
        updatedAt: item.updatedAt ?? undefined,
      }));
  }

  private mapDebtItems(value: unknown): DebtItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is DebtItem => {
        return !!item && typeof item === "object" && "id" in item;
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        amount: Number(item.amount) || 0,
        dueDate: item.dueDate,
        person: item.person ?? undefined,
        note: item.note ?? undefined,
        isPaid: item.isPaid ?? false,
        createdAt: item.createdAt ?? undefined,
      }));
  }

  private mapSupabaseUser(su: any): User {
    return {
      id: su.id,
      email: su.email ?? "",
      name: su.user_metadata?.name ?? su.email ?? "",
      avatar: su.user_metadata?.avatar ?? null,
      password: "",
      createdAt: su.created_at ? new Date(su.created_at) : new Date(),
      recurringExpenses: this.mapRecurringExpenses(
        su.user_metadata?.recurringExpenses,
      ),
      categoryBudgets: [],
      debtItems: [],
    };
  }

  private async hydrateSupabaseUser(su: any): Promise<User> {
    const baseUser = this.mapSupabaseUser(su);
    const [tableBudgets, tableDebtItems] = await Promise.all([
      financialPlanningService.getCategoryBudgets(baseUser.id),
      financialPlanningService.getDebtItems(baseUser.id),
    ]);

    const metadataBudgets = this.mapCategoryBudgets(
      su.user_metadata?.categoryBudgets,
    );
    const metadataDebts = this.mapDebtItems(su.user_metadata?.debtItems);

    // Keep compatibility with existing accounts and auto-migrate metadata once.
    if (tableBudgets.length === 0 && metadataBudgets.length > 0) {
      await financialPlanningService.replaceCategoryBudgets(
        baseUser.id,
        metadataBudgets,
      );
    }
    if (tableDebtItems.length === 0 && metadataDebts.length > 0) {
      await financialPlanningService.replaceDebtItems(baseUser.id, metadataDebts);
    }

    const refreshedBudgets =
      tableBudgets.length > 0 ? tableBudgets : metadataBudgets;
    const refreshedDebts = tableDebtItems.length > 0 ? tableDebtItems : metadataDebts;

    return {
      ...baseUser,
      categoryBudgets: refreshedBudgets,
      debtItems: refreshedDebts,
    };
  }

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      if (!email || !password || !name) {
        return { success: false, error: "All fields are required" };
      }

      if (password.length < 6) {
        return {
          success: false,
          error: "Password must be at least 6 characters",
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: buildAuthRedirectUrl("auth/callback"),
        },
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || "Registration failed",
        };
      }

      const user = await this.hydrateSupabaseUser(data.user);
      await this.persistCurrentUser(user);
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message || "Registration failed" };
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || "Login failed",
        };
      }

      const user = await this.hydrateSupabaseUser(data.user);
      await this.persistCurrentUser(user);
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message || "Login failed" };
    }
  }

  async verifyEmailOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || "Verification failed",
        };
      }

      const user = await this.hydrateSupabaseUser(data.user);
      await this.persistCurrentUser(user);
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message || "Verification failed" };
    }
  }

  async sendRecoveryOtp(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to send recovery code",
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to send recovery code",
      };
    }
  }

  async verifyRecoveryOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Verification failed",
        };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || "Verification failed" };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (
          error?.message?.includes("Invalid Refresh Token") ||
          error?.message?.includes("Refresh Token Not Found")
        ) {
          await this.clearInvalidSession();
        }
        return this.getStoredUser();
      }
      const user = await this.hydrateSupabaseUser(data.user);
      await this.persistCurrentUser(user);
      return user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return this.getStoredUser();
    }
  }

  async logout(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await this.persistCurrentUser(null);
      return true;
    } catch (error) {
      console.error("Error logging out:", error);
      await this.persistCurrentUser(null);
      return true;
    }
  }

  async updateUser(updates: {
    name?: string;
    email?: string;
    avatar?: string;
    recurringExpenses?: RecurringExpenseTemplate[];
    categoryBudgets?: CategoryBudget[];
    debtItems?: DebtItem[];
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const sessionEnsured = await this.ensureActiveSession();
      if (!sessionEnsured) {
        return { success: false, error: "Auth session missing!" };
      }

      const updateData: any = { data: {} };
      const hasNameUpdate = updates.name !== undefined;
      const hasAvatarUpdate = updates.avatar !== undefined;
      const hasRecurringUpdate = updates.recurringExpenses !== undefined;
      const hasEmailUpdate = updates.email !== undefined;

      if (hasNameUpdate) updateData.data.name = updates.name;
      if (hasAvatarUpdate) updateData.data.avatar = updates.avatar;
      if (hasRecurringUpdate) {
        updateData.data.recurringExpenses = updates.recurringExpenses;
      }
      if (hasEmailUpdate) updateData.email = updates.email;

      if (Object.keys(updateData.data).length === 0) {
        delete updateData.data;
      }

      if (updateData.data || updateData.email) {
        const { error } = await supabase.auth.updateUser(updateData);
        if (error) {
          return { success: false, error: error.message || "Update failed" };
        }
      }

      const {
        data: { user: authUser },
        error: authUserError,
      } = await supabase.auth.getUser();
      if (authUserError || !authUser) {
        return {
          success: false,
          error: authUserError?.message || "Unable to read current user",
        };
      }

      if (updates.categoryBudgets !== undefined) {
        const normalizedBudgets = updates.categoryBudgets.map((item) => ({
          ...item,
          category: normalizeCategoryName(item.category),
          updatedAt: item.updatedAt ?? new Date().toISOString(),
        }));
        const budgetUpdateSucceeded =
          await financialPlanningService.replaceCategoryBudgets(
            authUser.id,
            normalizedBudgets,
          );
        if (!budgetUpdateSucceeded) {
          return { success: false, error: "Failed to update category budgets" };
        }
      }

      if (updates.debtItems !== undefined) {
        const debtUpdateSucceeded = await financialPlanningService.replaceDebtItems(
          authUser.id,
          updates.debtItems,
        );
        if (!debtUpdateSucceeded) {
          return { success: false, error: "Failed to update debt items" };
        }
      }

      const hydratedUser = await this.hydrateSupabaseUser(authUser);
      await this.persistCurrentUser(hydratedUser);
      return { success: true, user: hydratedUser };
    } catch (error: any) {
      return { success: false, error: error.message || "Update failed" };
    }
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    options?: {
      skipCurrentPasswordCheck?: boolean;
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!options?.skipCurrentPasswordCheck && !currentPassword) {
        return { success: false, error: "Current password is required" };
      }

      if (!newPassword) {
        return { success: false, error: "Password is required" };
      }

      if (!options?.skipCurrentPasswordCheck) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        const currentEmail = userData.user?.email;

        if (userError || !currentEmail) {
          return {
            success: false,
            error: userError?.message || "Unable to verify current user",
          };
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: currentPassword,
        });

        if (reauthError) {
          return {
            success: false,
            error: "Current password is incorrect",
          };
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return {
          success: false,
          error: error.message || "Password update failed",
        };
      }
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Password update failed",
      };
    }
  }

  async checkAuthStatus(): Promise<{
    isAuthenticated: boolean;
    user: User | null;
  }> {
    const user = await this.getCurrentUser();
    return { isAuthenticated: !!user, user };
  }

  private async ensureActiveSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return true;
    }

    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      return false;
    }

    return true;
  }
}

export default new AuthService();
