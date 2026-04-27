import React, { useCallback, useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { SafeAreaView, StyleSheet } from "react-native";

import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import EmailConfirmedScreen from "./components/EmailConfirmedScreen";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import VerifyEmailOtpScreen from "./components/VerifyEmailOtpScreen";
import DashboardScreen from "./components/DashboardScreen";
import LoadingScreen from "./components/LoadingScreen";
import ErrorAlert from "./components/ErrorAlert";
import OnboardingIntroScreen from "./components/OnboardingIntroScreen";
import authService from "@/src/services/authService";
import { parseAuthRedirectUrl } from "@/src/services/authRedirect";
import expenseService from "@/src/services/expenseService";
import storageService, { StorageKeys } from "@/src/services/storageService";
import appLogger from "@/src/services/appLogger";
import { supabase } from "@/src/services/supabaseClient";
import { Expense, RecurringExpenseTemplate, User } from "@/src/types";

type Screen =
  | "onboardingIntro"
  | "welcome"
  | "login"
  | "register"
  | "verifyEmailOtp"
  | "verifyRecoveryOtp"
  | "emailConfirmed"
  | "resetPassword"
  | "dashboard";
type AlertState = {
  message: string;
  type: "error" | "warning" | "success";
};

type UserUpdatePayload = Partial<User>;

export default function Index() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("onboardingIntro");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [pendingRecoveryEmail, setPendingRecoveryEmail] = useState("");
  const [shouldShowGuideForThisSession, setShouldShowGuideForThisSession] =
    useState(false);

  const showAlert = useCallback((
    message: string,
    type: AlertState["type"] = "error",
  ) => {
    setAlertState({ message, type });
  }, []);

  const resetDashboardViewPreference = useCallback(async () => {
    const preferences = await storageService.getItem<{
      themeMode?: "dark" | "light";
      monthlyBudget?: number;
      activeTab?: "overview" | "budget" | "stats" | "gallery" | "profile";
      selectedCategory?: string | "All";
      dateRange?: "today" | "thisWeek" | "thisMonth" | "allTime";
    }>(StorageKeys.DASHBOARD_PREFERENCES);

    if (!preferences) {
      return;
    }

    await storageService.setItem(StorageKeys.DASHBOARD_PREFERENCES, {
      ...preferences,
      activeTab: "overview",
    });
  }, []);

  const loadExpensesForUser = useCallback(async (baseUser: User) => {
    setIsExpensesLoading(true);
    try {
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
    } finally {
      setIsExpensesLoading(false);
    }
  }, [showAlert]);

  const enqueuePendingUserUpdate = useCallback(
    async (updates: UserUpdatePayload) => {
      const current =
        (await storageService.getItem<UserUpdatePayload[]>(
          StorageKeys.PENDING_USER_UPDATES,
        )) ?? [];
      await storageService.setItem(StorageKeys.PENDING_USER_UPDATES, [
        ...current,
        updates,
      ]);
      await appLogger.log("pending_user_update_enqueued", "warn", {
        keys: Object.keys(updates),
      });
    },
    [],
  );

  const flushPendingUserUpdates = useCallback(async () => {
    const pending =
      (await storageService.getItem<UserUpdatePayload[]>(
        StorageKeys.PENDING_USER_UPDATES,
      )) ?? [];
    if (pending.length === 0) {
      return;
    }

    for (const updates of pending) {
      const result = await authService.updateUser(updates);
      if (!result.success) {
        await appLogger.log("pending_user_update_flush_failed", "warn", {
          error: result.error,
        });
        return;
      }
      if (result.user) {
        setUser(result.user);
      }
    }

    await storageService.removeItem(StorageKeys.PENDING_USER_UPDATES);
    await appLogger.log("pending_user_update_flush_success", "info", {
      count: pending.length,
    });
  }, []);

  const handleAuthRedirect = useCallback(async (url: string) => {
    const { accessToken, refreshToken, tokenHash, code, type } =
      parseAuthRedirectUrl(url);
    const webType =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("type") ?? undefined
        : undefined;
    const resolvedType = type ?? webType;

    if (!resolvedType && !code) {
      return "none" as const;
    }

    try {
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: resolvedType as any,
        });

        if (error) {
          throw error;
        }
      } else {
        return "none" as const;
      }

      if (resolvedType === "recovery") {
        setCurrentScreen("resetPassword");
        showAlert("Recovery link verified. Enter a new password.", "success");
        return "recovery" as const;
      }

      if (resolvedType === "signup" || resolvedType === "email") {
        await supabase.auth.signOut();
        setUser(null);
        setExpenses([]);
        setCurrentScreen("emailConfirmed");
        return "confirmed" as const;
      }

      return "auth" as const;
    } catch (err: any) {
      showAlert(err.message || "This email link is invalid or expired.");
      setCurrentScreen("login");
      return "error" as const;
    }
  }, [showAlert]);

  // Check auth status on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const redirectResult = await handleAuthRedirect(initialUrl);
          if (
            redirectResult === "recovery" ||
            redirectResult === "confirmed"
          ) {
            return;
          }
        }
        const { isAuthenticated, user: currentUser } =
          await authService.checkAuthStatus();

        if (isAuthenticated && currentUser) {
          setShouldShowGuideForThisSession(false);
          setCurrentScreen("dashboard");
          setIsLoading(false);
          await loadExpensesForUser(currentUser);
          await flushPendingUserUpdates();
        } else {
          const hasSeenOnboardingIntro = await storageService.getItem<boolean>(
            StorageKeys.ONBOARDING_INTRO_SEEN,
          );
          setCurrentScreen(hasSeenOnboardingIntro ? "welcome" : "onboardingIntro");
        }
      } catch (err: any) {
        showAlert(err.message || "Failed to initialize app");
        const hasSeenOnboardingIntro = await storageService.getItem<boolean>(
          StorageKeys.ONBOARDING_INTRO_SEEN,
        );
        setCurrentScreen(hasSeenOnboardingIntro ? "welcome" : "onboardingIntro");
      } finally {
        setIsExpensesLoading(false);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [flushPendingUserUpdates, handleAuthRedirect, loadExpensesForUser, showAlert]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAuthRedirect(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleAuthRedirect]);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);

      if (!result.success) {
        showAlert(result.error || "Gmail needs to be registered first");
        return;
      }

      setShouldShowGuideForThisSession(true);
      setUser(result.user || null);
      setCurrentScreen("dashboard");
      setIsLoading(false);
      if (result.user) {
        await loadExpensesForUser(result.user);
        await flushPendingUserUpdates();
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
        "Registration successful! Enter the 8-digit code sent to your email.",
        "success",
      );
      setPendingVerificationEmail(email);
      setCurrentScreen("verifyEmailOtp");
    } catch (err: any) {
      showAlert(err.message || "Registration error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (token: string) => {
    try {
      setIsLoading(true);
      const result = await authService.verifyEmailOtp(
        pendingVerificationEmail,
        token,
      );

      if (!result.success || !result.user) {
        throw new Error(result.error || "Verification failed");
      }

      setPendingVerificationEmail("");
      setShouldShowGuideForThisSession(true);
      setUser(result.user);
      setCurrentScreen("dashboard");
      showAlert("Email verified successfully.", "success");
      await loadExpensesForUser(result.user);
      await flushPendingUserUpdates();
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    const result = await authService.sendRecoveryOtp(email);

    if (!result.success) {
      throw new Error(result.error || "Failed to send reset code.");
    }

    setPendingRecoveryEmail(email);
    setCurrentScreen("verifyRecoveryOtp");
    showAlert("Reset code sent. Enter the 8-digit code from your email.", "success");
  };

  const handleVerifyRecoveryOtp = async (token: string) => {
    try {
      setIsLoading(true);
      const result = await authService.verifyRecoveryOtp(
        pendingRecoveryEmail,
        token,
      );

      if (!result.success) {
        throw new Error(result.error || "Verification failed");
      }

      setCurrentScreen("resetPassword");
      showAlert("Code verified. Set your new password.", "success");
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
      const result = await authService.changePassword(oldPassword, newPassword);
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

  const handleRecoveredPasswordUpdate = async (newPassword: string) => {
    try {
      setIsLoading(true);
      const result = await authService.changePassword("", newPassword, {
        skipCurrentPasswordCheck: true,
      });
      if (!result.success) {
        throw new Error(result.error || "Password update failed");
      }

      await supabase.auth.signOut();
      setShouldShowGuideForThisSession(false);
      setUser(null);
      setExpenses([]);
      setPendingRecoveryEmail("");
      await resetDashboardViewPreference();
      setCurrentScreen("login");
      showAlert("Password updated. Please log in with your new password.", "success");
    } finally {
      setIsLoading(false);
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
      setShouldShowGuideForThisSession(false);
      setUser(null);
      setExpenses([]);
      await resetDashboardViewPreference();
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

      {currentScreen === "onboardingIntro" && (
        <OnboardingIntroScreen
          onGetStarted={async () => {
            await storageService.setItem(StorageKeys.ONBOARDING_INTRO_SEEN, true);
            setCurrentScreen("welcome");
          }}
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
          onForgotPassword={handleForgotPassword}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "register" && (
        <RegisterScreen
          onRegister={handleRegister}
          onBackPress={() => setCurrentScreen("welcome")}
          onLoginPress={() => setCurrentScreen("login")}
        />
      )}

      {currentScreen === "verifyEmailOtp" && (
        <VerifyEmailOtpScreen
          email={pendingVerificationEmail}
          onBackPress={() => setCurrentScreen("register")}
          onVerify={handleVerifyEmailOtp}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "verifyRecoveryOtp" && (
        <VerifyEmailOtpScreen
          email={pendingRecoveryEmail}
          onBackPress={() => setCurrentScreen("login")}
          onVerify={handleVerifyRecoveryOtp}
          eyebrow="Password recovery"
          title="Enter your 8-digit reset code."
          subtitle={`We sent a reset code to ${pendingRecoveryEmail}. Enter it here to continue to your password reset.`}
          cardTitle="Verify reset code"
          cardSubtitle="Check your inbox for the 8-digit reset code from EyeGasto."
          buttonLabel="Continue"
          onNotify={showAlert}
        />
      )}

      {currentScreen === "resetPassword" && (
        <ResetPasswordScreen
          onBackPress={() => setCurrentScreen("login")}
          onSubmit={handleRecoveredPasswordUpdate}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "emailConfirmed" && (
        <EmailConfirmedScreen
          onBackPress={() => setCurrentScreen("welcome")}
          onLoginPress={() => setCurrentScreen("login")}
        />
      )}

      {currentScreen === "dashboard" && user && (
        <DashboardScreen
          user={user}
          expenses={expenses}
          isExpensesLoading={isExpensesLoading}
          shouldShowGuideForThisSession={shouldShowGuideForThisSession}
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
              return true;
            } catch (err: any) {
              if (err?.message === "Auth session missing!") {
                await enqueuePendingUserUpdate(updates);
                await supabase.auth.signOut();
                setShouldShowGuideForThisSession(false);
                setUser(null);
                setExpenses([]);
                setCurrentScreen("login");
                showAlert(
                  "Your session expired. We saved your change and will retry after login.",
                );
                await appLogger.log("session_expired_redirect_login", "warn", {
                  updateKeys: Object.keys(updates),
                });
                return false;
              }

              showAlert(err?.message || "Failed to update profile");
              await appLogger.log("update_profile_failed", "error", {
                error: err?.message,
                updateKeys: Object.keys(updates),
              });
              return false;
            } finally {
              setIsLoading(false);
            }
          }}
          onNotify={showAlert}
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
