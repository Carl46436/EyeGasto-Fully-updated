import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import Head from "expo-router/head";
import { Animated, AppState, Easing, Platform, SafeAreaView, StyleSheet } from "react-native";

import WelcomeScreen from "@/src/components/WelcomeScreen";
import LoginScreen from "@/src/components/LoginScreen";
import LoadingScreen from "@/src/components/LoadingScreen";
import ErrorAlert from "@/src/components/ErrorAlert";
import OnboardingIntroScreen from "@/src/components/OnboardingIntroScreen";
import authService from "@/src/services/authService";
import { parseAuthRedirectUrl } from "@/src/services/authRedirect";
import expenseService from "@/src/services/expenseService";
import networkService, { NetworkStatus } from "@/src/services/networkService";
import storageService, { StorageKeys } from "@/src/services/storageService";
import appLogger from "@/src/services/appLogger";
import { supabase } from "@/src/services/supabaseClient";
import { Expense, RecurringExpenseTemplate, SyncStatus, User } from "@/src/types";
import { CurrencyCode } from "@/src/services/currency";
import { AppLanguage, normalizeAppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

const loadRegisterScreen = () => import("@/src/components/RegisterScreen");
const loadEmailConfirmedScreen = () => import("@/src/components/EmailConfirmedScreen");
const loadResetPasswordScreen = () => import("@/src/components/ResetPasswordScreen");
const loadVerifyEmailOtpScreen = () => import("@/src/components/VerifyEmailOtpScreen");
const loadDashboardScreen = () => import("@/src/components/DashboardScreen");
const loadPostRegistrationSetupScreen = () =>
  import("@/src/components/PostRegistrationSetupScreen");

const RegisterScreen = lazy(loadRegisterScreen);
const EmailConfirmedScreen = lazy(loadEmailConfirmedScreen);
const ResetPasswordScreen = lazy(loadResetPasswordScreen);
const VerifyEmailOtpScreen = lazy(loadVerifyEmailOtpScreen);
const DashboardScreen = lazy(loadDashboardScreen);
const PostRegistrationSetupScreen = lazy(loadPostRegistrationSetupScreen);
const WEB_TITLE = "EyeGasto | Track expenses, receipts, budgets, and insights";
const WEB_DESCRIPTION =
  "Track expenses, save receipt proof, manage monthly budgets, and review spending insights with EyeGasto.";

type ScreenLoader = () => Promise<{ default: React.ComponentType<any> }>;

async function preloadScreen(loader: ScreenLoader) {
  try {
    await loader();
  } catch {
    // Ignore preload failures and let Suspense retry on demand.
  }
}

type Screen =
  | "onboardingIntro"
  | "welcome"
  | "login"
  | "register"
  | "verifyEmailOtp"
  | "verifyRecoveryOtp"
  | "emailConfirmed"
  | "resetPassword"
  | "postRegistrationSetup"
  | "dashboard";
type AlertState = {
  message: string;
  type: "error" | "warning" | "success";
};

type UserUpdatePayload = Partial<User>;
type DashboardPreferences = {
  themeMode?: "dark" | "light";
  monthlyBudget?: number;
  activeTab?: "overview" | "budget" | "stats" | "gallery" | "profile";
  selectedCategory?: string | "All";
  dateRange?:
    | "today"
    | "thisWeek"
    | "thisMonth"
    | "lastMonth"
    | "last30Days"
    | "allTime";
  preferredCurrency?: CurrencyCode;
  preferredLanguage?: AppLanguage;
  onboardingSeenForUserId?: string;
};

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
  const [appLanguage, setAppLanguage] = useState<AppLanguage>("English");
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [setupDefaults, setSetupDefaults] = useState<{
    monthlyBudget: number;
    preferredCurrency: CurrencyCode;
    preferredLanguage: AppLanguage;
  }>({
    monthlyBudget: 10000,
    preferredCurrency: "PHP",
    preferredLanguage: "English",
  });
  const uiLanguage = resolveUiLanguage(appLanguage);
  const flowCopy =
    uiLanguage === "Filipino"
      ? {
          registrationSuccess:
            "Matagumpay ang registration! Ilagay ang 8-digit code na ipinadala sa email mo.",
          registrationFailed: "Hindi natuloy ang registration",
          registrationError: "May error sa registration",
          emailVerified: "Matagumpay na na-verify ang email.",
          verificationFailed: "Hindi natuloy ang verification",
          resetCodeSent:
            "Naipadala ang reset code. Ilagay ang 8-digit code mula sa email mo.",
          resetCodeFailed: "Hindi maipadala ang reset code.",
          recoveryVerified:
            "Na-verify ang code. Itakda na ang bago mong password.",
          passwordUpdated:
            "Na-update ang password. Mag-log in gamit ang bago mong password.",
          loading: "Inihahanda ang expense space mo...",
          recoveryEyebrow: "Password recovery",
          recoveryTitle: "Ilagay ang 8-digit reset code mo.",
          recoverySubtitlePrefix:
            "Nagpadala kami ng reset code sa",
          recoverySubtitleSuffix:
            "Ilagay ito rito para magpatuloy sa pag-reset ng password mo.",
          recoveryCardTitle: "I-verify ang reset code",
          recoveryCardSubtitle:
            "Tingnan ang inbox mo para sa 8-digit reset code mula sa EyeGasto.",
          recoveryContinue: "Magpatuloy",
        }
      : {
          registrationSuccess:
            "Registration successful! Enter the 8-digit code sent to your email.",
          registrationFailed: "Registration failed",
          registrationError: "Registration error",
          emailVerified: "Email verified successfully.",
          verificationFailed: "Verification failed",
          resetCodeSent:
            "Reset code sent. Enter the 8-digit code from your email.",
          resetCodeFailed: "Failed to send reset code.",
          recoveryVerified: "Code verified. Set your new password.",
          passwordUpdated:
            "Password updated. Please log in with your new password.",
          loading: "Preparing your expense space...",
          recoveryEyebrow: "Password recovery",
          recoveryTitle: "Enter your 8-digit reset code.",
          recoverySubtitlePrefix: "We sent a reset code to",
          recoverySubtitleSuffix:
            "Enter it here to continue to your password reset.",
          recoveryCardTitle: "Verify reset code",
          recoveryCardSubtitle:
            "Check your inbox for the 8-digit reset code from EyeGasto.",
          recoveryContinue: "Continue",
        };
  const screenAnim = useRef(new Animated.Value(1)).current;
  const syncInFlightRef = useRef(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const showAlert = useCallback((
    message: string,
    type: AlertState["type"] = "error",
  ) => {
    setAlertState({ message, type });
  }, []);

  const resetDashboardViewPreference = useCallback(async () => {
    const preferences = await storageService.getItem<DashboardPreferences>(
      StorageKeys.DASHBOARD_PREFERENCES,
    );

    if (!preferences) {
      return;
    }

    await storageService.setItem(StorageKeys.DASHBOARD_PREFERENCES, {
      ...preferences,
      activeTab: "overview",
      dateRange:
        preferences.dateRange === "lastMonth" ||
        preferences.dateRange === "last30Days" ||
        preferences.dateRange === "allTime"
          ? preferences.dateRange
          : "thisMonth",
    });
  }, []);

  const getDashboardPreferences = useCallback(async () => {
    return (
      (await storageService.getItem<DashboardPreferences>(
        StorageKeys.DASHBOARD_PREFERENCES,
      )) ?? null
    );
  }, []);

  const loadExpensesForUser = useCallback(async (baseUser: User) => {
    setIsExpensesLoading(true);
    try {
      const cachedExpenses = await expenseService.getLocalExpenses(baseUser);
      setExpenses(cachedExpenses);

      const currentNetworkStatus = await networkService
        .getStatus()
        .catch(() => null);
      if (currentNetworkStatus) {
        setNetworkStatus(currentNetworkStatus);
      }
      if (currentNetworkStatus?.isOnline === false) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");

      let resolvedUser = baseUser;
      let recurringSyncedCount = 0;
      let pendingSyncedCount = 0;

      try {
        const syncResult = await expenseService.syncRecurringExpenses(baseUser);
        resolvedUser = syncResult.user ?? baseUser;
        recurringSyncedCount = syncResult.syncedCount;
      } catch (error: any) {
        await appLogger.log("recurring_expense_sync_skipped", "warn", {
          error: error?.message,
        });
      }
      setUser(resolvedUser);

      try {
        const pendingExpenseSync =
          await expenseService.flushPendingExpenseOperations(resolvedUser);
        pendingSyncedCount = pendingExpenseSync.syncedCount;
      } catch (error: any) {
        await appLogger.log("pending_expense_sync_skipped", "warn", {
          error: error?.message,
        });
      }

      const userExpenses = await expenseService.getExpenses(resolvedUser);
      setExpenses(userExpenses);
      setSyncStatus("synced");

      if (recurringSyncedCount > 0) {
        showAlert(
          `${recurringSyncedCount} recurring expense${
            recurringSyncedCount === 1 ? "" : "s"
          } added automatically.`,
          "success",
        );
      }

      if (pendingSyncedCount > 0) {
        showAlert(
          `${pendingSyncedCount} pending expense change${
            pendingSyncedCount === 1 ? "" : "s"
          } synced.`,
          "success",
        );
      }
    } catch (error: any) {
      setSyncStatus("error");
      await appLogger.log("expense_load_failed_using_cache", "warn", {
        error: error?.message,
      });
      const cachedExpenses = await expenseService.getLocalExpenses(baseUser);
      setExpenses(cachedExpenses);
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

  const startBackgroundSync = useCallback(
    (currentUser: User) => {
      if (syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;
      void (async () => {
        try {
          const currentNetworkStatus = await networkService
            .getStatus()
            .catch(() => null);
          if (currentNetworkStatus) {
            setNetworkStatus(currentNetworkStatus);
          }
          if (currentNetworkStatus?.isOnline === false) {
            setSyncStatus("offline");
            return;
          }

          setSyncStatus("syncing");
          await loadExpensesForUser(currentUser);
          await flushPendingUserUpdates();
          setSyncStatus("synced");
        } catch (error: any) {
          setSyncStatus("error");
          await appLogger.log("background_sync_failed", "warn", {
            error: error?.message,
          });
        } finally {
          syncInFlightRef.current = false;
        }
      })();
    },
    [flushPendingUserUpdates, loadExpensesForUser],
  );

  useEffect(() => {
    let previousOnline: boolean | null = null;

    networkService.getStatus().then((status) => {
      previousOnline = status.isOnline;
      setNetworkStatus(status);
      if (!status.isOnline) {
        setSyncStatus("offline");
      }
    }).catch(() => undefined);

    const unsubscribe = networkService.subscribe((status) => {
      const wasOffline = previousOnline === false;
      previousOnline = status.isOnline;
      setNetworkStatus(status);

      if (!status.isOnline) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus((current) => (current === "offline" ? "idle" : current));
      if (wasOffline && userRef.current) {
        startBackgroundSync(userRef.current);
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !userRef.current) {
        return;
      }

      networkService.getStatus().then((status) => {
        setNetworkStatus(status);
        if (status.isOnline) {
          startBackgroundSync(userRef.current as User);
        } else {
          setSyncStatus("offline");
        }
      }).catch(() => undefined);
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [startBackgroundSync]);

  const showDashboardFromCache = useCallback(
    async (
      currentUser: User,
      options?: {
        forceGuide?: boolean;
      },
    ) => {
      if (Platform.OS === "web") {
        await preloadScreen(loadDashboardScreen);
      }
      setUser(currentUser);
      setShouldShowGuideForThisSession(options?.forceGuide ?? false);
      setCurrentScreen("dashboard");
      setExpenses(await expenseService.getLocalExpenses(currentUser));
      startBackgroundSync(currentUser);
    },
    [startBackgroundSync],
  );

  const routeAuthenticatedUser = useCallback(
    async (
      currentUser: User,
      options?: {
        forceGuide?: boolean;
      },
    ) => {
      const preferences = await getDashboardPreferences();
      const hasCompletedSetup =
        preferences?.onboardingSeenForUserId === currentUser.id;

      setUser(currentUser);

      if (!hasCompletedSetup) {
        if (Platform.OS === "web") {
          await preloadScreen(loadPostRegistrationSetupScreen);
        }
        setAppLanguage(
          normalizeAppLanguage(preferences?.preferredLanguage),
        );
        setSetupDefaults({
          monthlyBudget: preferences?.monthlyBudget ?? 10000,
          preferredCurrency: preferences?.preferredCurrency ?? "PHP",
          preferredLanguage: normalizeAppLanguage(
            preferences?.preferredLanguage,
          ),
        });
        setCurrentScreen("postRegistrationSetup");
        return;
      }

      setAppLanguage(
        normalizeAppLanguage(preferences?.preferredLanguage),
      );
      await showDashboardFromCache(currentUser, options);
    },
    [getDashboardPreferences, showDashboardFromCache],
  );

  const finalizeFirstTimeSetup = useCallback(
    async (
      currentUser: User,
      updates?: {
        username?: string;
        monthlyBudget?: number;
        preferredCurrency?: CurrencyCode;
        preferredLanguage?: AppLanguage;
      },
    ) => {
      let resolvedUser = currentUser;

      if (
        updates?.username &&
        updates.username.trim().toLowerCase() !==
          (currentUser.username ?? "").toLowerCase()
      ) {
        const updateResult = await authService.updateUser({
          username: updates.username.trim().toLowerCase(),
        });

        if (!updateResult.success || !updateResult.user) {
          const errorMessage = updateResult.error || "Failed to update username";
          const shouldQueueUsernameUpdate =
            errorMessage === "Auth session missing!" ||
            errorMessage.toLowerCase().includes("network") ||
            errorMessage.toLowerCase().includes("timed out") ||
            errorMessage.toLowerCase().includes("failed to fetch");

          if (!shouldQueueUsernameUpdate) {
            throw new Error(errorMessage);
          }

          resolvedUser = {
            ...currentUser,
            username: updates.username.trim().toLowerCase(),
          };
          await enqueuePendingUserUpdate({
            username: resolvedUser.username,
          });
          await appLogger.log("offline_setup_username_update_queued", "warn", {
            username: resolvedUser.username,
          });
          setUser(resolvedUser);
        } else {
          resolvedUser = updateResult.user;
          setUser(resolvedUser);
        }
      }

      const preferences = await getDashboardPreferences();
      await storageService.setItem(StorageKeys.DASHBOARD_PREFERENCES, {
        ...preferences,
        monthlyBudget:
          updates?.monthlyBudget ?? preferences?.monthlyBudget ?? 10000,
        preferredCurrency:
          updates?.preferredCurrency ?? preferences?.preferredCurrency ?? "PHP",
        preferredLanguage:
          normalizeAppLanguage(
            updates?.preferredLanguage ?? preferences?.preferredLanguage,
          ),
        onboardingSeenForUserId: resolvedUser.id,
        activeTab: "overview",
        dateRange: preferences?.dateRange ?? "thisMonth",
      } satisfies DashboardPreferences);

      setAppLanguage(
        normalizeAppLanguage(
          updates?.preferredLanguage ?? preferences?.preferredLanguage,
        ),
      );
      await showDashboardFromCache(resolvedUser, { forceGuide: true });
    },
    [enqueuePendingUserUpdate, getDashboardPreferences, showDashboardFromCache],
  );

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
        if (Platform.OS === "web") {
          await preloadScreen(loadResetPasswordScreen);
        }
        setCurrentScreen("resetPassword");
        showAlert("Recovery link verified. Enter a new password.", "success");
        return "recovery" as const;
      }

      if (resolvedType === "signup" || resolvedType === "email") {
        await supabase.auth.signOut();
        setUser(null);
        setExpenses([]);
        if (Platform.OS === "web") {
          await preloadScreen(loadEmailConfirmedScreen);
        }
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
    screenAnim.setValue(0);
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [currentScreen, screenAnim]);

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
          await routeAuthenticatedUser(currentUser);
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
  }, [handleAuthRedirect, routeAuthenticatedUser, showAlert]);

  useEffect(() => {
    if (Platform.OS !== "web" || isLoading) {
      return;
    }

    const preloadTimeout = setTimeout(() => {
      void preloadScreen(loadRegisterScreen);
      void preloadScreen(loadVerifyEmailOtpScreen);
      void preloadScreen(loadResetPasswordScreen);
      void preloadScreen(loadEmailConfirmedScreen);
    }, 200);

    return () => clearTimeout(preloadTimeout);
  }, [isLoading]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAuthRedirect(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleAuthRedirect]);

  const handleLogin = async (loginIdentifier: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login(loginIdentifier, password);

      if (!result.success) {
        showAlert(result.error || "That email or username needs to be registered first");
        return;
      }

      if (result.user) {
        await routeAuthenticatedUser(result.user, { forceGuide: true });
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
    username: string,
  ) => {
    try {
      setIsLoading(true);
      const result = await authService.register(email, password, name, username);

      if (!result.success) {
        showAlert(result.error || flowCopy.registrationFailed);
        return;
      }

      showAlert(
        flowCopy.registrationSuccess,
        "success",
      );
      setPendingVerificationEmail(email);
      if (Platform.OS === "web") {
        await preloadScreen(loadVerifyEmailOtpScreen);
      }
      setCurrentScreen("verifyEmailOtp");
    } catch (err: any) {
      showAlert(err.message || flowCopy.registrationError);
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
        throw new Error(result.error || flowCopy.verificationFailed);
      }

      setPendingVerificationEmail("");
      showAlert(flowCopy.emailVerified, "success");
      await routeAuthenticatedUser(result.user, { forceGuide: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    const result = await authService.sendRecoveryOtp(email);

    if (!result.success) {
      throw new Error(result.error || flowCopy.resetCodeFailed);
    }

      setPendingRecoveryEmail(email);
      if (Platform.OS === "web") {
        await preloadScreen(loadVerifyEmailOtpScreen);
      }
      setCurrentScreen("verifyRecoveryOtp");
      showAlert(flowCopy.resetCodeSent, "success");
  };

  const handleVerifyRecoveryOtp = async (token: string) => {
    try {
      setIsLoading(true);
      const result = await authService.verifyRecoveryOtp(
        pendingRecoveryEmail,
        token,
      );

      if (!result.success) {
        throw new Error(result.error || flowCopy.verificationFailed);
      }

      if (Platform.OS === "web") {
        await preloadScreen(loadResetPasswordScreen);
      }
      setCurrentScreen("resetPassword");
      showAlert(flowCopy.recoveryVerified, "success");
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

      const savedOffline = result.expense?.isPending === true;
      if (savedOffline) {
        setSyncStatus("offline");
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
        const nextRecurringExpenses: RecurringExpenseTemplate[] = [
          ...(user.recurringExpenses ?? []),
          recurringTemplate,
        ];

        const updateResult = await authService.updateUser({
          recurringExpenses: nextRecurringExpenses,
        });

        if (updateResult.success && updateResult.user) {
          setUser(updateResult.user);
          showAlert(
            "Expense added and monthly recurring plan created.",
            "success",
          );
        } else {
          await enqueuePendingUserUpdate({
            recurringExpenses: nextRecurringExpenses,
          });
          setUser({
            ...user,
            recurringExpenses: nextRecurringExpenses,
          });
          showAlert(
            "Expense added. The recurring plan was saved locally and will sync when online.",
            "warning",
          );
        }
      } else {
        showAlert(
          savedOffline
            ? "Expense saved offline. It will sync when you are online."
            : "Expense added successfully.",
          savedOffline ? "warning" : "success",
        );
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
      showAlert(flowCopy.passwordUpdated, "success");
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
    return (
      <>
        <Head>
          <title>{WEB_TITLE}</title>
          <meta name="description" content={WEB_DESCRIPTION} />
        </Head>
        <LoadingScreen language={appLanguage} message={flowCopy.loading} />
      </>
    );
  }

  const screenAnimatedStyle = {
    opacity: screenAnim,
    transform: [
      {
        translateY: screenAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };
  const screenFallback = (
    <LoadingScreen language={appLanguage} message={flowCopy.loading} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Head>
        <title>{WEB_TITLE}</title>
        <meta name="description" content={WEB_DESCRIPTION} />
      </Head>
      {alertState && (
        <ErrorAlert
          message={alertState.message}
          type={alertState.type}
          duration={3000}
          onDismiss={() => setAlertState(null)}
        />
      )}

      <Suspense fallback={screenFallback}>
      <Animated.View style={[styles.screenWrap, screenAnimatedStyle]}>
      {currentScreen === "onboardingIntro" && (
        <OnboardingIntroScreen
          language={appLanguage}
          onGetStarted={async () => {
            await storageService.setItem(StorageKeys.ONBOARDING_INTRO_SEEN, true);
            setCurrentScreen("welcome");
          }}
        />
      )}

      {currentScreen === "welcome" && (
        <WelcomeScreen
          language={appLanguage}
          onLoginPress={() => setCurrentScreen("login")}
          onRegisterPress={() => setCurrentScreen("register")}
        />
      )}

      {currentScreen === "login" && (
        <LoginScreen
          language={appLanguage}
          onLogin={handleLogin}
          onBackPress={() => setCurrentScreen("welcome")}
          onRegisterPress={() => setCurrentScreen("register")}
          onForgotPassword={handleForgotPassword}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "register" && (
        <RegisterScreen
          language={appLanguage}
          onRegister={handleRegister}
          onBackPress={() => setCurrentScreen("welcome")}
          onLoginPress={() => setCurrentScreen("login")}
        />
      )}

      {currentScreen === "verifyEmailOtp" && (
        <VerifyEmailOtpScreen
          language={appLanguage}
          email={pendingVerificationEmail}
          onBackPress={() => setCurrentScreen("register")}
          onVerify={handleVerifyEmailOtp}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "verifyRecoveryOtp" && (
        <VerifyEmailOtpScreen
          language={appLanguage}
          email={pendingRecoveryEmail}
          onBackPress={() => setCurrentScreen("login")}
          onVerify={handleVerifyRecoveryOtp}
          eyebrow={flowCopy.recoveryEyebrow}
          title={flowCopy.recoveryTitle}
          subtitle={`${flowCopy.recoverySubtitlePrefix} ${pendingRecoveryEmail}. ${flowCopy.recoverySubtitleSuffix}`}
          cardTitle={flowCopy.recoveryCardTitle}
          cardSubtitle={flowCopy.recoveryCardSubtitle}
          buttonLabel={flowCopy.recoveryContinue}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "resetPassword" && (
        <ResetPasswordScreen
          language={appLanguage}
          onBackPress={() => setCurrentScreen("login")}
          onSubmit={handleRecoveredPasswordUpdate}
          onNotify={showAlert}
        />
      )}

      {currentScreen === "emailConfirmed" && (
        <EmailConfirmedScreen
          language={appLanguage}
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
          language={appLanguage}
          networkStatus={networkStatus}
          syncStatus={syncStatus}
          onLanguageChange={setAppLanguage}
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
              const message = String(err?.message ?? "");
              const shouldQueueOfflineUpdate =
                message === "Auth session missing!" ||
                message.toLowerCase().includes("network") ||
                message.toLowerCase().includes("timed out") ||
                message.toLowerCase().includes("failed to fetch");

              if (shouldQueueOfflineUpdate) {
                await enqueuePendingUserUpdate(updates);
                setUser((current) =>
                  current
                    ? {
                        ...current,
                        ...updates,
                      }
                    : current,
                );
                showAlert(
                  "Saved locally. This profile change will sync when you are online.",
                  "warning",
                );
                await appLogger.log("offline_profile_update_queued", "warn", {
                  updateKeys: Object.keys(updates),
                });
                return true;
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

      {currentScreen === "postRegistrationSetup" && user && (
        <PostRegistrationSetupScreen
          language={appLanguage}
          user={user}
          initialMonthlyBudget={setupDefaults.monthlyBudget}
          initialCurrency={setupDefaults.preferredCurrency}
          initialLanguage={setupDefaults.preferredLanguage}
          isSaving={isLoading}
          onContinue={async (values) => {
            try {
              setIsLoading(true);
              await finalizeFirstTimeSetup(user, values);
            } catch (err: any) {
              showAlert(err.message || "Failed to save first-time setup");
            } finally {
              setIsLoading(false);
            }
          }}
          onSkip={async () => {
            try {
              setIsLoading(true);
              await finalizeFirstTimeSetup(user);
            } catch (err: any) {
              showAlert(err.message || "Failed to finish setup");
            } finally {
              setIsLoading(false);
            }
          }}
        />
      )}
      </Animated.View>
      </Suspense>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  screenWrap: {
    flex: 1,
  },
});
