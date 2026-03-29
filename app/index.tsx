import React, { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import DashboardScreen from "./components/DashboardScreen";
import LoadingScreen from "./components/LoadingScreen";
import ErrorAlert from "./components/ErrorAlert";
import authService from "./services/authService";
import expenseService from "./services/expenseService";
import { Expense, User } from "./types";

type Screen = "welcome" | "login" | "register" | "dashboard";

export default function Index() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const { isAuthenticated, user: currentUser } =
          await authService.checkAuthStatus();

        if (isAuthenticated && currentUser) {
          setUser(currentUser);
          setCurrentScreen("dashboard");
          setIsExpensesLoading(true);
          setIsLoading(false);
          const userExpenses = await expenseService.getExpenses();
          setExpenses(userExpenses);
        } else {
          setCurrentScreen("welcome");
        }
      } catch (err: any) {
        setError(err.message || "Failed to initialize app");
        setCurrentScreen("welcome");
      } finally {
        setIsExpensesLoading(false);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);

      if (!result.success) {
        setError(result.error || "Gmail needs to be registered first");
        return;
      }

      setUser(result.user || null);
      setCurrentScreen("dashboard");
      setIsExpensesLoading(true);
      setIsLoading(false);
      const userExpenses = await expenseService.getExpenses();
      setExpenses(userExpenses);
    } catch (err: any) {
      setError(err.message || "Login error");
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
        setError(result.error || "Registration failed");
        return;
      }

      setError(
        "Registration successful! Please check your email for verification.",
      );
      setTimeout(() => {
        setError(null);
        setCurrentScreen("login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration error");
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
        setError(result.error || "Failed to add expense");
        return false;
      }

      if (result.expense) {
        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === tempId ? result.expense! : expense,
          ),
        );
      }
      return true;
    } catch (err: any) {
      setExpenses((prev) => prev.filter((expense) => expense.id !== tempId));
      setError(err.message || "Error adding expense");
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
        setError(result.error || "Failed to delete expense");
        return;
      }
    } catch (err: any) {
      setExpenses((prev) => {
        const restored = [...prev];
        restored.splice(removedIndex, 0, removedExpense);
        return restored;
      });
      setError(err.message || "Error deleting expense");
    }
  };

  const handleClearAllExpenses = async () => {
    try {
      const success = await expenseService.clearAllExpenses();
      if (!success) {
        setError("Failed to clear expenses");
        return;
      }
      setExpenses([]);
    } catch (err: any) {
      setError(err.message || "Error clearing expenses");
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
        setError(result.error || "Failed to update expense");
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
      return true;
    } catch (err: any) {
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === id ? previousExpense : expense)),
      );
      setError(err.message || "Error updating expense");
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
      setError(err.message || "Logout error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Initializing..." />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {error && (
        <ErrorAlert
          message={error}
          type={error.includes("successful") ? "success" : "error"}
          duration={3000}
          onDismiss={() => setError(null)}
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
