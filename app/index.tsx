import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import DashboardScreen from "./components/DashboardScreen";
import LoadingScreen from "./components/LoadingScreen";
import ErrorAlert from "./components/ErrorAlert";
import authService from "./services/authService";
import expenseService from "./services/expenseService";
import { Expense, RecurringExpenseTemplate, User } from "./types";

type Screen = "welcome" | "login" | "register" | "dashboard";
type AlertState = {
  message: string;
  type: "error" | "warning" | "success";
};

export default function Index() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const showAlert = useCallback((
    message: string,
    type: AlertState["type"] = "error",
  ) => {
    setAlertState({ message, type });
  }, []);

  const loadExpensesForUser = useCallback(async (baseUser: User) => {
    setIsExpensesLoading(true);

    const syncResult = await expenseService.syncRecurringExpenses(baseUser);
    const resolvedUser = syncResult.user ?? baseUser;
    setUser(resolvedUser);

    const userExpenses = await expenseService.getExpenses();
    setExpenses(userExpenses);

    if (syncResult.syncedCount > 0) {
      showAlert(
        `${syncResult.syncedCount} recurring expense${
          syncResult.syncedCount === 1 ? "" : "s"
        } added automatically.`,
        "success",
      );
    }
  }, [showAlert]);

  // Check auth status on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const { isAuthenticated, user: currentUser } =
          await authService.checkAuthStatus();

        if (isAuthenticated && currentUser) {
          setCurrentScreen("dashboard");
          setIsLoading(false);
          await loadExpensesForUser(currentUser);
        } else {
          setCurrentScreen("welcome");
        }
      } catch (err: any) {
        showAlert(err.message || "Failed to initialize app");
        setCurrentScreen("welcome");
      } finally {
        setIsExpensesLoading(false);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [loadExpensesForUser, showAlert]);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);

      if (!result.success) {
        showAlert(result.error || "Gmail needs to be registered first");
        return;
      }

      setUser(result.user || null);
      setCurrentScreen("dashboard");
      setIsLoading(false);
      if (result.user) {
        await loadExpensesForUser(result.user);
      }
    } catch (err: any) {
      showAlert(err.message || "Login error");
    } finally {
      setIsExpensesLoading(false);
      setIsLoading(false);
    }
  };

  const handleRegister = async (
    email: string,
    password: string,
    name: string,
  ) => {
    try {
      setIsLoading(true);
      const result = await authService.register(email, password, name);

      if (!result.success) {
        showAlert(result.error || "Registration failed");
        return;
      }

      showAlert(
        "Registration successful! Please check your email for verification.",
        "success",
      );
      setTimeout(() => {
        setAlertState(null);
        setCurrentScreen("login");
      }, 2000);
    } catch (err: any) {
      showAlert(err.message || "Registration error");
    } finally {
      setIsLoading(false);
    }
  };

  // Password update handler
  const handleChangePassword = async (
    oldPassword: string,
    newPassword: string,
  ) => {
    try {
      setIsLoading(true);
      const result = await authService.changePassword(newPassword);
      if (!result.success) {
        throw new Error(result.error || "Password update failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
    options?: {
      recurringMonthly?: boolean;
    },
  ): Promise<boolean> => {
    const tempId = `temp-${Date.now()}`;
    const optimisticExpense: Expense = {
      id: tempId,
      description,
      amount,
      category,
      notes,
      date: new Date(),
      imageUrl: imageUri ?? null,
      isPending: true,
    };

    setExpenses((prev) => [optimisticExpense, ...prev]);

    try {
      const result = await expenseService.addExpense(
        description,
        amount,
        category,
        notes,
        imageUri,
      );

      if (!result.success) {
        setExpenses((prev) => prev.filter((expense) => expense.id !== tempId));
        showAlert(result.error || "Failed to add expense");
        return false;
      }

      if (result.expense) {
        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === tempId ? result.expense! : expense,
          ),
        );
      }

      if (options?.recurringMonthly && user && result.expense) {
        const expenseDate = new Date(result.expense.date);
        const recurringTemplate: RecurringExpenseTemplate = {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          description,
          amount,
          category,
          notes,
          frequency: "monthly",
          startDate: expenseDate.toISOString(),
          dayOfMonth: expenseDate.getDate(),
          lastGeneratedAt: expenseDate.toISOString(),
          isActive: true,
        };

        const updateResult = await authService.updateUser({
          recurringExpenses: [
            ...(user.recurringExpenses ?? []),
            recurringTemplate,
          ],
        });

        if (updateResult.success && updateResult.user) {
          setUser(updateResult.user);
          showAlert(
            "Expense added and monthly recurring plan created.",
            "success",
          );
        } else {
          showAlert(
            "Expense added, but the recurring plan could not be saved.",
            "warning",
          );
        }
      } else {
        showAlert("Expense added successfully.", "success");
      }
      return true;
    } catch (err: any) {
      setExpenses((prev) => prev.filter((expense) => expense.id !== tempId));
      showAlert(err.message || "Error adding expense");
      return false;
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const currentExpenses = expenses;
    const removedIndex = currentExpenses.findIndex((expense) => expense.id === id);
    const removedExpense = currentExpenses[removedIndex];

    if (!removedExpense) {
      return;
    }

    setExpenses((prev) => prev.filter((expense) => expense.id !== id));

    try {
      const result = await expenseService.deleteExpense(id);

      if (!result.success) {
        setExpenses((prev) => {
          const restored = [...prev];
          restored.splice(removedIndex, 0, removedExpense);
          return restored;
        });
        showAlert(result.error || "Failed to delete expense");
        return;
      }

      showAlert("Expense deleted successfully.", "success");
    } catch (err: any) {
      setExpenses((prev) => {
        const restored = [...prev];
        restored.splice(removedIndex, 0, removedExpense);
        return restored;
      });
      showAlert(err.message || "Error deleting expense");
    }
  };

  const handleClearAllExpenses = async () => {
    try {
      const success = await expenseService.clearAllExpenses();
      if (!success) {
        showAlert("Failed to clear expenses");
        return;
      }
      setExpenses([]);
      showAlert("All expenses cleared.", "success");
    } catch (err: any) {
      showAlert(err.message || "Error clearing expenses");
    }
  };

  const handleUpdateExpense = async (
    id: string,
    updates: Partial<Expense>,
  ): Promise<boolean> => {
    const previousExpense = expenses.find((expense) => expense.id === id);
    if (!previousExpense) {
      return false;
    }

    setExpenses((prev) =>
      prev.map((expense) =>
        expense.id === id
          ? {
              ...expense,
              ...updates,
              date:
                updates.date !== undefined
                  ? updates.date
                  : expense.date,
              isPending: true,
            }
          : expense,
      ),
    );

    try {
      const result = await expenseService.updateExpense(id, updates);
      if (!result.success) {
        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === id ? previousExpense : expense,
          ),
        );
        showAlert(result.error || "Failed to update expense");
        return false;
      }
      setExpenses((prev) =>
        prev.map((expense) => {
          if (expense.id !== id) {
            return expense;
          }

          if (result.expense) {
            return result.expense;
          }

          return {
            ...expense,
            ...updates,
            isPending: false,
          };
        }),
      );
      showAlert("Expense edited successfully.", "success");
      return true;
    } catch (err: any) {
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === id ? previousExpense : expense)),
      );
      showAlert(err.message || "Error updating expense");
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setExpenses([]);
      setCurrentScreen("welcome");
    } catch (err: any) {
      showAlert(err.message || "Logout error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Initializing..." />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {alertState && (
        <ErrorAlert
          message={alertState.message}
          type={alertState.type}
          duration={3000}
          onDismiss={() => setAlertState(null)}
        />
      )}

      {currentScreen === "welcome" && (
        <WelcomeScreen
          onLoginPress={() => setCurrentScreen("login")}
          onRegisterPress={() => setCurrentScreen("register")}
        />
      )}

      {currentScreen === "login" && (
        <LoginScreen
          onLogin={handleLogin}
          onBackPress={() => setCurrentScreen("welcome")}
          onRegisterPress={() => setCurrentScreen("register")}
        />
      )}

      {currentScreen === "register" && (
        <RegisterScreen
          onRegister={handleRegister}
          onBackPress={() => setCurrentScreen("welcome")}
          onLoginPress={() => setCurrentScreen("login")}
        />
      )}

      {currentScreen === "dashboard" && user && (
        <DashboardScreen
          user={user}
          expenses={expenses}
          isExpensesLoading={isExpensesLoading}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          onUpdateExpense={handleUpdateExpense}
          onClearAll={handleClearAllExpenses}
          onLogout={handleLogout}
          onUpdateUser={async (updates) => {
            try {
              setIsLoading(true);
              const result = await authService.updateUser(updates);
              if (!result.success) {
                throw new Error(result.error || "Failed to update profile");
              }
              if (result.user) {
                setUser(result.user);
              }
            } finally {
              setIsLoading(false);
            }
          }}
          onChangePassword={handleChangePassword}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
});
