import { RecurringExpenseTemplate, User } from "../types/index";
import { buildAuthRedirectUrl } from "./authRedirect";
import { supabase } from "./supabaseClient";

class AuthService {
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

      const user = this.mapSupabaseUser(data.user);
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

      const user = this.mapSupabaseUser(data.user);
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message || "Login failed" };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return this.mapSupabaseUser(data.user);
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  async logout(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error logging out:", error);
      return false;
    }
  }

  async updateUser(updates: {
    name?: string;
    email?: string;
    avatar?: string;
    recurringExpenses?: RecurringExpenseTemplate[];
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const updateData: any = { data: {} };
      if (updates.name) updateData.data.name = updates.name;
      if (updates.avatar) updateData.data.avatar = updates.avatar;
      if (updates.recurringExpenses) {
        updateData.data.recurringExpenses = updates.recurringExpenses;
      }
      if (updates.email) updateData.email = updates.email;

      // If no name or avatar update, we don't need 'data' key
      if (Object.keys(updateData.data).length === 0) {
        delete updateData.data;
      }

      const { data, error } = await supabase.auth.updateUser(updateData);

      if (error || !data.user) {
        return { success: false, error: error?.message || "Update failed" };
      }

      const user = this.mapSupabaseUser(data.user);
      return { success: true, user };
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
}

export default new AuthService();
