import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DimensionValue,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import AddExpenseForm from "./AddExpenseForm";
import ExpenseList from "./ExpenseList";
import StatsCard from "./StatsCard";
import { Expense, SyncStatus, User } from "@/src/types";
import financialPlanningService from "@/src/services/financialPlanningService";
import networkService, { NetworkStatus } from "@/src/services/networkService";
import {
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  formatCurrency,
} from "@/src/services/currency";
import expenseStorage from "@/src/services/expenseStorage";
import storageService, { StorageKeys } from "@/src/services/storageService";
import {
  AppLanguage,
  SUPPORTED_APP_LANGUAGES,
  normalizeAppLanguage,
  resolveUiLanguage,
} from "@/src/i18n/appLanguage";
import {
  getLocalizedCategoryName,
  normalizeCategoryKey,
  normalizeCategoryName,
} from "@/src/utils/category";
import { createShadow } from "@/src/utils/shadow";
import {
  BudgetCategoryEntry,
  ConfirmationDialogState,
  DashboardPreferences,
  DateRangeKey,
  DebtReminderEntry,
  ExportFormat,
  FaqItem,
  InfoSection,
  InfoSheet,
  MomentumWindow,
  ThemeMode,
} from "./dashboard/types";
import {
  normalizeBudgetCategoryKey,
  toBudgetCategoryEntry,
  toDebtReminderEntry,
  toServiceCategoryBudget,
  toServiceDebtItem,
} from "./dashboard/planningMappers";
import { getLanguageCopy } from "./dashboard/language";

interface Props {
  user: User;
  expenses: Expense[];
  isExpensesLoading?: boolean;
  shouldShowGuideForThisSession?: boolean;
  language?: AppLanguage;
  networkStatus?: NetworkStatus | null;
  syncStatus?: SyncStatus;
  onLanguageChange?: (language: AppLanguage) => void;
  onAddExpense: (
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
    options?: {
      recurringMonthly?: boolean;
    },
  ) => boolean | Promise<boolean>;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (
    id: string,
    updates: Partial<Expense>,
  ) => Promise<boolean> | boolean;
  onUpdateUser?: (updates: Partial<User>) => Promise<void> | Promise<boolean>;
  onNotify?: (message: string, type?: "error" | "warning" | "success") => void;
  onChangePassword?: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<void>;
  onClearAll: () => Promise<void>;
  onLogout: () => void;
}

type InfoContentCopy = {
  terms: { title: string; sections: InfoSection[] };
  privacy: { title: string; sections: InfoSection[] };
  faq: { title: string; items: FaqItem[] };
  about: { title: string; sections: InfoSection[] };
};

const VALID_ACTIVE_TABS = [
  "overview",
  "budget",
  "stats",
  "gallery",
  "profile",
] as const;
type DashboardTab = (typeof VALID_ACTIVE_TABS)[number];
const VALID_DATE_RANGES = [
  "today",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "last30Days",
  "allTime",
] as const;

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  "1.0.0";

const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  "\u20B1": "PHP ",
  "\u20AB": "VND ",
  "\u20AC": "EUR ",
  "\u00A3": "GBP ",
  "\u00A5": "JPY ",
};

const QUICK_ADDS = [
  { label: "Coffee", amount: 80, category: "Food" },
  { label: "Lunch", amount: 150, category: "Food" },
  { label: "Transport", amount: 120, category: "Transport" },
  { label: "Groceries", amount: 650, category: "Groceries" },
  { label: "Bills", amount: 1200, category: "Bills" },
];

const QUICK_ADD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Coffee: "cafe-outline",
  Lunch: "restaurant-outline",
  Transport: "car-outline",
  Groceries: "basket-outline",
  Bills: "receipt-outline",
};

const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Groceries",
  "Bills",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Utilities",
  "Other",
];

const MOMENTUM_WINDOW_OPTIONS: { key: MomentumWindow; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
];

const LANGUAGE_OPTIONS = SUPPORTED_APP_LANGUAGES;

export default function DashboardScreen({
  user,
  expenses,
  isExpensesLoading = false,
  shouldShowGuideForThisSession = false,
  language = "English",
  networkStatus,
  syncStatus = "idle",
  onLanguageChange,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onUpdateUser,
  onNotify,
  onChangePassword,
  onClearAll,
  onLogout,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const isVeryCompact = width < 420;
  const shouldStackRecentHeader = width < 1180;
  const shouldStackOverviewLayout = width < 1240;
  const shouldStackBudgetLayout = width < 1220;
  const useSidebarNavigation = Platform.OS === "web" && !isCompact;
  const useNativeHeaderProfile = Platform.OS !== "web";
  const compactBottomInset = Platform.OS === "android" ? insets.bottom : 0;
  const headerTopPadding = Math.max(
    Platform.OS === "android" ? 22 : 18,
    insets.top + 8,
  );
  const bottomNavigationOffset = Math.max(
    isCompact ? 20 : 16,
    compactBottomInset + 12,
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const budgetBarsAnim = useRef(new Animated.Value(0)).current;
  const syncToastAnim = useRef(new Animated.Value(0)).current;
  const dashboardScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [showNativeSyncToast, setShowNativeSyncToast] = useState(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const mobileContentBottomPadding =
    (activeTab === "profile" ? 190 : 224) + compactBottomInset;
  const contentBottomPadding = useSidebarNavigation
    ? 32
    : isCompact
      ? mobileContentBottomPadding
      : 120 + compactBottomInset;
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | "All">(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(10000);
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>("PHP");
  const [preferredLanguage, setPreferredLanguage] =
    useState<AppLanguage>(language);
  const [onboardingSeenForUserId, setOnboardingSeenForUserId] = useState<
    string | undefined
  >(undefined);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>("thisMonth");
  const [momentumWindow, setMomentumWindow] = useState<MomentumWindow>("7d");
  const [selectedStatsCategory, setSelectedStatsCategory] = useState<string | null>(null);
  const [gallerySearchQuery, setGallerySearchQuery] = useState("");
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<
    string | "All"
  >("All");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editUsername, setEditUsername] = useState(user.username ?? "");
  const [editEmail, setEditEmail] = useState(user.email);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [infoSheet, setInfoSheet] = useState<InfoSheet>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [expandedInfoSectionKey, setExpandedInfoSectionKey] = useState<string | null>(null);
  const [confirmationDialog, setConfirmationDialog] =
    useState<ConfirmationDialogState>({
      visible: false,
      title: "",
      message: "",
      confirmLabel: "Confirm",
      tone: "default",
    });
  const [isExporting, setIsExporting] = useState(false);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Expense | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isBudgetPlannerReady, setIsBudgetPlannerReady] = useState(false);
  const budgetPlannerSyncErrorShownRef = useRef(false);
  const confirmationActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<BudgetCategoryEntry[]>(
    [],
  );
  const [debtReminders, setDebtReminders] = useState<DebtReminderEntry[]>([]);
  const [budgetCategoryDraft, setBudgetCategoryDraft] = useState("");
  const [showBudgetCategoryMenu, setShowBudgetCategoryMenu] = useState(false);
  const [budgetAmountDraft, setBudgetAmountDraft] = useState("");
  const [budgetNoteDraft, setBudgetNoteDraft] = useState("");
  const [debtTitleDraft, setDebtTitleDraft] = useState("");
  const [debtAmountDraft, setDebtAmountDraft] = useState("");
  const [debtLenderDraft, setDebtLenderDraft] = useState("");
  const [debtDueDateDraft, setDebtDueDateDraft] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [debtNoteDraft, setDebtNoteDraft] = useState("");
  const [quickAddDraft, setQuickAddDraft] = useState<{
    description?: string;
    amount?: number;
    category?: string;
  } | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [onLanguageChange]);

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [activeTab, contentAnim]);

  useEffect(() => {
    if (activeTab === "stats") {
      statsAnim.setValue(0);
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [activeTab, statsAnim, momentumWindow, dateRange]);

  useEffect(() => {
    if (activeTab === "budget") {
      budgetBarsAnim.setValue(0);
      Animated.timing(budgetBarsAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [activeTab, budgetBarsAnim, categoryBudgets.length, expenses.length]);

  const scrollDashboardToTop = useCallback((animated = true) => {
    dashboardScrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const replayDashboardContent = useCallback(() => {
    contentAnim.stopAnimation();
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [contentAnim]);

  const handleBottomTabPress = useCallback(
    (tab: DashboardTab) => {
      const isCurrentTab = activeTab === tab;

      setActiveTab(tab);
      scrollDashboardToTop(true);
      requestAnimationFrame(() => scrollDashboardToTop(!isCurrentTab));

      if (isCurrentTab) {
        replayDashboardContent();
      }
    },
    [activeTab, replayDashboardContent, scrollDashboardToTop],
  );

  const anyModalVisible =
    showAddForm ||
    isEditingProfile ||
    confirmationDialog.visible ||
    showCurrencyPicker ||
    showLanguagePicker ||
    showDateRangePicker ||
    showPasswordModal ||
    showExportOptions ||
    Boolean(selectedReceipt) ||
    Boolean(editingExpense) ||
    Boolean(infoSheet);

  useEffect(() => {
    Animated.timing(modalAnim, {
      toValue: anyModalVisible ? 1 : 0,
      duration: anyModalVisible ? 220 : 180,
      easing: anyModalVisible
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [anyModalVisible, modalAnim]);

  const modalAnimatedStyle = {
    opacity: modalAnim,
    transform: [
      {
        scale: modalAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
      {
        translateY: modalAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  useEffect(() => {
    setEditName(user.name);
    setEditUsername(user.username ?? "");
    setEditEmail(user.email);
  }, [user.email, user.name, user.username]);

  useEffect(() => {
    setPreferredLanguage(normalizeAppLanguage(language));
  }, [language]);

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      const storedPreferences =
        await storageService.getItem<DashboardPreferences>(
          StorageKeys.DASHBOARD_PREFERENCES,
        );

      if (!active) {
        return;
      }

      if (storedPreferences) {
        const normalizedActiveTab = VALID_ACTIVE_TABS.includes(
          storedPreferences.activeTab,
        )
          ? storedPreferences.activeTab
          : "overview";
        const normalizedDateRange = VALID_DATE_RANGES.includes(
          storedPreferences.dateRange,
        )
          ? storedPreferences.dateRange
          : "thisMonth";

        setThemeMode(storedPreferences.themeMode ?? "dark");
        setMonthlyBudget(storedPreferences.monthlyBudget ?? 10000);
        setActiveTab(normalizedActiveTab);
        setSelectedCategory(storedPreferences.selectedCategory ?? "All");
        setDateRange(normalizedDateRange);
        setPreferredCurrency(storedPreferences.preferredCurrency ?? "PHP");
        const storedLanguage = normalizeAppLanguage(
          storedPreferences.preferredLanguage,
        );
        setPreferredLanguage(storedLanguage);
        onLanguageChange?.(storedLanguage);
        setOnboardingSeenForUserId(storedPreferences.onboardingSeenForUserId);
      }

      setIsPreferencesReady(true);
    };

    loadPreferences();

    return () => {
      active = false;
    };
  }, [onLanguageChange]);

  useEffect(() => {
    if (!isPreferencesReady) {
      return;
    }

    storageService.setItem(StorageKeys.DASHBOARD_PREFERENCES, {
      themeMode,
      monthlyBudget,
      activeTab,
      selectedCategory,
      dateRange,
      preferredCurrency,
      preferredLanguage,
      onboardingSeenForUserId,
    } satisfies DashboardPreferences);
  }, [
    activeTab,
    dateRange,
    isPreferencesReady,
    monthlyBudget,
    onboardingSeenForUserId,
    preferredCurrency,
    preferredLanguage,
    selectedCategory,
    themeMode,
  ]);

  const budgetPlannerStorageKey = useMemo(
    () => `${StorageKeys.DASHBOARD_PREFERENCES}:budgetPlanner:${user.id}`,
    [user.id],
  );

  const notify = useCallback(
    (message: string, type: "error" | "warning" | "success" = "success") => {
      if (onNotify) {
        onNotify(message, type);
        return;
      }

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.alert(message);
        }
        return;
      }

      Alert.alert(type === "error" ? "Error" : "Notice", message);
    },
    [onNotify],
  );

  useEffect(() => {
    let active = true;

    const loadBudgetPlannerData = async () => {
      try {
        const storedData = await storageService.getItem<{
          categoryBudgets?: BudgetCategoryEntry[];
          debtReminders?: DebtReminderEntry[];
        }>(budgetPlannerStorageKey);
        const currentNetworkStatus = await networkService
          .getStatus()
          .catch(() => null);

        if (currentNetworkStatus?.isOnline === false) {
          if (!active) {
            return;
          }

          setCategoryBudgets(storedData?.categoryBudgets ?? []);
          setDebtReminders(storedData?.debtReminders ?? []);
          return;
        }

        const [dbBudgets, dbDebts] = await Promise.all([
          financialPlanningService.getCategoryBudgets(user.id),
          financialPlanningService.getDebtItems(user.id),
        ]);

        const mappedDbBudgets = dbBudgets.map(toBudgetCategoryEntry);
        const mappedDbDebts = dbDebts.map(toDebtReminderEntry);
        const fallbackBudgets = storedData?.categoryBudgets ?? [];
        const fallbackDebts = storedData?.debtReminders ?? [];

        const resolvedBudgets =
          mappedDbBudgets.length > 0 ? mappedDbBudgets : fallbackBudgets;
        const resolvedDebts =
          mappedDbDebts.length > 0 ? mappedDbDebts : fallbackDebts;

        if (mappedDbBudgets.length === 0 && fallbackBudgets.length > 0) {
          await financialPlanningService.replaceCategoryBudgets(
            user.id,
            fallbackBudgets.map(toServiceCategoryBudget),
          );
        }

        if (mappedDbDebts.length === 0 && fallbackDebts.length > 0) {
          await financialPlanningService.replaceDebtItems(
            user.id,
            fallbackDebts.map(toServiceDebtItem),
          );
        }

        if (!active) {
          return;
        }

        setCategoryBudgets(resolvedBudgets);
        setDebtReminders(resolvedDebts);
      } catch {
        if (!active) {
          return;
        }

        notify(
          "We could not fully load budget or debt planner data. Showing any saved local data instead.",
          "warning",
        );

        const storedData = await storageService.getItem<{
          categoryBudgets?: BudgetCategoryEntry[];
          debtReminders?: DebtReminderEntry[];
        }>(budgetPlannerStorageKey);

        setCategoryBudgets(storedData?.categoryBudgets ?? []);
        setDebtReminders(storedData?.debtReminders ?? []);
      } finally {
        if (active) {
          setIsBudgetPlannerReady(true);
        }
      }
    };

    setIsBudgetPlannerReady(false);
    loadBudgetPlannerData();

    return () => {
      active = false;
    };
  }, [budgetPlannerStorageKey, notify, user.id]);

  useEffect(() => {
    if (!isBudgetPlannerReady) {
      return;
    }

    const persistBudgetPlannerData = async () => {
      await storageService.setItem(budgetPlannerStorageKey, {
        categoryBudgets,
        debtReminders,
      });

      if (networkStatus?.isOnline === false) {
        return;
      }

      const [savedBudgets, savedDebts] = await Promise.all([
        financialPlanningService.replaceCategoryBudgets(
          user.id,
          categoryBudgets.map(toServiceCategoryBudget),
        ),
        financialPlanningService.replaceDebtItems(
          user.id,
          debtReminders.map(toServiceDebtItem),
        ),
      ]);

      const synced = savedBudgets && savedDebts;
      if (synced) {
        budgetPlannerSyncErrorShownRef.current = false;
        return;
      }

      if (!budgetPlannerSyncErrorShownRef.current) {
        budgetPlannerSyncErrorShownRef.current = true;
        notify("Budget and debt changes saved locally but failed to sync to database.", "warning");
      }
    };

    persistBudgetPlannerData();
  }, [
    budgetPlannerStorageKey,
    categoryBudgets,
    debtReminders,
    isBudgetPlannerReady,
    networkStatus?.isOnline,
    notify,
    user.id,
  ]);

  const formatAmount = useCallback(
    (amount: number) => formatCurrency(amount, preferredCurrency),
    [preferredCurrency],
  );

  const formatAxisAmount = useCallback(
    (amount: number) => formatCurrency(amount, preferredCurrency, 0),
    [preferredCurrency],
  );

  const renderLanguage = useMemo<AppLanguage>(
    () => resolveUiLanguage(preferredLanguage),
    [preferredLanguage],
  );

  const languageCopy = useMemo(
    () => getLanguageCopy(renderLanguage),
    [renderLanguage],
  );
  const formatCopy = useCallback(
    (key: string, replacements: Record<string, string | number>) =>
      Object.entries(replacements).reduce(
        (text, [token, value]) =>
          text.replace(new RegExp(`\\{${token}\\}`, "g"), String(value)),
        languageCopy[key] ?? key,
      ),
    [languageCopy],
  );
  const syncStatusCopy = useMemo(() => {
    const offline = networkStatus?.isOnline === false || syncStatus === "offline";
    if (offline) {
      return {
        icon: "cloud-offline-outline" as const,
        title: renderLanguage === "Filipino" ? "Offline mode" : "Offline mode",
        subtitle:
          renderLanguage === "Filipino"
            ? "Naka-save muna sa device"
            : "Saving changes on device",
        tone: "warning" as const,
      };
    }

    if (syncStatus === "syncing") {
      return {
        icon: "sync-outline" as const,
        title: renderLanguage === "Filipino" ? "Sine-sync" : "Syncing",
        subtitle:
          renderLanguage === "Filipino"
            ? "Ina-update ang cloud copy"
            : "Updating cloud backup",
        tone: "info" as const,
      };
    }

    if (syncStatus === "error") {
      return {
        icon: "alert-circle-outline" as const,
        title:
          renderLanguage === "Filipino" ? "May pending sync" : "Sync pending",
        subtitle:
          renderLanguage === "Filipino"
            ? "Susubukan ulit kapag online"
            : "Will retry when online",
        tone: "danger" as const,
      };
    }

    if (syncStatus === "synced") {
      return {
        icon: "cloud-done-outline" as const,
        title: renderLanguage === "Filipino" ? "Synced na" : "All synced",
        subtitle:
          renderLanguage === "Filipino"
            ? "Updated ang backup"
            : "Backup is current",
        tone: "success" as const,
      };
    }

    return {
      icon: "cloud-outline" as const,
      title: renderLanguage === "Filipino" ? "Online" : "Online",
      subtitle:
        renderLanguage === "Filipino" ? "Handa ang sync" : "Ready to sync",
      tone: "info" as const,
    };
  }, [networkStatus?.isOnline, renderLanguage, syncStatus]);
  const syncToneColor =
    syncStatusCopy.tone === "warning"
      ? "#FBBF24"
      : syncStatusCopy.tone === "danger"
        ? "#F87171"
        : syncStatusCopy.tone === "success"
          ? "#34D399"
          : "#7DD3FC";
  useEffect(() => {
    if (!useNativeHeaderProfile) {
      setShowNativeSyncToast(false);
      syncToastAnim.setValue(0);
      return;
    }

    const shouldShowSyncToast =
      networkStatus?.isOnline === false ||
      syncStatus === "offline" ||
      syncStatus === "syncing" ||
      syncStatus === "error" ||
      syncStatus === "synced";

    syncToastAnim.stopAnimation();

    if (!shouldShowSyncToast) {
      Animated.timing(syncToastAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setShowNativeSyncToast(false));
      return;
    }

    const displayDuration =
      syncStatus === "error" ||
      syncStatus === "offline" ||
      networkStatus?.isOnline === false
        ? 4600
        : 3200;

    setShowNativeSyncToast(true);
    syncToastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(syncToastAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(displayDuration),
      Animated.timing(syncToastAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowNativeSyncToast(false);
      }
    });

    return () => {
      syncToastAnim.stopAnimation();
    };
  }, [
    networkStatus?.isOnline,
    syncStatus,
    syncToastAnim,
    useNativeHeaderProfile,
  ]);
  const getCategoryDisplayLabel = useCallback(
    (category?: string | null) => {
      const trimmed = category?.trim();
      if (!trimmed || trimmed === "Uncategorized") {
        return languageCopy.uncategorized;
      }
      if (trimmed === "All") {
        return languageCopy.all;
      }
      return getLocalizedCategoryName(trimmed, renderLanguage);
    },
    [languageCopy, renderLanguage],
  );

  const activityRangeOptions = useMemo(
    () => [
      { key: "today" as DateRangeKey, label: languageCopy.activityByDay },
      { key: "thisWeek" as DateRangeKey, label: languageCopy.activityByWeek },
      { key: "thisMonth" as DateRangeKey, label: languageCopy.activityByMonth },
      { key: "allTime" as DateRangeKey, label: languageCopy.activityAllTime },
    ],
    [languageCopy],
  );

  const localizedProfileCopy = useMemo(() => {
    switch (renderLanguage) {
      case "Filipino":
        return {
          profileBadgeCurrency: `Currency: ${preferredCurrency}`,
          accountActionsTitle: "Mga aksyon sa account",
          accountActionsSubtitle: "I-update ang iyong profile details nang mabilis.",
          editProfile: "I-edit ang profile",
          preferencesTitle: "Mga preference",
          preferencesSubtitle:
            "Piliin ang iyong currency, tema ng app, at wika sa iisang lugar.",
          preferredCurrencyLabel: "Piniling currency",
          appThemeLabel: "Tema",
          light: "Liwanag",
          dark: "Dilim",
          preferredLanguageLabel: "Wika ng app",
          preferredLanguageHint: "Piliin ang wikang gagamitin sa profile at preferences.",
          securityTitle: "Seguridad",
          securitySubtitle:
            "Panatilihing updated at secure ang iyong sign-in details.",
          changePassword: "Palitan ang password",
          chooseLanguageTitle: "Pumili ng Wika",
          chooseLanguageSubtitle:
            "Piliin ang wikang gusto mong gamitin sa profile at preferences.",
        };
      default:
        return {
          profileBadgeCurrency: `Currency ${preferredCurrency}`,
          accountActionsTitle: "Account actions",
          accountActionsSubtitle: "Update your profile details quickly.",
          editProfile: "Edit profile",
          preferencesTitle: "Preferences",
          preferencesSubtitle:
            "Choose your currency, app theme, and language in one place.",
          preferredCurrencyLabel: "Preferred currency",
          appThemeLabel: "App theme",
          light: "Light",
          dark: "Dark",
          preferredLanguageLabel: "App language",
          preferredLanguageHint:
            "Choose the language used in profile and preferences.",
          securityTitle: "Security",
          securitySubtitle:
            "Keep your sign-in details up to date and secure.",
          changePassword: "Change password",
          chooseLanguageTitle: "Choose Language",
          chooseLanguageSubtitle:
            "Pick the language you want to use in profile and preferences.",
        };
    }
  }, [preferredCurrency, renderLanguage]);

  const rangeFilteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);

    return expenses.filter((expense) => {
      const date = new Date(expense.date);

      if (dateRange === "allTime") {
        return true;
      }

      if (dateRange === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return date >= start && date <= today;
      }

      if (dateRange === "thisWeek") {
        const start = new Date(now);
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        return date >= start && date <= today;
      }

      if (dateRange === "last30Days") {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return date >= start && date <= today;
      }

      if (dateRange === "lastMonth") {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999,
        );
        return date >= start && date <= end;
      }

      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= start && date <= today;
    });
  }, [dateRange, expenses]);

  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case "today":
        return languageCopy.dateToday;
      case "thisWeek":
        return languageCopy.dateThisWeek;
      case "lastMonth":
        return languageCopy.dateLastMonth;
      case "last30Days":
        return languageCopy.dateLast30Days;
      case "allTime":
        return languageCopy.dateAllTime;
      default:
        return languageCopy.dateThisMonth;
    }
  }, [dateRange, languageCopy]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonth = rangeFilteredExpenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return (
          date.getMonth() === currentMonth && date.getFullYear() === currentYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const lastMonthTotal = rangeFilteredExpenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return (
          date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      thisMonth,
      lastMonth: lastMonthTotal,
      total: rangeFilteredExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      ),
    };
  }, [rangeFilteredExpenses]);

  const sortedCategoryBreakdown = useMemo(() => {
    const grouped = new Map<string, { label: string; total: number }>();

    rangeFilteredExpenses.forEach((expense) => {
      const resolvedLabel = normalizeCategoryName(
        expense.category?.trim() || "Uncategorized",
      );
      const resolvedKey = normalizeCategoryKey(resolvedLabel);
      const current = grouped.get(resolvedKey);

      if (current) {
        current.total += expense.amount;
        return;
      }

      grouped.set(resolvedKey, {
        label: resolvedLabel,
        total: expense.amount,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [rangeFilteredExpenses]);

  const pieChartSlices = useMemo(() => {
    const top = sortedCategoryBreakdown.slice(0, 5);
    const total = top.reduce((sum, item) => sum + item.total, 0);
    const colors = ["#22D3EE", "#F59E0B", "#34D399", "#F472B6", "#818CF8"];
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    return {
      total,
      slices: top.map((item, index) => {
        const fraction = total > 0 ? item.total / total : 0;
        const length = circumference * fraction;
        const slice = {
          label: item.label,
          value: item.total,
          color: colors[index % colors.length],
          strokeDasharray: `${length} ${Math.max(circumference - length, 0)}`,
          strokeDashoffset: -cumulative,
        };
        cumulative += length;
        return slice;
      }),
      radius,
    };
  }, [sortedCategoryBreakdown]);

  const categories = useMemo(
    () => ["All", ...sortedCategoryBreakdown.map((item) => item.label)],
    [sortedCategoryBreakdown],
  );

  const budgetCategoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        [...DEFAULT_EXPENSE_CATEGORIES, ...categories.filter((item) => item !== "All")]
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }, [categories]);

  useEffect(() => {
    if (!budgetCategoryDraft && budgetCategoryOptions.length > 0) {
      setBudgetCategoryDraft(budgetCategoryOptions[0]);
    }
  }, [budgetCategoryDraft, budgetCategoryOptions]);

  const activeDebtReminders = useMemo(
    () => debtReminders.filter((item) => !item.paid),
    [debtReminders],
  );

  const outstandingDebtTotal = useMemo(
    () =>
      activeDebtReminders.reduce(
        (sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0),
        0,
      ),
    [activeDebtReminders],
  );

  const visibleExpenses = useMemo(() => {
    let filtered =
      selectedCategory === "All"
        ? rangeFilteredExpenses
        : rangeFilteredExpenses.filter(
            (expense) =>
              (expense.category || "Uncategorized") === selectedCategory,
          );

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return filtered;
    }

    return filtered.filter((expense) => {
      const values = [
        expense.description,
        expense.category,
        expense.notes,
      ].filter(Boolean) as string[];
      return values.some((value) => value.toLowerCase().includes(query));
    });
  }, [rangeFilteredExpenses, searchQuery, selectedCategory]);

  const displayedExpenses = useMemo(() => {
    if (showAllExpenses || searchQuery.trim()) {
      return visibleExpenses;
    }
    return visibleExpenses.slice(0, 5);
  }, [searchQuery, showAllExpenses, visibleExpenses]);

  const recentExpenseGroupCount = useMemo(() => {
    const labels = new Set<string>();
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

    displayedExpenses.forEach((expense) => {
      const dateStr = new Date(expense.date).toLocaleDateString();
      if (dateStr === today) {
        labels.add("Today");
      } else if (dateStr === yesterday) {
        labels.add("Yesterday");
      } else {
        labels.add(dateStr);
      }
    });

    return labels.size;
  }, [displayedExpenses]);

  const recentExpensesPanelMinHeight = useMemo(() => {
    if (!shouldStackOverviewLayout || isExpensesLoading) {
      return undefined;
    }

    const headerAndControlsHeight = 220;
    const sectionHeaderHeight = recentExpenseGroupCount * 42;
    const itemHeight = displayedExpenses.length * 138;
    const showAllHeight =
      visibleExpenses.length > 5 && !searchQuery.trim() ? 44 : 0;

    return headerAndControlsHeight + sectionHeaderHeight + itemHeight + showAllHeight;
  }, [
    displayedExpenses.length,
    isExpensesLoading,
    recentExpenseGroupCount,
    searchQuery,
    shouldStackOverviewLayout,
    visibleExpenses.length,
  ]);

  const currentMonthSpend = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return (
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const budgetImpactSummary = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const elapsedDays = Math.max(1, Math.min(now.getDate(), daysInMonth));
    const projectedSpend =
      currentMonthSpend > 0
        ? (currentMonthSpend / elapsedDays) * daysInMonth
        : 0;
    const rawProgress =
      monthlyBudget > 0 ? currentMonthSpend / monthlyBudget : 0;

    return {
      progress: Math.min(rawProgress, 1),
      percentage: Math.round(rawProgress * 100),
      remaining:
        monthlyBudget > 0 ? Math.max(monthlyBudget - currentMonthSpend, 0) : 0,
      overspent:
        monthlyBudget > 0 ? Math.max(currentMonthSpend - monthlyBudget, 0) : 0,
      projectedSpend,
      projectedOver:
        monthlyBudget > 0 ? Math.max(projectedSpend - monthlyBudget, 0) : 0,
    };
  }, [currentMonthSpend, monthlyBudget]);

  const budgetUsage =
    monthlyBudget > 0 ? Math.min(stats.thisMonth / monthlyBudget, 1) : 0;
  const remainingBudget =
    monthlyBudget > 0 ? Math.max(monthlyBudget - stats.thisMonth, 0) : 0;
  const overspentThisMonth =
    monthlyBudget > 0 ? Math.max(stats.thisMonth - monthlyBudget, 0) : 0;

  const categoryBudgetProgress = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const spentByCategory: Record<string, number> = {};

    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.date);
      if (
        expenseDate.getMonth() !== currentMonth ||
        expenseDate.getFullYear() !== currentYear
      ) {
        return;
      }

      const key = normalizeBudgetCategoryKey(
        expense.category || "Uncategorized",
      );
      spentByCategory[key] = (spentByCategory[key] || 0) + expense.amount;
    });

    return Object.fromEntries(
      categoryBudgets.map((entry) => {
        const spent =
          spentByCategory[normalizeBudgetCategoryKey(entry.category)] || 0;
        const limit = Number.isFinite(entry.amount) ? entry.amount : 0;
        const progress = limit > 0 ? Math.min(spent / limit, 1) : 0;
        const remaining = limit > 0 ? Math.max(limit - spent, 0) : 0;
        const overspent = limit > 0 ? Math.max(spent - limit, 0) : spent;

        return [
          entry.id,
          {
            spent,
            progress,
            percentage: Math.round(progress * 100),
            remaining,
            overspent,
          },
        ];
      }),
    );
  }, [categoryBudgets, expenses]);

  const categoryBudgetWatchlist = useMemo(
    () =>
      categoryBudgets
        .map((entry) => {
          const metrics = categoryBudgetProgress[entry.id] ?? {
            spent: 0,
            progress: 0,
            percentage: 0,
            remaining: Number.isFinite(entry.amount) ? entry.amount : 0,
            overspent: 0,
          };

          return {
            entry,
            ...metrics,
          };
        })
        .filter(({ entry }) => Number.isFinite(entry.amount) && entry.amount > 0)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 3),
    [categoryBudgetProgress, categoryBudgets],
  );

  const topCategory = sortedCategoryBreakdown[0] ?? null;

  const activeStatsCategory = useMemo(() => {
    if (sortedCategoryBreakdown.length === 0) {
      return null;
    }

    if (
      selectedStatsCategory &&
      sortedCategoryBreakdown.some(
        (item) =>
          normalizeCategoryKey(item.label) ===
          normalizeCategoryKey(selectedStatsCategory),
      )
    ) {
      return selectedStatsCategory;
    }

    return sortedCategoryBreakdown[0].label;
  }, [selectedStatsCategory, sortedCategoryBreakdown]);

  const categoryDrilldownExpenses = useMemo(() => {
    if (!activeStatsCategory) {
      return [];
    }

    const activeKey = normalizeCategoryKey(activeStatsCategory);
    return rangeFilteredExpenses
      .filter((expense) => {
        const categoryLabel = normalizeCategoryName(
          expense.category?.trim() || "Uncategorized",
        );
        return normalizeCategoryKey(categoryLabel) === activeKey;
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
      .slice(0, 5);
  }, [activeStatsCategory, rangeFilteredExpenses]);

  const momentumSeries = useMemo(() => {
    const now = new Date();
    const buildPoint = (label: string, start: Date, end: Date) => ({
      label,
      total: rangeFilteredExpenses
        .filter((expense) => {
          const date = new Date(expense.date);
          return date >= start && date <= end;
        })
        .reduce((sum, expense) => sum + expense.amount, 0),
    });

    if (momentumWindow === "7d") {
      return Array.from({ length: 7 }).map((_, index) => {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() - (6 - index));
        const start = new Date(dayDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dayDate);
        end.setHours(23, 59, 59, 999);
        const label = dayDate.toLocaleDateString(undefined, { weekday: "short" });
        return buildPoint(label, start, end);
      });
    }

    if (momentumWindow === "30d") {
      return Array.from({ length: 5 }).map((_, index) => {
        const windowStart = new Date(now);
        windowStart.setHours(0, 0, 0, 0);
        windowStart.setDate(now.getDate() - (29 - index * 7));

        const windowEnd = new Date(windowStart);
        windowEnd.setDate(windowStart.getDate() + (index === 4 ? 1 : 6));
        windowEnd.setHours(23, 59, 59, 999);

        return buildPoint(`W${index + 1}`, windowStart, windowEnd);
      });
    }

    return Array.from({ length: 6 }).map((_, index) => {
      const pointMonth = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const start = new Date(pointMonth.getFullYear(), pointMonth.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(pointMonth.getFullYear(), pointMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = pointMonth.toLocaleDateString(undefined, { month: "short" });
      return buildPoint(label, start, end);
    });
  }, [momentumWindow, rangeFilteredExpenses]);

  const momentumMax = useMemo(() => {
    const highest = Math.max(...momentumSeries.map((item) => item.total), 0);
    return highest > 0 ? highest : 1;
  }, [momentumSeries]);

  const momentumAverage = useMemo(() => {
    if (momentumSeries.length === 0) {
      return 0;
    }
    const total = momentumSeries.reduce((sum, item) => sum + item.total, 0);
    return total / momentumSeries.length;
  }, [momentumSeries]);

  const peakMomentum = useMemo(() => {
    if (momentumSeries.length === 0) {
      return null;
    }
    return [...momentumSeries].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [momentumSeries]);

  const momentumSubtitle = useMemo(() => {
    if (momentumWindow === "7d") {
      return languageCopy.momentum7d;
    }
    if (momentumWindow === "30d") {
      return languageCopy.momentum30d;
    }
    return languageCopy.momentum90d;
  }, [languageCopy, momentumWindow]);

  const momentumChart = useMemo(() => {
    const widthValue =
      Platform.OS === "web"
        ? Math.max(
            760,
            Math.min(1360, width - (useSidebarNavigation ? 260 : 72)),
          )
        : 620;
    const heightValue = 260;
    const left = Platform.OS === "web" ? 54 : 66;
    const right = Platform.OS === "web" ? 28 : 24;
    const top = 16;
    const bottom = 40;
    const plotWidth = widthValue - left - right;
    const plotHeight = heightValue - top - bottom;
    const safeMax = momentumMax > 0 ? momentumMax : 1;
    const stepX =
      momentumSeries.length > 1 ? plotWidth / (momentumSeries.length - 1) : 0;

    const points = momentumSeries.map((item, index) => {
      const x = left + stepX * index;
      const y = top + (1 - item.total / safeMax) * plotHeight;
      return { x, y, label: item.label, value: item.total };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`
        : "";

    return {
      width: widthValue,
      height: heightValue,
      left,
      right,
      top,
      plotHeight,
      points,
      linePath,
      areaPath,
    };
  }, [momentumMax, momentumSeries, useSidebarNavigation, width]);

  const graphEntries = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const weekTotals = [0, 0, 0, 0];

    rangeFilteredExpenses.forEach((expense) => {
      const date = new Date(expense.date);
      if (
        date.getMonth() !== currentMonth ||
        date.getFullYear() !== currentYear
      ) {
        return;
      }

      const dayOfMonth = date.getDate();
      const weekIndex =
        dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : 3;
      weekTotals[weekIndex] += expense.amount;
    });

    return weekTotals.map((total, index) => [`W${index + 1}`, total] as const);
  }, [rangeFilteredExpenses]);

  const weeklyInsight = useMemo(() => {
    const activeWeeks = graphEntries.filter(([, total]) => total > 0);
    const highestWeek = [...graphEntries].sort((a, b) => b[1] - a[1])[0];
    const averageWeeklySpend =
      activeWeeks.length > 0
        ? activeWeeks.reduce((sum, [, total]) => sum + total, 0) /
          activeWeeks.length
        : 0;

    return {
      highestWeek,
      averageWeeklySpend,
      activeWeeks: activeWeeks.length,
    };
  }, [graphEntries]);

  const trendStats = useMemo(() => {
    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay());

    const startOfLastWeek = new Date(startOfCurrentWeek);
    startOfLastWeek.setDate(startOfCurrentWeek.getDate() - 7);

    const currentWeekTotal = rangeFilteredExpenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date >= startOfCurrentWeek;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const lastWeekTotal = rangeFilteredExpenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date >= startOfLastWeek && date < startOfCurrentWeek;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const averageExpense =
      rangeFilteredExpenses.length > 0
        ? rangeFilteredExpenses.reduce(
            (sum, expense) => sum + expense.amount,
            0,
          ) / rangeFilteredExpenses.length
        : 0;

    const receiptCoverage =
      rangeFilteredExpenses.length > 0
        ? rangeFilteredExpenses.filter((expense) => expense.imageUrl).length /
          rangeFilteredExpenses.length
        : 0;

    const monthlyChange =
      stats.lastMonth > 0
        ? ((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100
        : stats.thisMonth > 0
          ? 100
          : 0;

    return {
      currentWeekTotal,
      lastWeekTotal,
      averageExpense,
      receiptCoverage,
      monthlyChange,
    };
  }, [rangeFilteredExpenses, stats.lastMonth, stats.thisMonth]);

  const smartInsights = useMemo(() => {
    const receiptCount = rangeFilteredExpenses.filter(
      (expense) => expense.imageUrl,
    ).length;
    const receiptTotal = rangeFilteredExpenses.length;
    const receiptPercent =
      receiptTotal > 0 ? Math.round((receiptCount / receiptTotal) * 100) : 0;
    const weeklyDifference =
      trendStats.currentWeekTotal - trendStats.lastWeekTotal;
    const weeklyDifferencePercent =
      trendStats.lastWeekTotal > 0
        ? Math.round(Math.abs(weeklyDifference / trendStats.lastWeekTotal) * 100)
        : 0;
    const weeklyMeta =
      trendStats.lastWeekTotal <= 0
        ? languageCopy.insightWeeklyPaceNew
        : weeklyDifferencePercent <= 3
          ? languageCopy.insightWeeklyPaceFlat
          : weeklyDifference >= 0
            ? formatCopy("insightWeeklyPaceUp", {
                percent: weeklyDifferencePercent,
              })
            : formatCopy("insightWeeklyPaceDown", {
                percent: weeklyDifferencePercent,
              });

    return [
      {
        key: "top-category",
        icon: "pricetag-outline" as keyof typeof Ionicons.glyphMap,
        title: languageCopy.topCategory,
        value: topCategory
          ? getCategoryDisplayLabel(topCategory.label)
          : languageCopy.noDataYet,
        meta: topCategory
          ? formatCopy("insightTopCategoryDetail", {
              amount: formatAmount(topCategory.total),
              range: dateRangeLabel.toLowerCase(),
            })
          : languageCopy.addExpenses,
      },
      {
        key: "weekly-pace",
        icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap,
        title: languageCopy.insightWeeklyPaceTitle,
        value:
          trendStats.lastWeekTotal > 0
            ? `${weeklyDifference >= 0 ? "+" : "-"}${weeklyDifferencePercent}%`
            : formatAmount(trendStats.currentWeekTotal),
        meta: weeklyMeta,
      },
      {
        key: "receipt-proof",
        icon: "receipt-outline" as keyof typeof Ionicons.glyphMap,
        title: languageCopy.insightReceiptProofTitle,
        value: `${receiptPercent}%`,
        meta: formatCopy("insightReceiptProofDetail", {
          count: receiptCount,
          total: receiptTotal,
        }),
      },
      {
        key: "forecast",
        icon: "analytics-outline" as keyof typeof Ionicons.glyphMap,
        title: languageCopy.insightForecastTitle,
        value: formatAmount(budgetImpactSummary.projectedSpend),
        meta: formatCopy("insightForecastDetail", {
          amount: formatAmount(budgetImpactSummary.projectedSpend),
        }),
      },
    ];
  }, [
    budgetImpactSummary.projectedSpend,
    dateRangeLabel,
    formatAmount,
    formatCopy,
    getCategoryDisplayLabel,
    languageCopy,
    rangeFilteredExpenses,
    topCategory,
    trendStats.currentWeekTotal,
    trendStats.lastWeekTotal,
  ]);

  const budgetAlert = useMemo(() => {
    if (monthlyBudget <= 0) {
      return {
        tone: "neutral",
        title: languageCopy.budgetTargetMissing,
        message: languageCopy.budgetTargetMissingMessage,
      };
    }

    if (budgetUsage >= 1) {
      return {
        tone: "danger",
        title: languageCopy.budgetExceeded,
        message: `${languageCopy.budgetExceededMessagePrefix} ${formatAmount(
          overspentThisMonth,
        )}${languageCopy.budgetExceededMessageSuffix}`,
      };
    }

    if (budgetUsage >= 0.8) {
      return {
        tone: "warning",
        title: languageCopy.budgetWarning,
        message: languageCopy.budgetWarningMessage,
      };
    }

    return {
      tone: "success",
      title: languageCopy.budgetOnTrack,
      message: `${languageCopy.budgetOnTrackMessagePrefix} ${formatAmount(
        remainingBudget,
      )} ${languageCopy.budgetOnTrackMessageSuffix}`,
    };
  }, [
    budgetUsage,
    formatAmount,
    languageCopy,
    monthlyBudget,
    overspentThisMonth,
    remainingBudget,
  ]);

  const galleryExpenses = useMemo(
    () => rangeFilteredExpenses.filter((expense) => expense.imageUrl),
    [rangeFilteredExpenses],
  );

  const galleryCategories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          galleryExpenses.map(
            (expense) => expense.category || "Uncategorized",
          ),
        ),
      ),
    ],
    [galleryExpenses],
  );

  const filteredGalleryExpenses = useMemo(() => {
    const query = gallerySearchQuery.trim().toLowerCase();
    const categoryFiltered =
      galleryCategoryFilter === "All"
        ? galleryExpenses
        : galleryExpenses.filter(
            (expense) =>
              (expense.category || "Uncategorized") === galleryCategoryFilter,
          );

    if (!query) {
      return categoryFiltered;
    }

    return categoryFiltered.filter((expense) =>
      [expense.description, expense.category, expense.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [galleryCategoryFilter, galleryExpenses, gallerySearchQuery]);

  const theme = useMemo(
    () =>
      themeMode === "dark"
        ? {
            safeBackground: "#020617",
            cardBackground: "rgba(8, 15, 30, 0.78)",
            cardBorder: "rgba(148, 163, 184, 0.05)",
            mutedSurface: "rgba(15, 23, 42, 0.92)",
            title: "#F8FAFC",
            text: "#CBD5E1",
            muted: "#94A3B8",
            faint: "#64748B",
            accent: "#7DD3FC",
            hero: ["rgba(15,23,42,0.92)", "rgba(8,15,30,0.72)"] as [
              string,
              string,
            ],
          }
        : {
            safeBackground: "#F4F7FB",
            cardBackground: "rgba(255, 255, 255, 0.94)",
            cardBorder: "rgba(148, 163, 184, 0.1)",
            mutedSurface: "rgba(241, 245, 249, 0.96)",
            title: "#0F172A",
            text: "#334155",
            muted: "#475569",
            faint: "#64748B",
            accent: "#0284C7",
            hero: ["rgba(255,255,255,0.98)", "rgba(226,232,240,0.92)"] as [
              string,
              string,
            ],
          },
    [themeMode],
  );

  const navigationItems = [
    { key: "overview", icon: "grid-outline", label: languageCopy.navOverview },
    { key: "budget", icon: "wallet-outline", label: languageCopy.navBudget },
    { key: "stats", icon: "stats-chart-outline", label: languageCopy.navStats },
    { key: "gallery", icon: "images-outline", label: languageCopy.navGallery },
    { key: "profile", icon: "person-circle-outline", label: languageCopy.navProfile },
  ] as const;
  const dashboardNavItems = navigationItems.filter(
    (item) => item.key !== "profile",
  );

  const currentTimeLabel = useMemo(
    () =>
      clockNow.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    [clockNow],
  );

  const currentDateLabel = useMemo(
    () =>
      clockNow.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [clockNow],
  );

  const renderAvatar = (size: number, fontSize: number) => {
    if (user.avatar) {
      return (
        <Image
          source={{ uri: user.avatar }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      );
    }

    return (
      <LinearGradient
        colors={["#22D3EE", "#3B82F6", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.avatarFallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.avatarText, { fontSize }]}>
          {user.name?.charAt(0).toUpperCase() || "U"}
        </Text>
      </LinearGradient>
    );
  };

  const renderSkeletonCard = (height: number, widthValue?: DimensionValue) => (
    <View
      style={[
        styles.skeletonBlock,
        {
          height,
          width: widthValue ?? "100%",
          backgroundColor:
            themeMode === "dark"
              ? "rgba(148, 163, 184, 0.12)"
              : "rgba(148, 163, 184, 0.16)",
        },
      ]}
    />
  );

  const renderRecentSkeletons = () => (
    <View style={styles.skeletonStack}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={`recent-skeleton-${index}`}
          style={[
            styles.skeletonExpenseCard,
            {
              backgroundColor: theme.mutedSurface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {renderSkeletonCard(54, 54)}
          <View style={styles.skeletonExpenseCopy}>
            {renderSkeletonCard(14, "62%")}
            {renderSkeletonCard(12, "36%")}
            {renderSkeletonCard(12, "72%")}
          </View>
          <View style={styles.skeletonExpenseMeta}>
            {renderSkeletonCard(14, 70)}
            {renderSkeletonCard(11, 54)}
          </View>
        </View>
      ))}
    </View>
  );

  const closeConfirmationDialog = useCallback(() => {
    setConfirmationDialog((current) => ({ ...current, visible: false }));
    confirmationActionRef.current = null;
  }, []);

  const openConfirmationDialog = useCallback(
    (
      title: string,
      message: string,
      confirmLabel: string,
      onConfirm: () => void | Promise<void>,
      tone: "default" | "danger" = "danger",
    ) => {
      confirmationActionRef.current = onConfirm;
      setConfirmationDialog({
        visible: true,
        title,
        message,
        confirmLabel,
        tone,
      });
    },
    [],
  );

  const handleConfirmationSubmit = useCallback(async () => {
    const action = confirmationActionRef.current;
    closeConfirmationDialog();
    if (!action) {
      return;
    }
    await action();
  }, [closeConfirmationDialog]);

  const confirmClearAll = () => {
    openConfirmationDialog(
      languageCopy.clearAll,
      renderLanguage === "Filipino"
        ? "Aalisin nito ang lahat ng naka-save na gastos sa account mo."
        : "This removes every saved expense entry from your account.",
      languageCopy.clearAll,
      async () => {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        await onClearAll();
      },
      "danger",
    );
  };

  const confirmLogout = () => {
    openConfirmationDialog(
      languageCopy.logout,
      renderLanguage === "Filipino"
        ? "Sigurado ka bang gusto mong mag-sign out?"
        : "Are you sure you want to sign out?",
      languageCopy.logout,
      async () => {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        onLogout();
      },
      "danger",
    );
  };

  const confirmDeleteExpense = (id: string) => {
    const expense = expenses.find((entry) => entry.id === id);
    const message = expense
      ? renderLanguage === "Filipino"
        ? `Tanggalin ang "${expense.description}" sa expense list mo?`
        : `Delete "${expense.description}" from your expense list?`
      : renderLanguage === "Filipino"
        ? "Tanggalin ang gastos na ito sa expense list mo?"
        : "Delete this expense from your expense list?";
    openConfirmationDialog(
      renderLanguage === "Filipino" ? "Tanggalin ang gastos" : "Delete expense",
      message,
      languageCopy.delete,
      async () => {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        onDeleteExpense(id);
      },
      "danger",
    );
  };

  const saveCategoryBudget = async () => {
    const parsedAmount = Number.parseFloat(budgetAmountDraft.trim());
    if (!budgetCategoryDraft.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      notify(
        renderLanguage === "Filipino"
          ? "Maglagay ng valid na category at budget amount."
          : "Enter a valid category and budget amount.",
        "error",
      );
      return;
    }

    const trimmedCategory = budgetCategoryDraft.trim();
    const newEntry: BudgetCategoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: trimmedCategory,
      amount: parsedAmount,
      note: budgetNoteDraft.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setCategoryBudgets((current) => {
      const next = current.filter(
        (entry) => entry.category.toLowerCase() !== trimmedCategory.toLowerCase(),
      );
      return [...next, newEntry].sort((a, b) => a.category.localeCompare(b.category));
    });

    setShowBudgetCategoryMenu(false);
    setBudgetAmountDraft("");
    setBudgetNoteDraft("");
    notify(
      renderLanguage === "Filipino"
        ? "Na-save ang budget."
        : "Budget saved successfully.",
      "success",
    );
  };

  const saveDebtReminder = async () => {
    const parsedAmount = Number.parseFloat(debtAmountDraft.trim());
    if (!debtTitleDraft.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      notify(
        renderLanguage === "Filipino"
          ? "Maglagay ng valid na debt title at halaga."
          : "Enter a valid debt title and amount.",
        "error",
      );
      return;
    }

    const newEntry: DebtReminderEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: debtTitleDraft.trim(),
      amount: parsedAmount,
      lender: debtLenderDraft.trim() || "N/A",
      dueDate: debtDueDateDraft.trim() || new Date().toISOString().slice(0, 10),
      note: debtNoteDraft.trim() || undefined,
      paid: false,
      createdAt: new Date().toISOString(),
    };

    setDebtReminders((current) => [newEntry, ...current]);
    setDebtTitleDraft("");
    setDebtAmountDraft("");
    setDebtLenderDraft("");
    setDebtDueDateDraft(new Date().toISOString().slice(0, 10));
    setDebtNoteDraft("");
    notify(
      renderLanguage === "Filipino"
        ? "Na-save ang debt reminder."
        : "Debt reminder saved successfully.",
      "success",
    );
  };

  const confirmDeleteCategoryBudget = (id: string) => {
    const proceed = () => {
      setCategoryBudgets((current) => current.filter((entry) => entry.id !== id));
      notify(
        renderLanguage === "Filipino"
          ? "Natanggal ang category budget."
          : "Category budget removed.",
        "warning",
      );
    };
    openConfirmationDialog(
      renderLanguage === "Filipino" ? "Tanggalin ang budget" : "Delete budget",
      renderLanguage === "Filipino"
        ? "Tanggalin ang category budget na ito?"
        : "Delete this category budget?",
      languageCopy.delete,
      proceed,
      "danger",
    );
  };

  const confirmDeleteDebtReminder = (id: string) => {
    const proceed = () => {
      setDebtReminders((current) => current.filter((entry) => entry.id !== id));
      notify(
        renderLanguage === "Filipino"
          ? "Natanggal ang debt reminder."
          : "Debt reminder deleted.",
        "warning",
      );
    };
    openConfirmationDialog(
      renderLanguage === "Filipino" ? "Tanggalin ang reminder" : "Delete reminder",
      renderLanguage === "Filipino"
        ? "Tanggalin ang debt reminder na ito?"
        : "Delete this debt reminder?",
      languageCopy.delete,
      proceed,
      "danger",
    );
  };

  const markDebtAsPaid = (id: string) => {
    setDebtReminders((current) =>
      current.map((entry) =>
        entry.id === id
          ? { ...entry, paid: true, paidAt: new Date().toISOString() }
          : entry,
      ),
    );
    notify(
      renderLanguage === "Filipino"
        ? "Na-markahan bilang bayad ang utang."
        : "Debt marked as paid.",
      "success",
    );
  };

  const handleQuickAdd = async (
    description: string,
    amount: number,
    category?: string,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuickAddDraft({ description, amount, category });
    setShowAddForm(true);
  };

  const exportRows = useMemo(
    () =>
      rangeFilteredExpenses.map((expense) => ({
        date: new Date(expense.date).toLocaleDateString(),
        description: expense.description,
        category: getCategoryDisplayLabel(expense.category),
        amount: expense.amount.toFixed(2),
        notes: expense.notes || "",
        receipt: expense.imageUrl ? languageCopy.yes : languageCopy.no,
      })),
    [getCategoryDisplayLabel, languageCopy, rangeFilteredExpenses],
  );

  const summaryRows = useMemo(
    () => [
      [languageCopy.metric, languageCopy.value],
      [languageCopy.totalExpenses, formatAmount(stats.total)],
      [languageCopy.dateThisMonth, formatAmount(stats.thisMonth)],
      [languageCopy.dateLastMonth, formatAmount(stats.lastMonth)],
      [languageCopy.currentWeek, formatAmount(trendStats.currentWeekTotal)],
      [
        formatCopy("lastWeek", {
          amount: "",
        }).replace(/:\s*$/, ""),
        formatAmount(trendStats.lastWeekTotal),
      ],
      [languageCopy.averageExpense, formatAmount(trendStats.averageExpense)],
      [languageCopy.receiptCoverage, `${Math.round(trendStats.receiptCoverage * 100)}%`],
      [languageCopy.entriesExported, String(rangeFilteredExpenses.length)],
    ],
    [
      formatAmount,
      formatCopy,
      languageCopy,
      rangeFilteredExpenses.length,
      stats.lastMonth,
      stats.thisMonth,
      stats.total,
      trendStats,
    ],
  );

  const renderBudgetPanel = (
    title: string,
    subtitle: string,
    showTargetCard = false,
    compactOverview = false,
  ) => (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View
        style={[
          styles.panelHeader,
          isCompact && styles.panelHeaderStack,
        ]}
      >
        <View>
          <Text style={[styles.sectionTitle, { color: theme.title }]}>
            {title}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
            {subtitle}
          </Text>
        </View>
        {compactOverview ? (
          <TouchableOpacity
            style={[
              styles.overviewBudgetShortcutButton,
              {
                backgroundColor:
                  themeMode === "light"
                    ? "rgba(2, 132, 199, 0.1)"
                    : "rgba(34, 211, 238, 0.12)",
                borderColor:
                  themeMode === "light"
                    ? "rgba(2, 132, 199, 0.2)"
                    : "rgba(34, 211, 238, 0.22)",
              },
            ]}
            onPress={() => setActiveTab("budget")}
          >
            <Text
              style={[
                styles.overviewBudgetShortcutButtonText,
                { color: theme.accent },
              ]}
            >
              {languageCopy.openBudget}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[
          styles.budgetShell,
          {
            backgroundColor: theme.mutedSurface,
            borderColor: theme.cardBorder,
          },
          compactOverview && styles.overviewBudgetShell,
        ]}
      >
        <View
          style={[
            styles.budgetHeader,
            isCompact && styles.budgetHeaderStack,
            compactOverview && styles.overviewBudgetHeader,
          ]}
        >
          <View style={styles.budgetBlock}>
            <Text style={[styles.budgetLabel, { color: theme.muted }]}>
              {languageCopy.monthlyBudget}
            </Text>
            <TextInput
              style={[
                styles.budgetInput,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                  color: theme.title,
                },
              ]}
              value={String(monthlyBudget)}
              onChangeText={(value) =>
                setMonthlyBudget(
                  Number.parseFloat(value.replace(/[^0-9.]/g, "")) || 0,
                )
              }
              keyboardType="numeric"
            />
          </View>
          <View
            style={[
              styles.budgetSummary,
              isCompact && styles.budgetSummaryCompact,
              compactOverview && styles.overviewBudgetSummary,
            ]}
          >
            <Text style={[styles.budgetLabel, { color: theme.muted }]}>
              Spent so far
            </Text>
            <Text style={[styles.budgetValue, { color: theme.title }]}>
              {formatAmount(stats.thisMonth)}
            </Text>
          </View>
        </View>
        <View style={styles.budgetTrack}>
          <LinearGradient
            colors={["#22D3EE", "#3B82F6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.budgetFill,
              { width: `${Math.max(budgetUsage * 100, 4)}%` },
            ]}
          />
        </View>
        <View
          style={[
            styles.budgetMetaRow,
            isCompact && styles.budgetMetaRowCompact,
          ]}
        >
          <Text style={[styles.budgetMetaText, { color: theme.faint }]}>
            {Math.round(budgetUsage * 100)}% used
          </Text>
          <Text
            style={[
              styles.budgetMetaText,
              isCompact && styles.budgetMetaTextCompact,
              { color: theme.faint },
            ]}
          >
            {monthlyBudget > 0
              ? `${formatAmount(stats.thisMonth)} of ${formatAmount(
                  monthlyBudget,
                )}`
              : "Add a budget target to unlock guidance"}
          </Text>
        </View>

        <View style={styles.budgetMetricsRow}>
          <View
            style={[
              styles.budgetMetricCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
            >
              <Text style={[styles.budgetMetricLabel, { color: theme.muted }]}>
                Remaining
              </Text>
            <Text
              style={[
                styles.budgetMetricValue,
                {
                  color: overspentThisMonth > 0 ? "#F87171" : theme.title,
                },
              ]}
            >
              {overspentThisMonth > 0
                ? `-${formatAmount(overspentThisMonth)}`
                : formatAmount(remainingBudget)}
            </Text>
          </View>

          {showTargetCard ? (
            <View
              style={[
                styles.budgetMetricCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[styles.budgetMetricLabel, { color: theme.muted }]}
              >
                Target
              </Text>
              <Text
                style={[styles.budgetMetricValue, { color: theme.title }]}
              >
                {monthlyBudget > 0 ? formatAmount(monthlyBudget) : languageCopy.notSet}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.budgetMetricCard,
                styles.budgetMetricCardSingle,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.budgetMetricLabel, { color: theme.muted }]}>
                Status
              </Text>
              <Text
                style={[styles.budgetMetricValue, { color: theme.title }]}
              >
                {budgetAlert.title}
              </Text>
            </View>
          )}
        </View>
      </View>

      {!compactOverview ? (
        <View
          style={[
            styles.budgetAlertCard,
            budgetAlert.tone === "danger"
              ? styles.budgetAlertDanger
              : budgetAlert.tone === "warning"
                ? styles.budgetAlertWarning
                : budgetAlert.tone === "success"
                  ? styles.budgetAlertSuccess
                  : styles.budgetAlertNeutral,
            {
              backgroundColor: theme.mutedSurface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.budgetAlertHeader}>
            <Ionicons
              name={
                budgetAlert.tone === "danger"
                  ? "warning-outline"
                  : budgetAlert.tone === "warning"
                    ? "alert-circle-outline"
                    : "shield-checkmark-outline"
              }
              size={18}
              color={
                budgetAlert.tone === "danger"
                  ? "#F87171"
                  : budgetAlert.tone === "warning"
                    ? "#FBBF24"
                    : "#34D399"
              }
            />
            <Text style={[styles.budgetAlertTitle, { color: theme.title }]}>
              {budgetAlert.title}
            </Text>
          </View>
          <Text style={[styles.budgetAlertText, { color: theme.muted }]}>
            {budgetAlert.message}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const triggerWebDownload = (
    content: BlobPart,
    type: string,
    extension: string,
  ) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eyegasto-report-${new Date()
      .toISOString()
      .slice(0, 10)}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareNativeFile = async (
    content: string,
    extension: string,
    mimeType: string,
    dialogTitle: string,
  ) => {
    const fileUri = `${FileSystem.cacheDirectory}eyegasto-report-${Date.now()}.${extension}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle,
      });
    } else {
      Alert.alert(
        languageCopy.exportReady,
        formatCopy("savedReportTo", { fileUri }),
      );
    }
  };

  const sanitizePdfText = (value: string) =>
    value
      .replace(/[\u20B1\u20AB\u20AC\u00A3\u00A5]/g, (char) => PDF_TEXT_REPLACEMENTS[char] ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, "");

  const buildPdfDocument = (content: string) => {
    const lines = content.split("\n");
    const linesPerPage = 38;
    const pages: string[][] = [];

    for (let index = 0; index < lines.length; index += linesPerPage) {
      pages.push(lines.slice(index, index + linesPerPage));
    }

    const objects: string[] = [];
    const pageObjectNumbers: number[] = [];
    const fontObjectNumber = 3;

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    pages.forEach((pageLines, pageIndex) => {
      const pageObjectNumber = 4 + pageIndex * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      pageObjectNumbers.push(pageObjectNumber);

      const streamLines = pageLines.map((line, lineIndex) => {
        const y = 760 - lineIndex * 18;
        return `1 0 0 1 48 ${y} Tm (${sanitizePdfText(line)}) Tj`;
      });
      const stream = `BT\n/F1 12 Tf\n${streamLines.join("\n")}\nET`;

      objects[contentObjectNumber] =
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      objects[pageObjectNumber] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    });

    objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];

    for (
      let objectNumber = 1;
      objectNumber < objects.length;
      objectNumber += 1
    ) {
      if (!objects[objectNumber]) continue;
      offsets[objectNumber] = pdf.length;
      pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += "0000000000 65535 f \n";

    for (
      let objectNumber = 1;
      objectNumber < objects.length;
      objectNumber += 1
    ) {
      const offset = offsets[objectNumber] ?? 0;
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  };

  const handleExportReport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      const expenseRows = [
        [
          languageCopy.date,
          languageCopy.description,
          languageCopy.category,
          languageCopy.amount,
          languageCopy.receipt,
        ],
        ...exportRows.map((row) => [
          row.date,
          row.description,
          row.category,
          row.amount,
          row.receipt,
        ]),
      ];

      const csv = [...summaryRows, [], ...expenseRows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");

      const summaryText = [
        languageCopy.expenseSummaryTitle,
        `${languageCopy.generated}: ${new Date().toLocaleString()}`,
        "",
        ...summaryRows.slice(1).map(([label, value]) => `${label}: ${value}`),
        "",
        languageCopy.recentExportedExpenses,
        ...exportRows.map(
          (row) =>
            `${row.date} | ${row.description} | ${row.category} | ${preferredCurrency} ${row.amount} | ${languageCopy.receipt}: ${row.receipt}`,
        ),
      ].join("\n");

      const pdfReport = buildPdfDocument(summaryText);

      if (Platform.OS === "web") {
        if (format === "summary") {
          triggerWebDownload(summaryText, "text/plain;charset=utf-8;", "txt");
          return;
        }

        if (format === "pdf") {
          triggerWebDownload(pdfReport, "application/pdf", "pdf");
          return;
        }

        triggerWebDownload(csv, "text/csv;charset=utf-8;", "csv");
        return;
      }

      if (format === "summary") {
        await shareNativeFile(
          summaryText,
          "txt",
          "text/plain",
          languageCopy.exportSummaryShareTitle,
        );
      } else if (format === "pdf") {
        await shareNativeFile(
          pdfReport,
          "pdf",
          "application/pdf",
          languageCopy.exportPdfShareTitle,
        );
      } else {
        await shareNativeFile(
          csv,
          "csv",
          "text/csv",
          languageCopy.exportCsvShareTitle,
        );
      }
    } catch (error) {
      console.error("Failed to export report", error);
      Alert.alert(languageCopy.exportFailed, languageCopy.exportFailedMessage);
    } finally {
      setIsExporting(false);
      setShowExportOptions(false);
    }
  };

  const startEditingExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category || "");
    setEditNotes(expense.notes || "");
    setEditImageUrl(expense.imageUrl ?? null);
  };

  const closeEditingExpense = () => {
    setEditingExpense(null);
    setEditImageUrl(null);
  };

  const pickExpenseReceipt = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          languageCopy.permissionNeeded,
          languageCopy.receiptPermission,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setEditImageUrl(result.assets[0]?.uri || null);
      }
    } catch (error) {
      console.error("Failed to pick receipt image", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) {
      return;
    }

    const numericAmount = Number.parseFloat(editAmount);
    if (
      !editDescription.trim() ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      Alert.alert(
        languageCopy.missingDetails,
        languageCopy.invalidEditExpense,
      );
      return;
    }

    setIsSavingEdit(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await onUpdateExpense(editingExpense.id, {
        description: editDescription.trim(),
        amount: numericAmount,
        category: editCategory.trim() || undefined,
        notes: editNotes.trim() || undefined,
        imageUrl: editImageUrl,
        receiptPath:
          editImageUrl && /^https?:\/\//i.test(editImageUrl)
            ? editingExpense.receiptPath
            : undefined,
      });

      if (success) {
        closeEditingExpense();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editUsername.trim() || !editEmail.trim() || !onUpdateUser) {
      return;
    }

    await onUpdateUser({
      name: editName.trim(),
      username: editUsername.trim().toLowerCase(),
      email: editEmail.trim(),
    });
    setIsEditingProfile(false);
  };

  const handleRemoveRecurringExpense = async (recurringId: string) => {
    if (!onUpdateUser) {
      return;
    }

    const nextRecurringExpenses = (user.recurringExpenses ?? []).filter(
      (item) => item.id !== recurringId,
    );

    await onUpdateUser({ recurringExpenses: nextRecurringExpenses });
  };

  const handlePickAvatar = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          languageCopy.permissionNeeded,
          languageCopy.avatarPermission,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && onUpdateUser) {
        const selectedAsset = result.assets[0];
        if (!selectedAsset?.uri) {
          return;
        }

        const uploadResult = await expenseStorage.uploadAvatar(
          selectedAsset.uri,
          selectedAsset.mimeType,
        );

        if (!uploadResult.success || !uploadResult.imageUrl) {
          Alert.alert(
            languageCopy.avatarUploadFailed,
            uploadResult.error || languageCopy.avatarUploadFallback,
          );
          return;
        }

        await onUpdateUser({ avatar: uploadResult.imageUrl });
      }
    } catch (error) {
      console.error("Failed to update avatar", error);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword.trim()) {
      setPasswordError(languageCopy.passwordCurrentRequired);
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError(languageCopy.passwordNewRequired);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(languageCopy.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(languageCopy.passwordMismatch);
      return;
    }

    if (!onChangePassword) {
      setPasswordError(languageCopy.passwordUnavailable);
      return;
    }

    setIsChangingPassword(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setPasswordSuccess(languageCopy.passwordChanged);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
    } catch (error: any) {
      setPasswordError(error.message || languageCopy.passwordChangeFailed);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const infoContent = useMemo<InfoContentCopy>(() => {
    if (renderLanguage === "Filipino") {
      return {
        terms: {
          title: "Mga Tuntunin sa Paggamit",
          sections: [
            {
              heading: "Paggamit ng EyeGasto",
              body: "Ang EyeGasto ay para sa personal expense tracking, receipt storage, analytics, budget support, at export review. Gamitin lamang ito para sa legal, tama, at personal na financial records.",
            },
            {
              heading: "Responsibilidad Mo",
              body: "Ikaw ang responsable sa pagprotekta ng login credentials, pagsuri ng expenses na sine-save mo, at pag-log out sa shared devices. Suriin din ang exported files bago ito ibahagi.",
            },
            {
              heading: "Uploads at Records",
              body: "Ang receipt images, notes, debt reminders, recurring plans, at exported reports ay dapat naglalaman lang ng impormasyong komportable kang i-store, i-review, at i-share mula sa account mo.",
            },
            {
              heading: "Account at Access",
              body: "May ilang EyeGasto features na nakaasa sa signed-in account para lumabas ang expenses, receipt references, planner entries, at preferences sa supported devices. Kapag natapos ang session, maaaring kailanganing mag-sign in ulit.",
            },
            {
              heading: "Availability ng Features",
              body: "Ang analytics, gallery review, export, budget tracking, at debt reminders ay nakadepende sa data na sine-save mo. Maaaring walang laman ang ilang bahagi kapag wala pang expenses, receipts, o planner records.",
            },
            {
              heading: "Tamang Paggamit",
              body: "Iwasang mag-upload ng harmful, irrelevant, o misleading content. Ang EyeGasto ay para ayusin ang spending information, hindi para mag-store ng unrelated files o magpanggap na financial documents.",
            },
            {
              heading: "Budgets, Reminders, at Decisions",
              body: "Ang budget planner summaries, debt reminders, category progress, at analytics ay tools para sa pag-review ng sariling records. Hindi ito financial, legal, o accounting advice.",
            },
            {
              heading: "Exports at Printed Reports",
              body: "Kapag nag-export ka ng CSV, PDF, o summary files, ikaw ang responsable kung paano ito ida-download, ish-share, ise-save, o ipi-print. Kapag nasa labas na ng app, maaaring hindi na ito protektado ng in-app experience.",
            },
            {
              heading: "Katumpakan ng Data",
              body: "Ang analytics, category breakdowns, budget progress, at receipt gallery ay nakadepende sa data na sine-save mo. Mali ang summary kapag mali ang dates, categories, amounts, o missing ang receipts.",
            },
          ],
        },
        privacy: {
          title: "Patakaran sa Privacy",
          sections: [
            {
              heading: "Ano ang Ini-store",
              body: "Ini-store ng EyeGasto ang profile details, expense records, category selections, recurring plans, budget planner entries, debt reminders, at receipt files para makapag-sync ang data sa supported devices.",
            },
            {
              heading: "Paano Ito Ginagamit",
              body: "Ginagamit ang stored data para paganahin ang dashboard analytics, category breakdowns, receipt previews, planner summaries, export files, recurring expense generation, at saved dashboard preferences.",
            },
            {
              heading: "Sharing at Exports",
              body: "Ikaw ang nagsisimula ng exports at shared files. Suriin ang laman bago ipadala, i-download, i-print, o i-store sa labas ng app dahil maaaring may dates, categories, notes, totals, at receipt information.",
            },
            {
              heading: "Receipts at Images",
              body: "Ang receipt images na naka-attach sa expenses ay konektado sa account mo para lumabas sa receipt gallery at related expense views. Iwasang mag-upload ng sensitive information na ayaw mong ma-store.",
            },
            {
              heading: "Preferences at Personalization",
              body: "Sine-save ng EyeGasto ang preferences gaya ng theme, language, date range, currency, at selected sections para bumalik ang dashboard sa huling experience na ginamit mo.",
            },
            {
              heading: "Control Mo",
              body: "Maaari mong i-edit o burahin ang expenses, planner items, at ilang personal details sa loob ng app. Ang exports, support contact, at receipt uploads ay nasa control mo kapag ginamit mo ang action.",
            },
            {
              heading: "Range-Based Views",
              body: "May dashboard surfaces na nakadepende sa selected activity range. Ibig sabihin, nagbabago ang lists, analytics, exports, gallery counts, at category summaries ayon sa daily, weekly, monthly, o all-time view.",
            },
            {
              heading: "Local at Synced Experience",
              body: "Maaaring gumamit ang EyeGasto ng locally saved preferences kasama ng account-based records para familiar pa rin ang dashboard habang ipinapakita ang synced expense at planner data.",
            },
            {
              heading: "Support Contact",
              body: "Kapag pinili mong makipag-contact sa support gamit ang device o browser mail flow, nangyayari iyon sa labas ng main dashboard. Ikaw ang nagtatakda ng laman ng message na ipapadala mo.",
            },
          ],
        },
        faq: {
          title: "Mga Madalas Itanong",
          items: [
            {
              question: "Pwede ko bang gamitin ang EyeGasto sa web at mobile?",
              answer:
                "Oo. Nagsi-sync ang account data sa web at mobile kapag nag-sign in ka gamit ang parehong credentials.",
            },
            {
              question: "Naka-back up ba ang receipt images ko?",
              answer:
                "Ang receipt images na naka-attach sa expenses ay naka-store sa account mo para makita sa supported devices at receipt gallery. Suriin pa rin ang ina-upload mo bago ito itago sa records.",
            },
            {
              question: "Pwede ko bang i-export ang data ko?",
              answer:
                "Oo. May CSV, PDF, at summary export options ang dashboard. Nakabase ang export content sa kasalukuyang activity range at maaaring may totals, categories, notes, at receipt status.",
            },
            {
              question: "Paano gumagana ang recurring expenses?",
              answer:
                "Ang monthly recurring plans ay awtomatikong gumagawa ng upcoming expense entries kapag due na ang mga ito.",
            },
            {
              question: "Paano gumagana ang budget planner?",
              answer:
                "Sa Budget tab, pwede kang mag-save ng category budgets, mag-review ng progress laban sa current expenses, at mamahala ng debt reminders.",
            },
            {
              question: "Bakit nagbabago ang Stats tab kapag palit ang activity range?",
              answer:
                "Nakakaapekto ang selected activity range sa dashboard lists, analytics, gallery review, at export results, kaya nagbabago ang totals at trends ayon sa date window.",
            },
            {
              question: "Pwede ko bang i-edit ang expense pagkatapos i-save?",
              answer:
                "Oo. Pwede mong buksan at i-edit ang saved expenses para baguhin ang description, amount, category, notes, at receipt image details.",
            },
            {
              question: "Ano ang mangyayari kung walang saved expenses ang category?",
              answer:
                "Maaaring magpakita ng empty states o zero usage ang category breakdown, gallery filters, at budget progress hanggang may matching expenses sa category na iyon.",
            },
            {
              question: "Paano ako makaka-contact sa support?",
              answer:
                "Gamitin ang Help at Support area sa Profile tab para buksan ang support contact action. Sa web, susubukan nitong buksan ang mail flow o Gmail compose.",
            },
            {
              question: "Expenses na may receipts lang ba ang nasa gallery?",
              answer:
                "Oo. Nakatuon ang Gallery tab sa expenses na may saved receipt images. Kung walang receipt image ang expense, makikita pa rin ito sa lists at analytics pero hindi sa gallery view.",
            },
            {
              question: "Bakit mababa o walang progress ang budget category?",
              answer:
                "Nakadepende ang budget progress sa saved expenses na kapareho ng category. Kung walang matching expense sa active period, mababa o walang laman ang progress line.",
            },
            {
              question: "Ano ang laman ng exports?",
              answer:
                "Maaaring isama ng exports ang summary totals, date-based expense rows, category values, notes, at receipt status depende sa selected format at activity range.",
            },
            {
              question: "Pwede ko bang gamitin ang EyeGasto kahit walang receipts?",
              answer:
                "Oo. Optional ang receipts sa expense entry. Makakapag-save ka pa rin ng expenses, review totals, track categories, at manage budgets kahit walang image proof.",
            },
            {
              question: "Ano ang makikita sa Stats tab?",
              answer:
                "Pinagsasama ng Stats tab ang spending momentum, category breakdown, month-over-month change, current-week pace, average expense, at receipt coverage.",
            },
          ],
        },
        about: {
          title: "Tungkol sa EyeGasto",
          sections: [
            {
              heading: "Ano ang EyeGasto",
              body: "Ang EyeGasto ay modern expense tracker para sa mabilis na entry, malinaw na analytics, exportable reports, budget support, at visual proof gamit ang receipt uploads.",
            },
            {
              heading: "Saan Ito Nakakatulong",
              body: "Ginawa ang app para sa daily monitoring, category trends, recurring planning, receipt review, budget monitoring, debt reminders, at mabilis na review ng spending activity.",
            },
            {
              heading: "Focus ng Experience",
              body: "Nakatuon ang experience sa streamlined dashboard, mobile-friendly flow, responsive web support, at consistent na itsura sa app at web.",
            },
            {
              heading: "Main Dashboard Areas",
              body: "Nakaayos ang EyeGasto sa Overview, Budget, Stats, Gallery, at Profile para mabilis lumipat mula daily entry papunta sa planning, review, at support.",
            },
            {
              heading: "Bakit Mahalaga ang Receipts",
              body: "Tinutulungan ng receipt support na ikonekta ang bawat saved expense sa visual proof para mas useful ang gallery review at export checks.",
            },
            {
              heading: "Practical Goal",
              body: "Layunin ng EyeGasto na gawing mabilis ang expense tracking para sa araw-araw habang nagbibigay pa rin ng structure para sa summaries, budget checks, at personal review.",
            },
            {
              heading: "Pakiramdam ng Workflow",
              body: "Karaniwang nagsisimula ang flow sa pagdagdag ng expenses, optional receipt proof, at pag-review sa Overview, Budget, Stats, Gallery, at export options kapag kailangan ng report.",
            },
            {
              heading: "Bakit Hiwalay ang Dashboard Tabs",
              body: "May malinaw na trabaho ang bawat tab: Overview para quick review, Budget para planning, Stats para trends, Gallery para visual proof, at Profile para account settings at support.",
            },
            {
              heading: "Useful sa Araw-araw",
              body: "Binabawasan ng EyeGasto ang friction sa expense tracking sa pamamagitan ng quick input, saved preferences, recurring entries, progress indicators, export options, at proof-based review.",
            },
            {
              heading: "Current Product Direction",
              body: "Nakatuon ang direction sa visually clear dashboard, practical spending review, category-focused insights, at support para sa mobile at web users.",
            },
          ],
        },
      };
    }

    return {
      terms: {
        title: "Terms of Use",
        sections: [
          {
            heading: "Using EyeGasto",
            body: "EyeGasto is designed for personal expense tracking, receipt storage, analytics, budgeting support, and export review. You should use the app only for lawful, accurate, and personally relevant financial records.",
          },
          {
            heading: "Your Responsibility",
            body: "You are responsible for keeping your login credentials secure, reviewing the accuracy of the expenses you save, and protecting access on shared devices by logging out when needed. You are also responsible for checking exported files before sharing them with other people.",
          },
          {
            heading: "Uploads and Records",
            body: "Receipt images, notes, debt reminders, recurring plans, and exported reports should only contain information you are comfortable storing, reviewing, and sharing from your account.",
          },
          {
            heading: "Account and Access",
            body: "Some EyeGasto features rely on your signed-in account so your expenses, receipt references, planner entries, and preferences can appear across supported devices. If your session ends, some account-based actions may require you to sign in again.",
          },
          {
            heading: "Feature Availability",
            body: "Dashboard experiences such as analytics, gallery review, export, budget tracking, and debt reminders depend on the data you save. Some features may appear limited or empty when there are no expenses, no receipts, or no planner records yet.",
          },
          {
            heading: "Reasonable Use",
            body: "You should avoid uploading harmful, irrelevant, or misleading content. EyeGasto is meant to help you organize spending information, not to store unrelated files or impersonate financial documents.",
          },
          {
            heading: "Budgets, Reminders, and Decisions",
            body: "Budget planner summaries, debt reminders, category progress, and analytics are provided to help you review your own records. They are informational tools and should not be treated as financial, legal, or accounting advice.",
          },
          {
            heading: "Exports and Printed Reports",
            body: "When you export CSV, PDF, or summary files, you are responsible for how those files are downloaded, shared, stored, or printed. Once exported outside the app, they may no longer be protected by the same in-app experience.",
          },
          {
            heading: "Data Accuracy",
            body: "Analytics, category breakdowns, budget progress, and receipt gallery results depend on the information you save. Incorrect dates, categories, amounts, or missing receipts may change the summaries shown in the dashboard.",
          },
        ],
      },
      privacy: {
        title: "Privacy Policy",
        sections: [
          {
            heading: "What We Store",
            body: "EyeGasto stores your profile details, expense records, category selections, recurring plans, budget planner entries, debt reminders, and receipt files so your data can sync across supported devices.",
          },
          {
            heading: "How It Is Used",
            body: "Stored data is used to power dashboard analytics, category breakdowns, receipt previews, planner summaries, export files, recurring expense generation, and your saved dashboard preferences within your own account experience.",
          },
          {
            heading: "Sharing and Exports",
            body: "Exports and shared files are initiated by you. Review their contents carefully before sending, downloading, printing, or storing them outside the app, because they may include dates, categories, notes, totals, and receipt-related information.",
          },
          {
            heading: "Receipts and Images",
            body: "Receipt images attached to expenses are associated with your account so they can appear in the receipt gallery and related expense views. You should avoid uploading images that include sensitive information you do not want stored with your records.",
          },
          {
            heading: "Preferences and Personalization",
            body: "EyeGasto saves preferences such as theme, language, date range, currency, and selected sections so the dashboard can reopen with the experience you last used.",
          },
          {
            heading: "Your Control",
            body: "You can edit or delete expenses, planner items, and some personal details from within the app experience. Export actions, support contact actions, and receipt uploads remain under your control at the moment you trigger them.",
          },
          {
            heading: "Range-Based Views",
            body: "Some dashboard surfaces depend on the selected activity range. That means lists, analytics, exports, gallery counts, and category summaries may change depending on whether you are viewing daily, weekly, monthly, or all-time data.",
          },
          {
            heading: "Local and Synced Experience",
            body: "EyeGasto may use locally saved preferences together with account-based records so your dashboard can reopen with familiar settings while still reflecting synced expense and planner data where supported.",
          },
          {
            heading: "Support Contact",
            body: "If you choose to contact support through your device or browser mail flow, that action is initiated outside the main dashboard experience. The contents of the message you send are determined by you at the time you send it.",
          },
        ],
      },
      faq: {
        title: "Frequently Asked Questions",
        items: [
          {
            question: "Can I use EyeGasto on web and mobile?",
            answer:
              "Yes. Your account data syncs across web and mobile when you sign in with the same credentials.",
          },
          {
            question: "Are my receipt images backed up?",
            answer:
              "Receipt images attached to expenses are stored with your account so they can appear across supported devices and in the receipt gallery. You should still review what you upload before keeping it in your records.",
          },
          {
            question: "Can I export my data?",
            answer:
              "Yes. The dashboard includes CSV, PDF, and summary export options for your expense records. Export content is based on the currently selected activity range and may include totals, categories, notes, and receipt status.",
          },
          {
            question: "How do recurring expenses work?",
            answer:
              "Monthly recurring plans automatically create upcoming expense entries when they become due.",
          },
          {
            question: "How does the budget planner work?",
            answer:
              "The Budget tab lets you save category budgets, review progress against current expenses, and manage debt reminders. Budget usage updates from the expenses you save under matching categories.",
          },
          {
            question: "Why does the stats tab change when I switch activity range?",
            answer:
              "The selected activity range affects dashboard lists, analytics, gallery review, and export results. That means the totals, category breakdown, and momentum cards update to match the date window you selected.",
          },
          {
            question: "Can I edit an expense after saving it?",
            answer:
              "Yes. Saved expenses can be opened for editing so you can update description, amount, category, notes, and receipt image details when needed.",
          },
          {
            question: "What happens if a category has no saved expenses yet?",
            answer:
              "Sections such as category breakdown, gallery category filters, and budget progress may show empty states or zero usage until matching expenses are saved under that category.",
          },
          {
            question: "How can I contact support?",
            answer:
              "Use the Help and Support area in the Profile tab to open the support contact action. On web it will try your mail flow or Gmail compose, depending on what is available in your browser.",
          },
          {
            question: "Does the gallery only show expenses with receipts?",
            answer:
              "Yes. The Gallery tab is focused on expenses that include saved receipt images. If an expense has no receipt image attached, it can still appear in your lists and analytics but not in the gallery view.",
          },
          {
            question: "Why does a budget category show little or no progress?",
            answer:
              "Budget progress depends on saved expenses that match the same category. If the category has no matching expenses in the active time period, the progress line may stay low or empty even though the category budget itself is already saved.",
          },
          {
            question: "What do the exports include?",
            answer:
              "Exports can include summary totals, date-based expense rows, category values, notes, and receipt status depending on the selected format. The selected activity range also affects what is included in the report.",
          },
          {
            question: "Can I use EyeGasto without receipts?",
            answer:
              "Yes. Receipts are optional for expense entry. You can still save expenses, review totals, track categories, and manage budgets even if some records do not include image proof.",
          },
          {
            question: "What is shown in the Stats tab?",
            answer:
              "The Stats tab combines spending momentum, category breakdown, month-over-month change, current-week pace, average expense, and receipt coverage so you can review trends from the currently selected activity range.",
          },
        ],
      },
      about: {
        title: "About EyeGasto",
        sections: [
          {
            heading: "What EyeGasto Is",
            body: "EyeGasto is a modern expense tracker focused on fast entry, clean analytics, exportable reports, budgeting support, and visual proof through receipt uploads.",
          },
          {
            heading: "What It Helps With",
            body: "The app is built for daily monitoring, category trends, recurring planning, receipt review, budget monitoring, debt reminders, and quick review of recent spending activity.",
          },
          {
            heading: "Experience Focus",
            body: "The current experience emphasizes a streamlined dashboard, mobile-friendly flow, responsive web support, and a consistent look across app and web.",
          },
          {
            heading: "Main Dashboard Areas",
            body: "EyeGasto is organized around Overview, Budget, Stats, Gallery, and Profile so users can move quickly from daily entry to planning, review, and support.",
          },
          {
            heading: "Why Receipts Matter",
            body: "Receipt support helps connect each saved expense with visual proof, making gallery review and export checks more useful when users want to confirm what was recorded.",
          },
          {
            heading: "Practical Goal",
            body: "The goal of EyeGasto is to make expense tracking feel fast enough for everyday use while still giving users enough structure for summaries, budget checks, and personal review.",
          },
          {
            heading: "How the Workflow Feels",
            body: "A typical EyeGasto flow starts with adding expenses, optionally attaching receipt proof, then reviewing the results through Overview, Budget, Stats, Gallery, and export options when you need a report outside the app.",
          },
          {
            heading: "Why the Dashboard Is Split Into Tabs",
            body: "Each main tab has a distinct purpose: Overview for quick review, Budget for planning, Stats for trends, Gallery for visual proof, and Profile for account settings, support, and policies. This helps reduce clutter while keeping each task easy to find.",
          },
          {
            heading: "What Makes It Useful Day to Day",
            body: "EyeGasto is meant to reduce friction in expense tracking by combining quick input, saved preferences, recurring entries, progress indicators, export options, and proof-based review in one dashboard experience.",
          },
          {
            heading: "Current Product Direction",
            body: "The current direction emphasizes a visually clear dashboard, practical spending review, category-focused insights, and support for both mobile and web users who want one place to store and review their records.",
          },
        ],
      },
    };
  }, [renderLanguage]);

  const openMailAction = async (subject: string) => {
    const mailtoUrl = `mailto:carl46436@gmail.com?subject=${encodeURIComponent(subject)}`;

    if (Platform.OS === "web") {
      const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=carl46436@gmail.com&su=${encodeURIComponent(
        subject,
      )}`;

      try {
        window.location.href = mailtoUrl;
        window.setTimeout(() => {
          if (document.visibilityState === "visible") {
            window.open(gmailWebUrl, "_blank", "noopener,noreferrer");
          }
        }, 500);
      } catch {
        window.open(gmailWebUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const canOpen = await Linking.canOpenURL(mailtoUrl);

    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return;
    }

    const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=carl46436@gmail.com&su=${encodeURIComponent(
      subject,
    )}`;
    const canOpenGmailWeb = await Linking.canOpenURL(gmailWebUrl);
    if (canOpenGmailWeb) {
      await Linking.openURL(gmailWebUrl);
      return;
    }

    Alert.alert(
      "Email unavailable",
      "Please email carl46436@gmail.com from your preferred mail app.",
    );
  };

  const handleContactSupport = async () => {
    try {
      await openMailAction("EyeGasto Support Request");
    } catch (error) {
      console.error("Failed to open support email", error);
      Alert.alert(
        "Support unavailable",
        "Please email carl46436@gmail.com for help.",
      );
    }
  };

  useEffect(() => {
    setExpandedFaqIndex(null);
    setExpandedInfoSectionKey(null);
  }, [infoSheet]);

  const recentExpensesPanel = (
    <View
      style={[
        styles.panel,
        shouldStackOverviewLayout
          ? styles.overviewStackPanel
          : styles.recentPanel,
        shouldStackOverviewLayout &&
          recentExpensesPanelMinHeight != null && {
            minHeight: recentExpensesPanelMinHeight,
          },
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View
        style={[
          styles.panelHeader,
          shouldStackRecentHeader && styles.panelHeaderStack,
        ]}
      >
        <View style={styles.panelHeaderCopy}>
          <Text style={[styles.sectionTitleLarge, { color: theme.title }]}>
            {languageCopy.recentExpenses}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
            {languageCopy.recentExpensesSubtitle}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.clearButton,
            styles.clearButtonAligned,
            themeMode === "light" && styles.clearButtonLight,
          ]}
          onPress={confirmClearAll}
        >
          <Text
            style={[
              styles.clearButtonText,
              themeMode === "light" && styles.clearButtonTextLight,
            ]}
          >
            {languageCopy.clearAll}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.mutedSurface,
            borderColor: theme.cardBorder,
            color: theme.title,
          },
        ]}
        placeholder={
          languageCopy.searchExpensesPlaceholder
        }
        placeholderTextColor={theme.faint}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              styles.categoryChipFixed,
              {
                backgroundColor: theme.mutedSurface,
                borderColor: theme.cardBorder,
              },
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() =>
              setSelectedCategory(category as typeof selectedCategory)
            }
          >
            <Text
              style={[
                styles.categoryChipText,
                { color: theme.faint },
                selectedCategory === category && styles.categoryChipTextActive,
                themeMode === "light" &&
                  selectedCategory === category &&
                  styles.categoryChipTextActiveLight,
              ]}
            >
              {getCategoryDisplayLabel(category)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isExpensesLoading ? (
        renderRecentSkeletons()
      ) : (
        <ExpenseList
          expenses={displayedExpenses}
          onDelete={confirmDeleteExpense}
          onEdit={startEditingExpense}
          mode={themeMode}
          currencyCode={preferredCurrency}
          language={renderLanguage}
          emptyTitle={languageCopy.noExpensesYet}
          emptySubtitle={languageCopy.noExpensesYetSubtitle}
        />
      )}

      {visibleExpenses.length > 5 && !searchQuery.trim() ? (
        <TouchableOpacity
          style={styles.showAllButton}
          onPress={() => setShowAllExpenses((value) => !value)}
        >
          <Text style={[styles.showAllButtonText, { color: theme.accent }]}>
            {showAllExpenses
              ? languageCopy.showLess
              : formatCopy("viewAllExpenses", {
                  count: visibleExpenses.length,
                })}
          </Text>
          <Ionicons
            name={showAllExpenses ? "chevron-up" : "chevron-down"}
            size={16}
            color="#7DD3FC"
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const insightsPanel = (
    <View
      style={[
        styles.panel,
        shouldStackOverviewLayout
          ? styles.overviewStackPanel
          : styles.signalPanel,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.title }]}>
        {languageCopy.insights}
      </Text>
      <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
        {languageCopy.insightsSubtitle}
      </Text>

      {isExpensesLoading ? (
        <>
          {Array.from({ length: 3 }).map((_, index) => (
            <View
              key={`insight-skeleton-${index}`}
              style={[
                styles.signalCard,
                {
                  backgroundColor: theme.mutedSurface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              {renderSkeletonCard(12, "34%")}
              {renderSkeletonCard(22, "62%")}
              {renderSkeletonCard(12, "46%")}
            </View>
          ))}
        </>
      ) : (
        <>
          <View
            style={[
              styles.signalCard,
              {
                backgroundColor: theme.mutedSurface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.signalLabel, { color: theme.faint }]}>
              {languageCopy.topCategory}
            </Text>
          <Text style={[styles.signalValue, { color: theme.title }]}>
            {topCategory
                ? getCategoryDisplayLabel(topCategory.label)
                : languageCopy.noDataYet}
          </Text>
            <Text style={[styles.signalMeta, { color: theme.muted }]}>
              {topCategory
                ? formatAmount(topCategory.total)
                : languageCopy.addExpenses}
            </Text>
          </View>

          <View
            style={[
              styles.signalCard,
              {
                backgroundColor: theme.mutedSurface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.signalLabel, { color: theme.faint }]}>
              {languageCopy.receiptsSaved}
            </Text>
            <Text style={[styles.signalValue, { color: theme.title }]}>
              {rangeFilteredExpenses.filter((expense) => expense.imageUrl).length}
            </Text>
            <Text style={[styles.signalMeta, { color: theme.muted }]}>
              {formatCopy("entriesWithPhotoProof", {
                range: dateRangeLabel.toLowerCase(),
              })}
            </Text>
          </View>

          <View
            style={[
              styles.signalCard,
              {
                backgroundColor: theme.mutedSurface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.signalLabel, { color: theme.faint }]}>
              {languageCopy.memberSince}
            </Text>
            <Text style={[styles.signalValue, { color: theme.title }]}>
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : languageCopy.dateToday}
            </Text>
            <Text style={[styles.signalMeta, { color: theme.muted }]}>
              {user.email}
            </Text>
          </View>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.safeBackground }]}
    >
      <StatusBar
        barStyle={themeMode === "dark" ? "light-content" : "dark-content"}
      />

      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <View
        style={[
          styles.header,
          isCompact && styles.headerCompact,
          { paddingTop: headerTopPadding },
        ]}
      >
        <View
          style={[styles.headerLeft, isVeryCompact && styles.headerLeftCompact]}
        >
          <View style={styles.headerBrandBadge}>
            <View style={styles.headerBrandBadgeFill}>
              <Image
                source={require("../../assets/images/app2.png")}
                style={styles.headerBrandLogo}
                contentFit="contain"
              />
            </View>
          </View>
          <View
            style={[
              styles.headerBrandCopy,
              isCompact && styles.headerBrandCopyCompact,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.headerTitle,
                isCompact && styles.headerTitleCompact,
                { color: theme.title },
              ]}
            >
              EyeGasto
            </Text>
            <Text
              numberOfLines={2}
              style={[
                styles.headerSubtitle,
                isCompact && styles.headerSubtitleCompact,
                { color: theme.faint },
              ]}
            >
              Smart expense tracking with saved receipt evidence.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.headerActions,
            isCompact &&
              (useNativeHeaderProfile
                ? styles.headerActionsNativeCompact
                : styles.headerActionsCompact),
          ]}
        >
          {useNativeHeaderProfile ? (
            <View
              style={[
                styles.headerActionTopRow,
                isCompact && styles.headerActionTopRowCompact,
              ]}
            >
              <View
                style={[
                  styles.headerClockCard,
                  isCompact && styles.headerClockCardNativeCompact,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.headerClockTime, { color: theme.title }]}>
                  {currentTimeLabel}
                </Text>
                <Text style={[styles.headerClockDate, { color: theme.faint }]}>
                  {currentDateLabel}
                </Text>
              </View>

              <TouchableOpacity
                accessibilityLabel={languageCopy.navProfile}
                accessibilityRole="button"
                style={[
                  styles.headerProfileButton,
                  isCompact && styles.headerProfileButtonNativeCompact,
                  {
                    backgroundColor:
                      activeTab === "profile"
                        ? "rgba(125, 211, 252, 0.18)"
                        : theme.cardBackground,
                    borderColor:
                      activeTab === "profile" ? theme.accent : theme.cardBorder,
                  },
                ]}
                onPress={() => setActiveTab("profile")}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={
                    activeTab === "profile"
                      ? "person-circle"
                      : "person-circle-outline"
                  }
                  size={isCompact ? 30 : 24}
                  color={theme.accent}
                />
                {!isCompact ? (
                  <Text
                    style={[
                      styles.headerProfileButtonText,
                      { color: theme.title },
                    ]}
                  >
                    {languageCopy.navProfile}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.headerClockCard,
                isCompact && styles.headerClockCardCompact,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.headerClockTime, { color: theme.title }]}>
                {currentTimeLabel}
              </Text>
              <Text style={[styles.headerClockDate, { color: theme.faint }]}>
                {currentDateLabel}
              </Text>
            </View>
          )}

          {useNativeHeaderProfile ? (
            showNativeSyncToast ? (
              <Animated.View
                style={[
                  styles.syncStatusPill,
                  styles.syncStatusToast,
                  isCompact && styles.syncStatusPillNativeCompact,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: syncToneColor,
                    opacity: syncToastAnim,
                    transform: [
                      {
                        translateY: syncToastAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name={syncStatusCopy.icon}
                  size={17}
                  color={syncToneColor}
                />
                <View style={styles.syncStatusTextWrap}>
                  <Text
                    style={[styles.syncStatusTitle, { color: theme.title }]}
                    numberOfLines={1}
                  >
                    {syncStatusCopy.title}
                  </Text>
                  <Text
                    style={[styles.syncStatusSubtitle, { color: theme.faint }]}
                    numberOfLines={1}
                  >
                    {syncStatusCopy.subtitle}
                  </Text>
                </View>
              </Animated.View>
            ) : null
          ) : (
            <View
              style={[
                styles.syncStatusPill,
                isCompact && styles.syncStatusPillCompact,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: syncToneColor,
                },
              ]}
            >
              <Ionicons
                name={syncStatusCopy.icon}
                size={17}
                color={syncToneColor}
              />
              <View style={styles.syncStatusTextWrap}>
                <Text
                  style={[styles.syncStatusTitle, { color: theme.title }]}
                  numberOfLines={1}
                >
                  {syncStatusCopy.title}
                </Text>
                <Text
                  style={[styles.syncStatusSubtitle, { color: theme.faint }]}
                  numberOfLines={1}
                >
                  {syncStatusCopy.subtitle}
                </Text>
              </View>
            </View>
          )}

          {useSidebarNavigation ? (
            <TouchableOpacity
              style={styles.headerAddButton}
              onPress={() => {
                setQuickAddDraft(null);
                setShowAddForm(true);
              }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={["#67E8F9", "#38BDF8", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerAddButtonFill}
              >
                <Ionicons name="add" size={16} color="#082F49" />
                <Text style={styles.headerAddButtonText}>Add expense</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          {!useNativeHeaderProfile ? (
            <TouchableOpacity
              accessibilityLabel={languageCopy.navProfile}
              accessibilityRole="button"
              style={[
                styles.headerProfileButton,
                isCompact && styles.headerProfileButtonCompact,
                {
                  backgroundColor:
                    activeTab === "profile"
                      ? "rgba(125, 211, 252, 0.18)"
                      : theme.cardBackground,
                  borderColor:
                    activeTab === "profile" ? theme.accent : theme.cardBorder,
                },
              ]}
              onPress={() => setActiveTab("profile")}
              activeOpacity={0.9}
            >
              <Ionicons
                name={
                  activeTab === "profile"
                    ? "person-circle"
                    : "person-circle-outline"
                }
                size={22}
                color={theme.accent}
              />
              <Text style={[styles.headerProfileButtonText, { color: theme.title }]}>
                {languageCopy.navProfile}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.dashboardShell,
          useSidebarNavigation && styles.dashboardShellWeb,
        ]}
      >
        {useSidebarNavigation ? (
          <BlurView
            intensity={28}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.sideNav,
              {
                borderColor: theme.cardBorder,
                backgroundColor: theme.cardBackground,
              },
            ]}
          >
            <View style={styles.sideNavIntro}>
              <Text style={[styles.sideNavTitle, { color: theme.title }]}>
                {languageCopy.dashboardNavigationTitle}
              </Text>
              <Text style={[styles.sideNavSubtitle, { color: theme.faint }]}>
                {languageCopy.dashboardNavigationSubtitle}
              </Text>
            </View>

            <View style={styles.sideNavItems}>
              {dashboardNavItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.sideNavItem,
                      {
                        backgroundColor: active
                          ? "rgba(34, 211, 238, 0.12)"
                          : "transparent",
                        borderColor: active
                          ? "rgba(34, 211, 238, 0.22)"
                          : "transparent",
                      },
                    ]}
                    onPress={() => setActiveTab(item.key)}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? theme.accent : theme.faint}
                    />
                    <Text
                      style={[
                        styles.sideNavLabel,
                        { color: active ? theme.title : theme.faint },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        ) : null}

        <ScrollView
          ref={dashboardScrollRef}
          style={[styles.scroll, useSidebarNavigation && styles.scrollWeb]}
          contentContainerStyle={[
            styles.scrollContent,
            !useSidebarNavigation && isCompact && styles.scrollContentCompact,
            activeTab === "profile" && styles.scrollContentProfile,
            activeTab === "profile" &&
              !useSidebarNavigation &&
              isCompact &&
              styles.scrollContentProfileCompact,
            useSidebarNavigation && styles.scrollContentWeb,
            { paddingBottom: contentBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: Animated.multiply(fadeAnim, contentAnim),
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
                {
                  scale: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.985, 1],
                  }),
                },
              ],
            }}
          >
            {activeTab === "overview" ? (
              <>
                <LinearGradient
                  colors={theme.hero}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.heroCard,
                    {
                      borderColor: theme.cardBorder,
                      backgroundColor: theme.cardBackground,
                    },
                  ]}
                >
                  <Text style={[styles.heroEyebrow, { color: theme.accent }]}>
                    {languageCopy.heroEyebrow}
                  </Text>
                  <Text style={[styles.heroTitle, { color: theme.title }]}>
                    {languageCopy.heroTitle}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: theme.muted }]}>
                    {languageCopy.heroSubtitle}
                  </Text>
                </LinearGradient>

                <View
                  style={[
                    styles.panel,
                    styles.addPanel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.panelHeader,
                      isCompact && styles.panelHeaderStack,
                    ]}
                  >
                    <View>
                      <Text
                        style={[styles.sectionTitle, { color: theme.title }]}
                      >
                        {languageCopy.quickAddTitle}
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        {languageCopy.quickAddSubtitle}
                      </Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickAddRow}
                  >
                    {QUICK_ADDS.map((item) => (
                      <TouchableOpacity
                        key={`${item.label}-${item.amount}`}
                        style={[
                          styles.quickAddChip,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        onPress={() =>
                          handleQuickAdd(
                            getLocalizedCategoryName(item.label, renderLanguage),
                            item.amount,
                            item.category,
                          )
                        }
                      >
                        <View style={styles.quickAddChipTop}>
                          <View
                            style={[
                              styles.quickAddChipIcon,
                              {
                                backgroundColor:
                                  themeMode === "light"
                                    ? "rgba(2, 132, 199, 0.1)"
                                    : "rgba(34, 211, 238, 0.12)",
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                QUICK_ADD_ICONS[item.label] ??
                                "add-circle-outline"
                              }
                              size={16}
                              color={theme.accent}
                            />
                          </View>
                          <Ionicons
                            name="arrow-forward"
                            size={14}
                            color={theme.faint}
                          />
                        </View>
                        <Text
                          style={[
                            styles.quickAddChipLabel,
                            { color: theme.title },
                          ]}
                        >
                          {getLocalizedCategoryName(item.label, renderLanguage)}
                        </Text>
                        <Text
                          style={[
                            styles.quickAddChipMeta,
                            { color: theme.faint },
                          ]}
                        >
                          {getCategoryDisplayLabel(item.category)}
                        </Text>
                        <Text
                          style={[
                            styles.quickAddChipAmount,
                            { color: theme.title },
                          ]}
                        >
                          {formatAmount(item.amount)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {(user.recurringExpenses?.length ?? 0) > 0 ? (
                  <View style={styles.recurringPlansWrap}>
                    <View style={styles.panelHeader}>
                      <View>
                        <Text
                          style={[styles.sectionTitle, { color: theme.title }]}
                        >
                          {languageCopy.monthlyPlansTitle}
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: theme.faint },
                          ]}
                        >
                          {languageCopy.monthlyPlansSubtitle}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.recurringPlansList}>
                      {(user.recurringExpenses ?? [])
                        .filter((item) => item.isActive !== false)
                        .map((item) => (
                          <View
                            key={item.id}
                            style={[
                              styles.recurringPlanCard,
                              {
                                backgroundColor: theme.mutedSurface,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                          >
                            <View style={styles.recurringPlanCopy}>
                              <Text
                                style={[
                                  styles.recurringPlanTitle,
                                  { color: theme.title },
                                ]}
                              >
                                {item.description}
                              </Text>
                              <Text
                                style={[
                                  styles.recurringPlanMeta,
                                  { color: theme.muted },
                                ]}
                              >
                                {formatAmount(item.amount)} - every month on day{" "}
                                {item.dayOfMonth}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.recurringPlanRemove}
                              onPress={() =>
                                handleRemoveRecurringExpense(item.id)
                              }
                            >
                              <Ionicons
                                name="close"
                                size={16}
                                color="#FCA5A5"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.filterShell,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.sectionTitle, { color: theme.title }]}>
                      {languageCopy.activityRangeTitle}
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      {languageCopy.activityRangeSubtitle}{" "}
                      {dateRangeLabel.toLowerCase()}.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.filterRangeButton,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setShowDateRangePicker(true)}
                  >
                    <View style={styles.filterRangeButtonCopy}>
                      <Text
                        style={[styles.filterRangeButtonTitle, { color: theme.title }]}
                      >
                        {dateRangeLabel}
                      </Text>
                      <Text
                        style={[styles.filterRangeButtonSubtitle, { color: theme.faint }]}
                      >
                        {languageCopy.activityRangeSubtitle}
                      </Text>
                    </View>
                    <View style={styles.selectFieldIcon}>
                      <Ionicons name="chevron-down" size={18} color={theme.accent} />
                    </View>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.panelHeader,
                      isCompact && styles.panelHeaderStack,
                    ]}
                  >
                    <View>
                      <Text
                        style={[styles.sectionTitle, { color: theme.title }]}
                      >
                        {languageCopy.navOverview}
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        {formatCopy("overviewActivity", {
                          range: dateRangeLabel.toLowerCase(),
                        })}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statsGrid,
                      isCompact && styles.statsGridCompact,
                    ]}
                  >
                    {isExpensesLoading || !isPreferencesReady ? (
                      <>
                        {Array.from({ length: 3 }).map((_, index) => (
                          <View
                            key={`stats-skeleton-${index}`}
                            style={[
                              styles.statsSkeletonCard,
                              {
                                backgroundColor: theme.mutedSurface,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                          >
                            {renderSkeletonCard(12, "42%")}
                            {renderSkeletonCard(36, "78%")}
                            {renderSkeletonCard(12, "58%")}
                          </View>
                        ))}
                      </>
                    ) : (
                      <>
                        <StatsCard
                           title={languageCopy.dateLastMonth}
                          amount={stats.lastMonth}
                          type="expense"
                          period="month"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                        <StatsCard
                           title={languageCopy.dateThisMonth}
                          amount={stats.thisMonth}
                          type="expense"
                          period="month"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                        <StatsCard
                           title={
                             languageCopy.totalExpenses
                           }
                          amount={stats.total}
                          type="expense"
                          period="total"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                      </>
                    )}
                  </View>

                </View>

                {renderBudgetPanel(
                  languageCopy.budgetSnapshot,
                  `${languageCopy.quickBudgetStatusPrefix} ${dateRangeLabel.toLowerCase()}.`,
                  false,
                  true,
                )}

                {shouldStackOverviewLayout ? (
                  <View style={styles.overviewStackWrapper}>
                    {recentExpensesPanel}
                    {insightsPanel}
                  </View>
                ) : (
                  <View style={styles.workspaceRow}>
                    {recentExpensesPanel}
                    {insightsPanel}
                    {false && (
                      <>
                  <View
                    style={[
                      styles.panel,
                      styles.recentPanel,
                      shouldStackOverviewLayout && styles.overviewPanelCompact,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.panelHeader,
                        shouldStackRecentHeader && styles.panelHeaderStack,
                      ]}
                    >
                      <View style={styles.panelHeaderCopy}>
                        <Text
                          style={[
                            styles.sectionTitleLarge,
                            { color: theme.title },
                          ]}
                        >
                          {languageCopy.recentExpenses}
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: theme.faint },
                          ]}
                        >
                          {renderLanguage === "Filipino"
                              ? "Hanapin at suriin ang iyong mga pinakabagong entry."
                              : "Search and review your latest entries."}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.clearButton,
                          styles.clearButtonAligned,
                          themeMode === "light" && styles.clearButtonLight,
                        ]}
                        onPress={confirmClearAll}
                      >
                        <Text
                          style={[
                            styles.clearButtonText,
                            themeMode === "light" &&
                              styles.clearButtonTextLight,
                          ]}
                        >
                          {renderLanguage === "Filipino"
                              ? "Burahin"
                              : "Clear all"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                          color: theme.title,
                        },
                      ]}
                      placeholder={
                        renderLanguage === "Filipino"
                            ? "Maghanap ng gastos, category, o notes"
                            : "Search expenses, categories, or notes"
                      }
                      placeholderTextColor={theme.faint}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryRow}
                    >
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category}
                          style={[
                            styles.categoryChip,
                            styles.categoryChipFixed,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            selectedCategory === category &&
                              styles.categoryChipActive,
                          ]}
                          onPress={() =>
                            setSelectedCategory(
                              category as typeof selectedCategory,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              { color: theme.faint },
                              selectedCategory === category &&
                                styles.categoryChipTextActive,
                              themeMode === "light" &&
                                selectedCategory === category &&
                                styles.categoryChipTextActiveLight,
                            ]}
                          >
                            {category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {isExpensesLoading ? (
                      renderRecentSkeletons()
                    ) : (
                        <ExpenseList
                          expenses={displayedExpenses}
                          onDelete={confirmDeleteExpense}
                          onEdit={startEditingExpense}
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                          language={renderLanguage}
                          emptyTitle={languageCopy.noExpensesYet}
                          emptySubtitle={languageCopy.noExpensesYetSubtitle}
                        />
                    )}

                    {visibleExpenses.length > 5 && !searchQuery.trim() ? (
                      <TouchableOpacity
                        style={styles.showAllButton}
                        onPress={() => setShowAllExpenses((value) => !value)}
                      >
                        <Text
                          style={[
                            styles.showAllButtonText,
                            { color: theme.accent },
                          ]}
                        >
                          {showAllExpenses
                            ? renderLanguage === "Filipino"
                                ? "Ipakita nang mas kaunti"
                                : "Show less"
                            : renderLanguage === "Filipino"
                                ? `Tingnan lahat ng ${visibleExpenses.length} gastos`
                                : `View all ${visibleExpenses.length} expenses`}
                        </Text>
                        <Ionicons
                          name={showAllExpenses ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#7DD3FC"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.panel,
                      styles.signalPanel,
                      shouldStackOverviewLayout && styles.overviewPanelCompact,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.title }]}>
                      {renderLanguage === "Filipino"
                          ? "Insights"
                          : "Insights"}
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      {renderLanguage === "Filipino"
                          ? "Mabilis na konteksto mula sa iyong kasalukuyang expense activity."
                          : "Quick context from your current expense activity."}
                    </Text>

                    {isExpensesLoading ? (
                      <>
                        {Array.from({ length: 3 }).map((_, index) => (
                          <View
                            key={`insight-skeleton-${index}`}
                            style={[
                              styles.signalCard,
                              {
                                backgroundColor: theme.mutedSurface,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                          >
                            {renderSkeletonCard(12, "34%")}
                            {renderSkeletonCard(22, "62%")}
                            {renderSkeletonCard(12, "46%")}
                          </View>
                        ))}
                      </>
                    ) : (
                      <>
                        <View
                          style={[
                            styles.signalCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.signalLabel, { color: theme.faint }]}
                          >
                            {renderLanguage === "Filipino"
                                ? "Nangungunang category"
                                : "Top category"}
                          </Text>
                          <Text
                            style={[styles.signalValue, { color: theme.title }]}
                          >
                            {topCategory
                              ? topCategory.label
                              : renderLanguage === "Filipino"
                                  ? "Wala pang data"
                                  : "No data yet"}
                          </Text>
                          <Text
                            style={[styles.signalMeta, { color: theme.muted }]}
                          >
                            {topCategory
                              ? formatAmount(topCategory.total)
                              : renderLanguage === "Filipino"
                                  ? "Magdagdag ng gastos"
                                  : "Add expenses"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.signalCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.signalLabel, { color: theme.faint }]}
                          >
                            {renderLanguage === "Filipino"
                                ? "Mga naka-save na resibo"
                                : "Receipts saved"}
                          </Text>
                          <Text
                            style={[styles.signalValue, { color: theme.title }]}
                          >
                            {
                              rangeFilteredExpenses.filter(
                                (expense) => expense.imageUrl,
                              ).length
                            }
                          </Text>
                          <Text
                            style={[styles.signalMeta, { color: theme.muted }]}
                          >
                            {renderLanguage === "Filipino"
                                ? `Mga entry na may photo proof sa ${dateRangeLabel.toLowerCase()}`
                                : `Entries with photo proof attached in ${dateRangeLabel.toLowerCase()}`}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.signalCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.signalLabel, { color: theme.faint }]}
                          >
                            {renderLanguage === "Filipino"
                                ? "Miyembro mula"
                                : "Member since"}
                          </Text>
                          <Text
                            style={[styles.signalValue, { color: theme.title }]}
                          >
                            {user.createdAt
                              ? new Date(
                                  user.createdAt as string | Date,
                                ).toLocaleDateString()
                              : languageCopy.dateToday}
                          </Text>
                          <Text
                            style={[styles.signalMeta, { color: theme.muted }]}
                          >
                            {user.email}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                      </>
                    )}
                  </View>
                )}
              </>
            ) : null}

            {activeTab === "budget" ? (
              <>
                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitleLarge, { color: theme.title }]}>
                    {languageCopy.budgetPlanner}
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                    {languageCopy.budgetPlannerSubtitle}
                  </Text>

                  {!isBudgetPlannerReady ? (
                    <View style={styles.budgetPlannerLoading}>
                      <ActivityIndicator size="small" color={theme.accent} />
                    </View>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.budgetPlannerStatRow,
                          shouldStackBudgetLayout &&
                            styles.budgetPlannerStackCompact,
                        ]}
                      >
                        <View
                          style={[
                            styles.budgetPlannerStatCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.budgetPlannerStatLabel, { color: theme.muted }]}>
                            {languageCopy.budgetCategories}
                          </Text>
                          <Text style={[styles.budgetPlannerStatValue, { color: theme.title }]}>
                            {categoryBudgets.length}
                          </Text>
                          <Text style={[styles.budgetPlannerStatHint, { color: theme.faint }]}>
                            {languageCopy.categoriesWithLimits}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.budgetPlannerStatCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.budgetPlannerStatLabel, { color: theme.muted }]}>
                            {languageCopy.activeDebts}
                          </Text>
                          <Text style={[styles.budgetPlannerStatValue, { color: theme.title }]}>
                            {activeDebtReminders.length}
                          </Text>
                          <Text style={[styles.budgetPlannerStatHint, { color: theme.faint }]}>
                            {languageCopy.openReminders}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.budgetPlannerStatCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.budgetPlannerStatLabel, { color: theme.muted }]}>
                            {languageCopy.outstanding}
                          </Text>
                          <Text style={[styles.budgetPlannerStatValue, { color: theme.title }]}>
                            {formatAmount(outstandingDebtTotal)}
                          </Text>
                          <Text style={[styles.budgetPlannerStatHint, { color: theme.faint }]}>
                            {languageCopy.totalUnpaidAmount}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.budgetPlannerSectionRow,
                          shouldStackBudgetLayout &&
                            styles.budgetPlannerStackCompact,
                        ]}
                      >
                        <View
                          style={[
                            styles.budgetPlannerFormCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.sectionTitle, { color: theme.title }]}>
                            {languageCopy.addCategoryBudget}
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                            {languageCopy.addCategoryBudgetSubtitle}
                          </Text>

                          <TouchableOpacity
                            activeOpacity={0.86}
                            style={[
                              styles.budgetPlannerPicker,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                            onPress={() =>
                              setShowBudgetCategoryMenu((value) => !value)
                            }
                          >
                            <Text
                              style={[
                                styles.budgetPlannerPickerText,
                                !budgetCategoryDraft && { color: theme.faint },
                                budgetCategoryDraft && { color: theme.title },
                              ]}
                            >
                              {budgetCategoryDraft || languageCopy.selectCategory}
                            </Text>
                            <Ionicons
                              name={showBudgetCategoryMenu ? "chevron-up" : "chevron-down"}
                              size={18}
                              color={theme.accent}
                            />
                          </TouchableOpacity>
                          {showBudgetCategoryMenu ? (
                            <View
                              style={[
                                styles.budgetPlannerCategoryMenu,
                                {
                                  backgroundColor: theme.mutedSurface,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <ScrollView
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                                style={styles.budgetPlannerCategoryMenuScroll}
                                contentContainerStyle={styles.budgetPlannerCategoryMenuContent}
                              >
                                {budgetCategoryOptions.map((option) => {
                                  const selected = option === budgetCategoryDraft;
                                  return (
                                    <TouchableOpacity
                                      key={option}
                                      style={[
                                        styles.budgetPlannerCategoryOption,
                                        {
                                          borderBottomColor: theme.cardBorder,
                                        },
                                        selected && styles.budgetPlannerCategoryOptionActive,
                                      ]}
                                      onPress={() => {
                                        setBudgetCategoryDraft(option);
                                        setShowBudgetCategoryMenu(false);
                                      }}
                                    >
                                      <Text
                                        style={[
                                          styles.budgetPlannerCategoryOptionText,
                                          { color: selected ? theme.title : theme.text },
                                        ]}
                                      >
                                        {option}
                                      </Text>
                                      {selected ? (
                                        <Ionicons
                                          name="checkmark"
                                          size={16}
                                          color={theme.accent}
                                        />
                                      ) : null}
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          ) : null}

                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.budgetAmount}
                            placeholderTextColor={theme.faint}
                            keyboardType="numeric"
                            value={budgetAmountDraft}
                            onChangeText={setBudgetAmountDraft}
                          />
                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.purposeNote}
                            placeholderTextColor={theme.faint}
                            value={budgetNoteDraft}
                            onChangeText={setBudgetNoteDraft}
                          />

                          <TouchableOpacity
                            style={[
                              styles.budgetPlannerPrimaryButton,
                              shouldStackBudgetLayout &&
                                styles.budgetPlannerPrimaryButtonCompact,
                            ]}
                            onPress={saveCategoryBudget}
                          >
                            <Text style={styles.budgetPlannerPrimaryButtonText}>{languageCopy.saveBudget}</Text>
                          </TouchableOpacity>
                        </View>

                        <View
                          style={[
                            styles.budgetPlannerFormCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.sectionTitle, { color: theme.title }]}>
                            {languageCopy.addDebtReminder}
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                            {languageCopy.addDebtReminderSubtitle}
                          </Text>

                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.debtTitle}
                            placeholderTextColor={theme.faint}
                            value={debtTitleDraft}
                            onChangeText={setDebtTitleDraft}
                          />
                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.amount}
                            placeholderTextColor={theme.faint}
                            keyboardType="numeric"
                            value={debtAmountDraft}
                            onChangeText={setDebtAmountDraft}
                          />
                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.personOrLender}
                            placeholderTextColor={theme.faint}
                            value={debtLenderDraft}
                            onChangeText={setDebtLenderDraft}
                          />
                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={theme.faint}
                            value={debtDueDateDraft}
                            onChangeText={setDebtDueDateDraft}
                          />
                          <TextInput
                            style={[
                              styles.budgetPlannerInput,
                              styles.budgetPlannerNoteInput,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                color: theme.title,
                              },
                            ]}
                            placeholder={languageCopy.note}
                            placeholderTextColor={theme.faint}
                            value={debtNoteDraft}
                            onChangeText={setDebtNoteDraft}
                            multiline
                          />

                          <TouchableOpacity
                            style={[
                              styles.budgetPlannerPrimaryButton,
                              shouldStackBudgetLayout &&
                                styles.budgetPlannerPrimaryButtonCompact,
                            ]}
                            onPress={saveDebtReminder}
                          >
                            <Text style={styles.budgetPlannerPrimaryButtonText}>{languageCopy.saveDebt}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.budgetPlannerSectionRow,
                          shouldStackBudgetLayout &&
                            styles.budgetPlannerStackCompact,
                        ]}
                      >
                        <View
                          style={[
                            styles.budgetPlannerListCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.sectionTitle, { color: theme.title }]}>
                            {languageCopy.savedCategoryBudgets}
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                            {languageCopy.savedCategoryBudgetsSubtitle}
                          </Text>
                          {categoryBudgets.length === 0 ? (
                            <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                              {languageCopy.noCategoryBudgetsYet}
                            </Text>
                          ) : (
                            categoryBudgets.map((entry) => (
                              <View
                                key={entry.id}
                                style={[
                                  styles.budgetPlannerListRow,
                                  shouldStackBudgetLayout &&
                                    styles.budgetPlannerListRowCompact,
                                  {
                                    backgroundColor: theme.cardBackground,
                                    borderColor: theme.cardBorder,
                                  },
                                ]}
                              >
                                <View style={styles.budgetPlannerListCopy}>
                                  <Text style={[styles.budgetPlannerListTitle, { color: theme.title }]}>
                                    {entry.category}
                                  </Text>
                                  <Text style={[styles.budgetPlannerListMeta, { color: theme.faint }]}>
                                    {formatAmount(entry.amount)}
                                    {entry.note ? ` - ${entry.note}` : ""}
                                  </Text>
                                  <View
                                    style={[
                                      styles.budgetPlannerBudgetTrack,
                                      {
                                        backgroundColor:
                                          themeMode === "light"
                                            ? "rgba(148, 163, 184, 0.2)"
                                            : "rgba(148, 163, 184, 0.16)",
                                      },
                                    ]}
                                  >
                                    <Animated.View
                                      style={[
                                        styles.budgetPlannerBudgetFill,
                                        {
                                          width: `${(categoryBudgetProgress[entry.id]?.progress ?? 0) * 100}%`,
                                          alignSelf: "flex-start",
                                          backgroundColor:
                                            (categoryBudgetProgress[entry.id]?.overspent ?? 0) > 0
                                              ? "#F87171"
                                              : theme.accent,
                                          transform: [{ scaleX: budgetBarsAnim }],
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text
                                    style={[
                                      styles.budgetPlannerBudgetCaption,
                                      {
                                        color:
                                          (categoryBudgetProgress[entry.id]?.overspent ?? 0) > 0
                                            ? "#FCA5A5"
                                            : theme.accent,
                                      },
                                    ]}
                                  >
                                    {formatCopy("enteredUsed", {
                                      percent:
                                        categoryBudgetProgress[entry.id]
                                          ?.percentage ?? 0,
                                    })}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.budgetPlannerBudgetCaption,
                                      {
                                        color:
                                          (categoryBudgetProgress[entry.id]?.overspent ?? 0) > 0
                                            ? "#FCA5A5"
                                            : theme.faint,
                                      },
                                    ]}
                                  >
                                    {(categoryBudgetProgress[entry.id]?.overspent ?? 0) > 0
                                      ? formatCopy("spentOverBy", {
                                          spent: formatAmount(
                                            categoryBudgetProgress[entry.id]
                                              ?.spent ?? 0,
                                          ),
                                          over: formatAmount(
                                            categoryBudgetProgress[entry.id]
                                              ?.overspent ?? 0,
                                          ),
                                        })
                                      : formatCopy("spentLeft", {
                                          spent: formatAmount(
                                            categoryBudgetProgress[entry.id]
                                              ?.spent ?? 0,
                                          ),
                                          left: formatAmount(
                                            categoryBudgetProgress[entry.id]
                                              ?.remaining ?? 0,
                                          ),
                                        })}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => confirmDeleteCategoryBudget(entry.id)}
                                  style={[
                                    styles.budgetPlannerActionButton,
                                    {
                                      backgroundColor: "rgba(127, 29, 29, 0.16)",
                                      borderColor: "rgba(248, 113, 113, 0.28)",
                                    },
                                  ]}
                                >
                                  <Text style={[styles.budgetPlannerDeleteText, { color: "#F87171" }]}>
                                    {languageCopy.delete}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ))
                          )}
                        </View>

                        <View
                          style={[
                            styles.budgetPlannerListCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                            shouldStackBudgetLayout &&
                              styles.budgetPlannerCardCompact,
                          ]}
                        >
                          <Text style={[styles.sectionTitle, { color: theme.title }]}>
                            {languageCopy.debtReminders}
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                            {languageCopy.debtRemindersSubtitle}
                          </Text>
                          {debtReminders.length === 0 ? (
                            <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                              {languageCopy.noDebtRemindersYet}
                            </Text>
                          ) : (
                            debtReminders.map((entry) => (
                              <View
                                key={entry.id}
                                style={[
                                  styles.budgetPlannerListRow,
                                  shouldStackBudgetLayout &&
                                    styles.budgetPlannerListRowCompact,
                                  {
                                    backgroundColor: theme.cardBackground,
                                    borderColor: theme.cardBorder,
                                  },
                                ]}
                              >
                                <View style={styles.budgetPlannerListCopy}>
                                  <Text style={[styles.budgetPlannerListTitle, { color: theme.title }]}>
                                    {entry.title}
                                  </Text>
                                  <Text style={[styles.budgetPlannerListMeta, { color: theme.faint }]}>
                                    {formatAmount(entry.amount)} - {entry.lender} - {entry.dueDate}
                                  </Text>
                                  {entry.paid ? (
                                    <Text style={[styles.budgetPlannerPaidTag, { color: "#34D399" }]}>
                                      {languageCopy.paid}
                                    </Text>
                                  ) : null}
                                </View>

                                <View
                                  style={[
                                    styles.budgetPlannerRowActions,
                                    shouldStackBudgetLayout &&
                                      styles.budgetPlannerRowActionsCompact,
                                  ]}
                                >
                                  {!entry.paid ? (
                                    <TouchableOpacity
                                      onPress={() => markDebtAsPaid(entry.id)}
                                      style={[
                                        styles.budgetPlannerActionButton,
                                        {
                                          backgroundColor:
                                            themeMode === "light"
                                              ? "rgba(2, 132, 199, 0.1)"
                                              : "rgba(34, 211, 238, 0.12)",
                                          borderColor:
                                            themeMode === "light"
                                              ? "rgba(2, 132, 199, 0.2)"
                                              : "rgba(34, 211, 238, 0.22)",
                                        },
                                      ]}
                                    >
                                      <Text style={[styles.budgetPlannerPaidText, { color: theme.accent }]}>
                                        {languageCopy.markAsPaid}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                  <TouchableOpacity
                                    onPress={() => confirmDeleteDebtReminder(entry.id)}
                                    style={[
                                      styles.budgetPlannerActionButton,
                                      {
                                        backgroundColor: "rgba(127, 29, 29, 0.16)",
                                        borderColor: "rgba(248, 113, 113, 0.28)",
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.budgetPlannerDeleteText, { color: "#F87171" }]}>
                                      {languageCopy.delete}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </>
            ) : null}

            {activeTab === "stats" ? (
              <>
                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.panelHeader,
                      isCompact && styles.panelHeaderStack,
                    ]}
                  >
                    <View>
                      <Text
                        style={[styles.sectionTitleLarge, { color: theme.title }]}
                      >
                        {languageCopy.spendingMomentum}
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        {momentumSubtitle}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.exportButton,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      onPress={() => setShowExportOptions(true)}
                      disabled={isExporting}
                    >
                      <Ionicons
                        name="download-outline"
                        size={16}
                        color={theme.accent}
                      />
                      <Text
                        style={[styles.exportButtonText, { color: theme.title }]}
                      >
                        {isExporting ? languageCopy.exporting : languageCopy.export}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isExpensesLoading ? (
                    <Animated.View
                      style={[
                        styles.trendMomentumCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                        {
                          opacity: statsAnim,
                          transform: [
                            {
                              translateY: statsAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {renderSkeletonCard(18, "42%")}
                      {renderSkeletonCard(14, "56%")}
                      {renderSkeletonCard(42, 220)}
                      {renderSkeletonCard(220, "100%")}
                    </Animated.View>
                  ) : (
                    <View
                      style={[
                        styles.trendMomentumCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.momentumWindowSwitch,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        {MOMENTUM_WINDOW_OPTIONS.map((option) => {
                          const active = momentumWindow === option.key;
                          return (
                            <TouchableOpacity
                              key={option.key}
                              style={[
                                styles.momentumWindowOption,
                                active && styles.momentumWindowOptionActive,
                              ]}
                              onPress={() => setMomentumWindow(option.key)}
                            >
                              <Text
                                style={[
                                  styles.momentumWindowOptionText,
                                  { color: active ? "#082F49" : theme.muted },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View
                        style={[
                          styles.trendChartShell,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                          Platform.OS === "web"
                            ? {
                                paddingLeft: 4,
                                paddingRight: 4,
                                paddingTop: 8,
                                paddingBottom: 8,
                              }
                            : null,
                        ]}
                      >
                        <Svg
                          width="100%"
                          height={momentumChart.height}
                          viewBox={`0 0 ${momentumChart.width} ${momentumChart.height}`}
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <Defs>
                            <SvgLinearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0%" stopColor="#22D3EE" stopOpacity="0.32" />
                              <Stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
                            </SvgLinearGradient>
                          </Defs>

                          {[1, 0.75, 0.5, 0.25, 0].map((step, index) => (
                            <Line
                              key={`grid-${index}`}
                              x1={momentumChart.left}
                              x2={momentumChart.width - momentumChart.right}
                              y1={momentumChart.top + (1 - step) * momentumChart.plotHeight}
                              y2={momentumChart.top + (1 - step) * momentumChart.plotHeight}
                              stroke={index === 4 ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.12)"}
                              strokeWidth={index === 4 ? 1.6 : 1}
                              strokeDasharray={index === 4 ? "6 6" : undefined}
                            />
                          ))}

                          {momentumChart.areaPath ? (
                            <Path d={momentumChart.areaPath} fill="url(#momentumFill)" />
                          ) : null}
                          {momentumChart.linePath ? (
                            <Path d={momentumChart.linePath} stroke="#38DDF5" strokeWidth={5} fill="none" />
                          ) : null}
                          {momentumChart.points.map((point) => (
                            <Circle
                              key={`point-${point.label}`}
                              cx={point.x}
                              cy={point.y}
                              r={6}
                              fill="#38DDF5"
                              stroke="#7DD3FC"
                              strokeWidth={2}
                            />
                          ))}
                          {momentumChart.points.map((point) => (
                            <SvgText
                              key={`xlabel-${point.label}`}
                              x={point.x}
                              y={momentumChart.height - 6}
                              fill={theme.title}
                              fontSize="11"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {point.label}
                            </SvgText>
                          ))}
                        </Svg>

                        <View style={styles.trendAxisLabels}>
                          {[1, 0.75, 0.5, 0.25, 0].map((step, index) => (
                            <Text
                              key={`label-${index}`}
                              style={[
                                styles.trendAxisValue,
                                { color: theme.muted },
                                Platform.OS === "web"
                                  ? {
                                      transform: [{ translateX: -4 }],
                                    }
                                  : null,
                              ]}
                            >
                              {step === 0 ? "0" : formatAxisAmount(Math.round(momentumMax * step))}
                            </Text>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.trendHighlightCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.sectionTitle, { color: theme.title }]}
                  >
                    {languageCopy.momentumSummary}
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: theme.faint }]}
                  >
                    {formatCopy("momentumSummaryBody", {
                      total: formatAmount(
                        momentumSeries.reduce(
                          (sum, item) => sum + item.total,
                          0,
                        ),
                      ),
                      average: formatAmount(momentumAverage),
                      peakLabel: peakMomentum?.label || "N/A",
                      peakAmount: formatAmount(peakMomentum?.total || 0),
                    })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statsInsightsCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.title }]}>
                    {languageCopy.statsSmartInsights}
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                    {languageCopy.statsSmartInsightsSubtitle}
                  </Text>

                  {isExpensesLoading ? (
                    <View
                      style={[
                        styles.statsInsightGrid,
                        isCompact && styles.statsInsightGridStack,
                      ]}
                    >
                      {Array.from({ length: 4 }).map((_, index) => (
                        <View
                          key={`stats-insight-skeleton-${index}`}
                          style={[
                            styles.statsInsightTile,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          {renderSkeletonCard(38, 38)}
                          {renderSkeletonCard(12, "45%")}
                          {renderSkeletonCard(22, "70%")}
                          {renderSkeletonCard(12, "88%")}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.statsInsightGrid,
                        isCompact && styles.statsInsightGridStack,
                      ]}
                    >
                      {smartInsights.map((insight) => (
                        <View
                          key={insight.key}
                          style={[
                            styles.statsInsightTile,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.statsInsightIcon,
                              { backgroundColor: "rgba(34, 211, 238, 0.12)" },
                            ]}
                          >
                            <Ionicons
                              name={insight.icon}
                              size={18}
                              color={theme.accent}
                            />
                          </View>
                          <Text
                            style={[styles.statsInsightLabel, { color: theme.muted }]}
                          >
                            {insight.title}
                          </Text>
                          <Text
                            style={[styles.statsInsightValue, { color: theme.title }]}
                            numberOfLines={1}
                          >
                            {insight.value}
                          </Text>
                          <Text
                            style={[styles.statsInsightMeta, { color: theme.faint }]}
                          >
                            {insight.meta}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.analyticsHeroCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                      <View style={styles.analyticsHeroHeader}>
                        <View style={styles.analyticsHeroCopy}>
                          <Text style={[styles.sectionTitle, { color: theme.title }]}>
                            {languageCopy.analytics}
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                            {languageCopy.analyticsSubtitle}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.analyticsTrendIconWrap,
                            {
                              backgroundColor:
                                trendStats.monthlyChange >= 0
                                  ? "rgba(34,197,94,0.14)"
                                  : "rgba(248,113,113,0.14)",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              trendStats.monthlyChange >= 0
                                ? "trending-up-outline"
                                : "trending-down-outline"
                            }
                            size={20}
                            color={
                              trendStats.monthlyChange >= 0 ? "#22C55E" : "#F87171"
                            }
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.analyticsSummaryCard,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.analyticsHeroStatLabel, { color: theme.muted }]}>
                          {languageCopy.monthOverMonth}
                        </Text>
                        <Text style={[styles.analyticsHeroValue, { color: theme.title }]}>
                          {`${trendStats.monthlyChange >= 0 ? "+" : ""}${trendStats.monthlyChange.toFixed(1)}%`}
                        </Text>
                        <Text style={[styles.analyticsGaugeCaption, { color: theme.faint }]}>
                          {formatCopy("thisMonthVsLast", {
                            thisMonth: formatAmount(stats.thisMonth),
                            lastMonth: formatAmount(stats.lastMonth),
                          })}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.analyticsInfoGrid,
                          isCompact && styles.analyticsInfoGridStack,
                        ]}
                      >
                        <View
                          style={[
                            styles.analyticsInfoCard,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.analyticsHeroStatLabel, { color: theme.muted }]}>
                            {languageCopy.currentWeek}
                          </Text>
                          <Text style={[styles.analyticsInfoValue, { color: theme.title }]}>
                            {formatAmount(trendStats.currentWeekTotal)}
                          </Text>
                          <Text style={[styles.analyticsInfoMeta, { color: theme.faint }]}>
                            {formatCopy("lastWeek", {
                              amount: formatAmount(trendStats.lastWeekTotal),
                            })}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.analyticsInfoCard,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.analyticsHeroStatLabel, { color: theme.muted }]}>
                            {languageCopy.averageExpense}
                          </Text>
                          <Text style={[styles.analyticsInfoValue, { color: theme.title }]}>
                            {formatAmount(trendStats.averageExpense)}
                          </Text>
                          <Text style={[styles.analyticsInfoMeta, { color: theme.faint }]}>
                            {formatCopy("entriesInRange", {
                              count: rangeFilteredExpenses.length,
                              range: dateRangeLabel.toLowerCase(),
                            })}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.analyticsFeatureRow,
                          isCompact && styles.analyticsFeatureRowStack,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.analyticsFeatureCopy}>
                          <View style={styles.analyticsFeatureLabelRow}>
                            <Text style={[styles.analyticsFeatureTitle, { color: theme.title }]}>
                              {languageCopy.receiptCoverage}
                            </Text>
                          </View>
                          <Text style={[styles.analyticsFeatureMeta, { color: theme.faint }]}>
                            {formatCopy("peakPeriod", {
                              label: weeklyInsight.highestWeek?.[0] ?? "N/A",
                              amount: formatAmount(
                                weeklyInsight.highestWeek?.[1] ?? 0,
                              ),
                            })}
                          </Text>
                        </View>
                        <View style={styles.analyticsReceiptWrap}>
                          <View
                            style={[
                              styles.analyticsReceiptTrack,
                              { backgroundColor: theme.mutedSurface },
                            ]}
                          >
                            <LinearGradient
                              colors={["#22D3EE", "#3B82F6"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.analyticsReceiptFill,
                                {
                                  width: `${Math.max(
                                    Math.round(trendStats.receiptCoverage * 100),
                                    0,
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.analyticsReceiptValue, { color: theme.title }]}>
                            {Math.round(trendStats.receiptCoverage * 100)}%
                          </Text>
                        </View>
                      </View>
                </View>

                <View
                  style={[
                    styles.budgetImpactCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.budgetImpactHeader,
                      isCompact && styles.budgetImpactHeaderStack,
                    ]}
                  >
                    <View style={styles.budgetImpactCopy}>
                      <Text style={[styles.sectionTitle, { color: theme.title }]}>
                        {languageCopy.budgetImpactTitle}
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                        {languageCopy.budgetImpactSubtitle}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.budgetImpactBadge,
                        {
                          backgroundColor:
                            budgetImpactSummary.overspent > 0
                              ? "rgba(248, 113, 113, 0.14)"
                              : "rgba(34, 211, 238, 0.12)",
                          borderColor:
                            budgetImpactSummary.overspent > 0
                              ? "rgba(248, 113, 113, 0.28)"
                              : "rgba(34, 211, 238, 0.24)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.budgetImpactBadgeText,
                          {
                            color:
                              budgetImpactSummary.overspent > 0
                                ? "#FCA5A5"
                                : theme.accent,
                          },
                        ]}
                      >
                        {monthlyBudget > 0
                          ? `${budgetImpactSummary.percentage}%`
                          : languageCopy.notSet}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.budgetImpactGauge,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.budgetImpactGaugeTop}>
                      <Text style={[styles.analyticsHeroStatLabel, { color: theme.muted }]}>
                        {languageCopy.budgetImpactUsed}
                      </Text>
                      <Text style={[styles.budgetImpactAmount, { color: theme.title }]}>
                        {formatAmount(currentMonthSpend)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.budgetImpactTrack,
                        { backgroundColor: theme.mutedSurface },
                      ]}
                    >
                      <LinearGradient
                        colors={
                          budgetImpactSummary.overspent > 0
                            ? ["#F87171", "#FB7185"]
                            : ["#22D3EE", "#3B82F6"]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.budgetImpactFill,
                          {
                            width: `${
                              monthlyBudget > 0
                                ? Math.max(budgetImpactSummary.progress * 100, 4)
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.budgetImpactMetricGrid,
                        isCompact && styles.budgetImpactMetricGridStack,
                      ]}
                    >
                      <View style={styles.budgetImpactMetric}>
                        <Text style={[styles.budgetImpactMetricLabel, { color: theme.muted }]}>
                          {languageCopy.budgetImpactRemaining}
                        </Text>
                        <Text style={[styles.budgetImpactMetricValue, { color: theme.title }]}>
                          {monthlyBudget > 0
                            ? formatAmount(budgetImpactSummary.remaining)
                            : languageCopy.notSet}
                        </Text>
                      </View>
                      <View style={styles.budgetImpactMetric}>
                        <Text style={[styles.budgetImpactMetricLabel, { color: theme.muted }]}>
                          {languageCopy.budgetImpactProjected}
                        </Text>
                        <Text style={[styles.budgetImpactMetricValue, { color: theme.title }]}>
                          {formatAmount(budgetImpactSummary.projectedSpend)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.budgetWatchTitle, { color: theme.title }]}>
                    {languageCopy.budgetCategoryWatchlist}
                  </Text>
                  {categoryBudgetWatchlist.length === 0 ? (
                    <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                      {languageCopy.noBudgetImpactYet}
                    </Text>
                  ) : (
                    <View style={styles.budgetWatchList}>
                      {categoryBudgetWatchlist.map(
                        ({ entry, progress, percentage, remaining, overspent, spent }) => (
                          <View
                            key={entry.id}
                            style={[
                              styles.budgetWatchRow,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                              },
                            ]}
                          >
                            <View style={styles.budgetWatchRowTop}>
                              <Text
                                style={[styles.budgetWatchCategory, { color: theme.title }]}
                                numberOfLines={1}
                              >
                                {getCategoryDisplayLabel(entry.category)}
                              </Text>
                              <Text style={[styles.budgetWatchAmount, { color: theme.muted }]}>
                                {formatAmount(spent)} / {formatAmount(entry.amount)}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.budgetWatchTrack,
                                { backgroundColor: theme.mutedSurface },
                              ]}
                            >
                              <LinearGradient
                                colors={
                                  overspent > 0
                                    ? ["#F87171", "#FB7185"]
                                    : ["#22D3EE", "#3B82F6"]
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                  styles.budgetWatchFill,
                                  { width: `${Math.max(Math.min(progress, 1) * 100, 5)}%` },
                                ]}
                              />
                            </View>
                            <Text style={[styles.budgetWatchMeta, { color: theme.faint }]}>
                              {formatCopy("categoryBudgetUsed", { percent: percentage })}
                              {" - "}
                              {overspent > 0
                                ? formatCopy("categoryBudgetOver", {
                                    amount: formatAmount(overspent),
                                  })
                                : formatCopy("categoryBudgetLeft", {
                                    amount: formatAmount(remaining),
                                  })}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.categoryBreakdownCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                      <Text
                        style={[styles.sectionTitle, { color: theme.title }]}
                      >
                        {languageCopy.categoryBreakdown}
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        {languageCopy.categoryBreakdownSubtitle}{" "}
                        {dateRangeLabel.toLowerCase()}.
                      </Text>
                      {pieChartSlices.total > 0 ? (
                        <Animated.View
                          style={[
                            styles.categoryPieWrap,
                            {
                              opacity: statsAnim,
                              transform: [
                                {
                                  scale: statsAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.96, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          <Svg width={132} height={132} viewBox="0 0 132 132">
                            <Circle
                              cx={66}
                              cy={66}
                              r={pieChartSlices.radius}
                              stroke={theme.cardBackground}
                              strokeWidth={18}
                              fill="none"
                            />
                            {pieChartSlices.slices.map((slice) => (
                              <Circle
                                key={`pie-${slice.label}`}
                                cx={66}
                                cy={66}
                                r={pieChartSlices.radius}
                                stroke={slice.color}
                                strokeWidth={18}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={slice.strokeDasharray}
                                strokeDashoffset={slice.strokeDashoffset}
                                rotation="-90"
                                origin="66,66"
                              />
                            ))}
                          </Svg>
                          <View style={styles.categoryPieLegend}>
                            {pieChartSlices.slices.map((slice) => (
                              <View
                                key={`legend-${slice.label}`}
                                style={styles.categoryPieLegendRow}
                              >
                                <View
                                  style={[
                                    styles.categoryPieLegendDot,
                                    { backgroundColor: slice.color },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.categoryPieLegendText,
                                    { color: theme.faint },
                                  ]}
                                >
                                  {getCategoryDisplayLabel(slice.label)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </Animated.View>
                      ) : null}
                      <View style={styles.categoryBreakdownList}>
                        {sortedCategoryBreakdown.length === 0 ? (
                          <Text
                            style={[
                              styles.sectionSubtitle,
                              { color: theme.faint },
                            ]}
                          >
                            {languageCopy.noCategorizedExpensesYet}{" "}
                            {dateRangeLabel.toLowerCase()}.
                          </Text>
                        ) : (
                          sortedCategoryBreakdown.slice(0, 5).map((item) => {
                            const max = sortedCategoryBreakdown[0]?.total || 1;
                            const selected =
                              activeStatsCategory &&
                              normalizeCategoryKey(activeStatsCategory) ===
                                normalizeCategoryKey(item.label);
                            return (
                              <TouchableOpacity
                                key={item.label}
                                activeOpacity={0.86}
                                onPress={() => setSelectedStatsCategory(item.label)}
                                style={[
                                  styles.categoryBreakdownRow,
                                  styles.categoryBreakdownTouchable,
                                  {
                                    backgroundColor: selected
                                      ? "rgba(34, 211, 238, 0.1)"
                                      : "transparent",
                                    borderColor: selected
                                      ? "rgba(34, 211, 238, 0.26)"
                                      : "transparent",
                                  },
                                ]}
                              >
                                <View style={styles.categoryBreakdownCopy}>
                                  <Text
                                    style={[
                                      styles.categoryBreakdownLabel,
                                      { color: theme.title },
                                    ]}
                                  >
                                    {getCategoryDisplayLabel(item.label)}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.categoryBreakdownValue,
                                      { color: theme.muted },
                                    ]}
                                  >
                                    {formatAmount(item.total)}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.categoryBreakdownTrack,
                                    { backgroundColor: theme.cardBackground },
                                  ]}
                                >
                                  <LinearGradient
                                    colors={["#22D3EE", "#3B82F6"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[
                                      styles.categoryBreakdownFill,
                                      {
                                        width: `${Math.max((item.total / max) * 100, 12)}%`,
                                      },
                                    ]}
                                  />
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                </View>

                <View
                  style={[
                    styles.categoryDrilldownCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryDrilldownHeader,
                      isCompact && styles.categoryDrilldownHeaderStack,
                    ]}
                  >
                    <View style={styles.categoryDrilldownCopy}>
                      <Text style={[styles.sectionTitle, { color: theme.title }]}>
                        {languageCopy.categoryDrilldownTitle}
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                        {languageCopy.categoryDrilldownSubtitle}
                      </Text>
                    </View>
                    {activeStatsCategory ? (
                      <View
                        style={[
                          styles.categoryDrilldownBadge,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryDrilldownBadgeText,
                            { color: theme.accent },
                          ]}
                          numberOfLines={1}
                        >
                          {getCategoryDisplayLabel(activeStatsCategory)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.categoryDrilldownMeta, { color: theme.faint }]}>
                    {activeStatsCategory
                      ? formatCopy("selectedCategoryExpenseCount", {
                          count: categoryDrilldownExpenses.length,
                          category: getCategoryDisplayLabel(activeStatsCategory),
                        })
                      : languageCopy.noDataYet}
                  </Text>

                  {categoryDrilldownExpenses.length === 0 ? (
                    <Text style={[styles.sectionSubtitle, { color: theme.faint }]}>
                      {languageCopy.noExpensesForCategory}
                    </Text>
                  ) : (
                    <View style={styles.categoryDrilldownList}>
                      {categoryDrilldownExpenses.map((expense) => (
                        <TouchableOpacity
                          key={`stats-drilldown-${expense.id}`}
                          activeOpacity={0.86}
                          onPress={() => startEditingExpense(expense)}
                          style={[
                            styles.categoryDrilldownRow,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <View style={styles.categoryDrilldownExpenseCopy}>
                            <Text
                              style={[
                                styles.categoryDrilldownExpenseTitle,
                                { color: theme.title },
                              ]}
                              numberOfLines={1}
                            >
                              {expense.description}
                            </Text>
                            <Text
                              style={[
                                styles.categoryDrilldownExpenseMeta,
                                { color: theme.faint },
                              ]}
                              numberOfLines={1}
                            >
                              {new Date(expense.date).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                              {expense.imageUrl
                                ? ` - ${languageCopy.receiptAttached}`
                                : ""}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.categoryDrilldownAmount,
                              { color: theme.title },
                            ]}
                          >
                            {formatAmount(expense.amount)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            ) : null}

            {activeTab === "gallery" ? (
              <View
                style={[
                  styles.panel,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.panelHeader,
                    isCompact && styles.panelHeaderStack,
                  ]}
                >
                  <View>
                    <Text
                      style={[styles.sectionTitleLarge, { color: theme.title }]}
                    >
                      {languageCopy.receiptGallery}
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      {languageCopy.receiptGallerySubtitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.galleryCountBadge,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.galleryCountText, { color: theme.title }]}
                    >
                      {filteredGalleryExpenses.length} {languageCopy.savedCountSuffix}
                    </Text>
                  </View>
                </View>

                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                      color: theme.title,
                    },
                  ]}
                  placeholder={languageCopy.searchReceiptsPlaceholder}
                  placeholderTextColor={theme.faint}
                  value={gallerySearchQuery}
                  onChangeText={setGallerySearchQuery}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRow}
                >
                  {galleryCategories.map((category) => (
                    <TouchableOpacity
                      key={`gallery-${category}`}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                        galleryCategoryFilter === category &&
                          styles.categoryChipActive,
                      ]}
                      onPress={() =>
                        setGalleryCategoryFilter(
                          category as typeof galleryCategoryFilter,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: theme.faint },
                          galleryCategoryFilter === category &&
                            styles.categoryChipTextActive,
                          themeMode === "light" &&
                            galleryCategoryFilter === category &&
                            styles.categoryChipTextActiveLight,
                        ]}
                      >
                        {getCategoryDisplayLabel(category)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {isExpensesLoading ? (
                  <View style={styles.galleryGrid}>
                    {Array.from({ length: isCompact ? 4 : 6 }).map(
                      (_, index) => (
                        <View
                          key={`gallery-skeleton-${index}`}
                          style={[
                            styles.galleryCard,
                            isCompact && styles.galleryCardCompact,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          {renderSkeletonCard(150, "100%")}
                          {renderSkeletonCard(14, "76%")}
                          {renderSkeletonCard(12, "58%")}
                        </View>
                      ),
                    )}
                  </View>
                ) : filteredGalleryExpenses.length === 0 ? (
                  <Text style={[styles.emptyGraphText, { color: theme.faint }]}>
                    {gallerySearchQuery.trim()
                      ? languageCopy.noReceiptsMatched
                      : galleryCategoryFilter !== "All"
                        ? formatCopy("noReceiptsInCategory", {
                            category: getCategoryDisplayLabel(
                              galleryCategoryFilter,
                            ),
                          })
                        : languageCopy.noReceiptImages}
                  </Text>
                ) : (
                  <View style={styles.galleryGrid}>
                    {filteredGalleryExpenses.map((expense) => (
                      <TouchableOpacity
                        key={expense.id}
                        style={[
                          styles.galleryCard,
                          isCompact && styles.galleryCardCompact,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        onPress={() => setSelectedReceipt(expense)}
                        activeOpacity={0.86}
                      >
                        <View style={styles.galleryImageWrap}>
                          <Image
                            source={{ uri: expense.imageUrl! }}
                            style={styles.galleryImage}
                            contentFit="cover"
                          />
                          <View style={styles.galleryImageOverlay}>
                            <View
                              style={[
                                styles.galleryOverlayBadge,
                                { backgroundColor: theme.cardBackground },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.galleryOverlayBadgeText,
                                  { color: theme.title },
                                ]}
                              >
                                {getCategoryDisplayLabel(expense.category) ||
                                  languageCopy.receipt}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.galleryOverlayAmount,
                                { backgroundColor: theme.cardBackground },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.galleryOverlayAmountText,
                                  { color: theme.title },
                                ]}
                              >
                                {formatAmount(expense.amount)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text
                          style={[styles.galleryTitle, { color: theme.title }]}
                          numberOfLines={1}
                        >
                          {expense.description}
                        </Text>
                        <Text
                          style={[styles.galleryMeta, { color: theme.faint }]}
                          numberOfLines={1}
                        >
                          {new Date(expense.date).toLocaleDateString()} /{" "}
                          {expense.notes?.trim()
                            ? expense.notes.trim()
                            : languageCopy.tapFullReceipt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === "profile" ? (
              <>
                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.title }]}>
                    {languageCopy.account}
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: theme.faint }]}
                  >
                    {languageCopy.accountSubtitle}
                  </Text>

                  <Text
                    style={[styles.profileSectionLabel, { color: theme.faint }]}
                  >
                    {languageCopy.accountOverview}
                  </Text>
                  <View
                    style={[
                      styles.profileCard,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <>
                      <View
                        style={[
                          styles.profileTopRow,
                          isVeryCompact && styles.profileTopRowCompact,
                        ]}
                      >
                        <TouchableOpacity
                          onPress={handlePickAvatar}
                          style={styles.profileAvatarWrap}
                        >
                          {renderAvatar(64, 26)}
                          <View style={styles.avatarCamera}>
                            <Ionicons
                              name="camera-outline"
                              size={14}
                              color="#F8FAFC"
                            />
                          </View>
                        </TouchableOpacity>

                        <View style={styles.profileCopy}>
                          <Text
                            style={[styles.profileName, { color: theme.title }]}
                            numberOfLines={2}
                          >
                            {user.name}
                          </Text>
                          <Text
                            style={[styles.profileEmail, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {user.email}
                          </Text>
                          {user.username ? (
                            <Text
                              style={[styles.profileUsername, { color: theme.muted }]}
                              numberOfLines={1}
                            >
                              @{user.username}
                            </Text>
                          ) : null}
                          <Text
                            style={[
                              styles.profileMeta,
                              { color: theme.accent },
                            ]}
                            numberOfLines={2}
                          >
                            {languageCopy.loggedInSince}{" "}
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : languageCopy.dateToday}
                          </Text>
                          <View style={styles.profileMetaRow}>
                            <View
                              style={[
                                styles.profileMetaPill,
                                {
                                  backgroundColor: theme.cardBackground,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.profileMetaPillText,
                                  { color: theme.title },
                                ]}
                              >
                                {localizedProfileCopy.profileBadgeCurrency}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </>
                  </View>

                  <View
                    style={[
                      styles.profileSectionGrid,
                      isCompact && styles.profileSectionGridCompact,
                    ]}
                  >
                    <View
                      style={[
                        styles.profileCard,
                        styles.profileMiniCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {localizedProfileCopy.accountActionsTitle}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {localizedProfileCopy.accountActionsSubtitle}
                      </Text>
                      <View style={styles.profileActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            themeMode === "light" &&
                              styles.secondaryButtonLight,
                          ]}
                          onPress={() => {
                            setEditName(user.name);
                            setEditUsername(user.username ?? "");
                            setEditEmail(user.email);
                            setIsEditingProfile(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              themeMode === "light" &&
                                styles.secondaryButtonTextLight,
                            ]}
                          >
                            {localizedProfileCopy.editProfile}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.profileCard,
                        styles.profileMiniCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {localizedProfileCopy.preferencesTitle}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {localizedProfileCopy.preferencesSubtitle}
                      </Text>

                      <TouchableOpacity
                        style={[
                          styles.selectField,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        onPress={() => setShowCurrencyPicker(true)}
                      >
                        <View style={styles.selectFieldCopy}>
                          <Text
                            style={[
                              styles.selectFieldValue,
                              { color: theme.title },
                            ]}
                          >
                            {preferredCurrency}
                          </Text>
                          <Text
                            style={[
                              styles.selectFieldLabel,
                              { color: theme.muted },
                            ]}
                          >
                            {SUPPORTED_CURRENCIES.find(
                              (item) => item.code === preferredCurrency,
                            )?.label || localizedProfileCopy.preferredCurrencyLabel}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={theme.accent}
                        />
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.preferenceThemeRow,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.preferenceThemeCopy}>
                          <Text
                            style={[
                              styles.selectFieldValue,
                              styles.preferenceThemeValue,
                              { color: theme.title },
                            ]}
                          >
                            {localizedProfileCopy.appThemeLabel}
                          </Text>
                          <Text
                            style={[
                              styles.selectFieldLabel,
                              { color: theme.muted },
                            ]}
                          >
                            {themeMode === "dark"
                              ? localizedProfileCopy.dark
                              : localizedProfileCopy.light}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.preferenceThemeSwitch,
                            styles.preferenceThemeSwitchWrap,
                          ]}
                        >
                          {(["light", "dark"] as ThemeMode[]).map((mode) => {
                            const active = themeMode === mode;
                            return (
                              <TouchableOpacity
                                key={mode}
                                style={[
                                  styles.preferenceThemeOption,
                                  active && styles.preferenceThemeOptionActive,
                                ]}
                                onPress={() => setThemeMode(mode)}
                              >
                                <Text
                                  style={[
                                    styles.preferenceThemeOptionText,
                                    {
                                      color: active ? "#082F49" : theme.muted,
                                    },
                                  ]}
                                >
                                  {mode === "light"
                                    ? localizedProfileCopy.light
                                    : localizedProfileCopy.dark}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.selectField,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        onPress={() => setShowLanguagePicker(true)}
                      >
                        <View style={styles.selectFieldCopy}>
                          <Text
                            style={[
                              styles.selectFieldValue,
                              { color: theme.title },
                            ]}
                          >
                            {preferredLanguage}
                          </Text>
                          <Text
                            style={[
                              styles.selectFieldLabel,
                              { color: theme.muted },
                            ]}
                          >
                            {localizedProfileCopy.preferredLanguageHint}
                          </Text>
                        </View>
                        <View style={styles.selectFieldIcon}>
                          <Ionicons
                            name="chevron-down"
                            size={18}
                            color={theme.accent}
                          />
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        styles.profileCard,
                        styles.profileMiniCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {localizedProfileCopy.securityTitle}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {localizedProfileCopy.securitySubtitle}
                      </Text>
                      <View style={styles.profileActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            themeMode === "light" &&
                              styles.secondaryButtonLight,
                          ]}
                          onPress={() => {
                            setPasswordError("");
                            setPasswordSuccess("");
                            setShowPasswordModal(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              themeMode === "light" &&
                                styles.secondaryButtonTextLight,
                            ]}
                          >
                            {localizedProfileCopy.changePassword}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                  </View>
                </View>

                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.title }]}>
                    {languageCopy.helpSupport}
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: theme.faint }]}
                  >
                    {languageCopy.helpSupportSubtitle}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setInfoSheet("terms")}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {languageCopy.termsConditions}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {languageCopy.termsSubtitle}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#7DD3FC"
                      />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setInfoSheet("privacy")}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {infoContent.privacy.title}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {languageCopy.privacySubtitle}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#7DD3FC"
                      />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setInfoSheet("faq")}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {languageCopy.faq}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {languageCopy.faqSubtitle}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#7DD3FC"
                      />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setInfoSheet("about")}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {languageCopy.aboutEyeGasto}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {languageCopy.aboutSubtitle}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#7DD3FC"
                      />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={handleContactSupport}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {languageCopy.contactSupport}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {languageCopy.contactSupportSubtitle}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons name="mail-outline" size={18} color="#7DD3FC" />
                    </View>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.legalRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        {languageCopy.appVersion}
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        {formatCopy("versionLabel", { version: APP_VERSION })}
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons
                        name="information-circle-outline"
                        size={18}
                        color="#7DD3FC"
                      />
                    </View>
                  </View>
                </View>

                <Text
                  style={[styles.profileSectionLabel, { color: theme.faint }]}
                >
                  {languageCopy.session}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.logoutButton,
                    themeMode === "light" && styles.logoutButtonLight,
                  ]}
                  onPress={confirmLogout}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={16}
                    color={themeMode === "light" ? "#DC2626" : "#FCA5A5"}
                  />
                  <Text
                    style={[
                      styles.logoutButtonText,
                      themeMode === "light" && styles.logoutButtonTextLight,
                    ]}
                  >
                    {languageCopy.logout}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Animated.View>
        </ScrollView>
      </View>

      {!useSidebarNavigation ? (
        <BlurView
          intensity={26}
          tint={themeMode === "light" ? "light" : "dark"}
          style={[
            styles.bottomNav,
            isCompact && styles.bottomNavCompact,
            {
              borderColor: theme.cardBorder,
              backgroundColor: theme.cardBackground,
              bottom: bottomNavigationOffset,
            },
          ]}
        >
          {navigationItems.slice(0, 2).map((item) => {
            const active = activeTab === item.key;
            return (
              <Animated.View
                key={item.key}
                style={[
                  styles.navItemWrap,
                  active
                    ? {
                        transform: [
                          {
                            scale: contentAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.92, 1],
                            }),
                          },
                        ],
                      }
                    : undefined,
                ]}
              >
              <TouchableOpacity
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => handleBottomTabPress(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? theme.accent : theme.faint}
                />
                <Text
                  style={[
                    styles.navLabel,
                    { color: theme.faint },
                    active && styles.navLabelActive,
                    active && { color: theme.title },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
              </Animated.View>
            );
          })}

          <TouchableOpacity
            style={styles.navAddButtonWrap}
            onPress={() => {
              setQuickAddDraft(null);
              setShowAddForm(true);
            }}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={["#67E8F9", "#38BDF8", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.navAddButton}
            >
              <Ionicons name="add" size={26} color="#082F49" />
            </LinearGradient>
            <Text style={[styles.navAddLabel, { color: theme.title }]}>
              Add
            </Text>
          </TouchableOpacity>

          {navigationItems
            .filter((item) => item.key !== "profile")
            .slice(2)
            .map((item) => {
              const active = activeTab === item.key;
              return (
              <Animated.View
                key={item.key}
                style={[
                  styles.navItemWrap,
                  active
                    ? {
                        transform: [
                          {
                            scale: contentAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.92, 1],
                            }),
                          },
                        ],
                      }
                    : undefined,
                ]}
              >
              <TouchableOpacity
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => handleBottomTabPress(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? theme.accent : theme.faint}
                />
                <Text
                  style={[
                    styles.navLabel,
                    { color: theme.faint },
                    active && styles.navLabelActive,
                    active && { color: theme.title },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
              </Animated.View>
            );
          })}
        </BlurView>
      ) : null}

      <Modal
        animationType="slide"
        transparent
        visible={showAddForm}
        onRequestClose={() => {
          setShowAddForm(false);
          setQuickAddDraft(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={36}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.modalCard,
              isCompact && styles.modalCardCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.addExpenseModalCopy}>
                <Text style={[styles.modalTitle, { color: theme.title }]}>
                  {languageCopy.addExpenseTitle}
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  {languageCopy.addExpenseSubtitle}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  themeMode === "light"
                    ? styles.modalCloseButtonDangerLight
                    : { backgroundColor: theme.mutedSurface },
                ]}
                onPress={() => {
                  setShowAddForm(false);
                  setQuickAddDraft(null);
                }}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={themeMode === "light" ? "#DC2626" : theme.title}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <AddExpenseForm
                onAdd={onAddExpense}
                mode={themeMode}
                categories={categories.filter((item) => item !== "All")}
                currencyCode={preferredCurrency}
                language={renderLanguage}
                onNotify={notify}
                initialValues={quickAddDraft ?? undefined}
                onSuccess={() => {
                  setShowAddForm(false);
                  setQuickAddDraft(null);
                }}
                embedded
              />
            </ScrollView>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isEditingProfile}
        onRequestClose={() => setIsEditingProfile(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
            <BlurView
              intensity={34}
              tint={themeMode === "light" ? "light" : "dark"}
              style={[
                styles.compactFormCard,
                isCompact && styles.compactFormCardCompact,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.addExpenseModalCopy}>
                  <Text style={[styles.modalTitle, { color: theme.title }]}>
                    {languageCopy.editProfileTitle}
                  </Text>
                  <Text
                    style={[
                      styles.addExpenseModalSubtitle,
                      { color: theme.muted },
                    ]}
                  >
                    {languageCopy.editProfileSubtitle}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.modalCloseButton,
                    themeMode === "light"
                      ? styles.modalCloseButtonDangerLight
                      : { backgroundColor: theme.mutedSurface },
                  ]}
                  onPress={() => setIsEditingProfile(false)}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={themeMode === "light" ? "#DC2626" : theme.title}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.compactModalBody}>
                <TextInput
                  style={[
                    styles.profileInput,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                      color: theme.title,
                    },
                  ]}
                  placeholder={languageCopy.name}
                  placeholderTextColor={theme.faint}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  style={[
                    styles.profileInput,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                      color: theme.title,
                    },
                  ]}
                  placeholder={languageCopy.username}
                  placeholderTextColor={theme.faint}
                  value={editUsername}
                  onChangeText={(value) => setEditUsername(value.toLowerCase())}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[
                    styles.profileInput,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                      color: theme.title,
                    },
                  ]}
                  placeholder={languageCopy.email}
                  placeholderTextColor={theme.faint}
                  value={editEmail}
                  onChangeText={setEditEmail}
                />
                <View style={styles.passwordModalActions}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      themeMode === "light" && styles.secondaryButtonLight,
                    ]}
                    onPress={() => {
                      setEditName(user.name);
                      setEditUsername(user.username ?? "");
                      setEditEmail(user.email);
                      setIsEditingProfile(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        themeMode === "light" &&
                          styles.secondaryButtonTextLight,
                      ]}
                    >
                      {languageCopy.cancel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSaveProfile}
                  >
                    <Text style={styles.primaryButtonText}>{languageCopy.save}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={confirmationDialog.visible}
        onRequestClose={closeConfirmationDialog}
      >
        <View
          style={[
            styles.modalBackdrop,
            isCompact && styles.infoModalBackdropCompact,
          ]}
        >
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.infoCard,
              isCompact && styles.infoCardCompact,
              isCompact && styles.infoCardBottomSheet,
              isCompact && styles.confirmationSheetCompact,
              {
                backgroundColor: isCompact
                  ? themeMode === "light"
                    ? "rgba(255,255,255,0.98)"
                    : "rgba(9,14,28,0.98)"
                  : theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.confirmationDialogCopy,
                isCompact && styles.confirmationDialogCopyCompact,
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.title }]}>
                {confirmationDialog.title}
              </Text>
              <Text style={[styles.infoBody, { color: theme.text }]}>
                {confirmationDialog.message}
              </Text>
            </View>

            <View
              style={[
                styles.modalFooter,
                isCompact && styles.modalActionsStack,
                isCompact && styles.confirmationModalFooterCompact,
                { borderTopColor: theme.cardBorder },
              ]}
            >
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    isCompact && styles.confirmationSecondaryButtonCompact,
                    themeMode === "light" && styles.secondaryButtonLight,
                  ]}
                  onPress={closeConfirmationDialog}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    themeMode === "light" && styles.secondaryButtonTextLight,
                  ]}
                >
                  {languageCopy.cancel}
                </Text>
              </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmationPrimaryButton,
                    isCompact && styles.confirmationPrimaryButtonCompact,
                    confirmationDialog.tone === "danger"
                      ? styles.confirmationPrimaryButtonDanger
                      : styles.primaryButton,
                ]}
                onPress={handleConfirmationSubmit}
              >
                <Text
                  style={[
                    confirmationDialog.tone === "danger"
                      ? styles.confirmationPrimaryButtonDangerText
                      : styles.primaryButtonText,
                  ]}
                >
                  {confirmationDialog.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showCurrencyPicker}
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.infoCard,
              styles.pickerInfoCard,
              isCompact && styles.infoCardCompact,
              isCompact && styles.pickerInfoCardCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.addExpenseModalCopy}>
                <Text style={[styles.modalTitle, { color: theme.title }]}>
                  {languageCopy.chooseCurrency}
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  {languageCopy.chooseCurrencySubtitle}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  themeMode === "light"
                    ? styles.modalCloseButtonDangerLight
                    : { backgroundColor: theme.mutedSurface },
                ]}
                onPress={() => setShowCurrencyPicker(false)}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={themeMode === "light" ? "#DC2626" : theme.title}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.currencyOptionsList}
              showsVerticalScrollIndicator={false}
            >
              {SUPPORTED_CURRENCIES.map((item) => {
                const selected = preferredCurrency === item.code;

                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[
                      styles.currencyOptionRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                      selected && styles.currencyOptionRowActive,
                    ]}
                    onPress={() => {
                      setPreferredCurrency(item.code);
                      setShowCurrencyPicker(false);
                    }}
                  >
                    <View style={styles.currencyOptionCopy}>
                      <Text
                        style={[
                          styles.currencyOptionCode,
                          { color: theme.title },
                          selected && styles.currencyOptionCodeActive,
                        ]}
                      >
                        {item.code}
                      </Text>
                      <Text
                        style={[
                          styles.currencyOptionLabel,
                          { color: theme.muted },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.accent}
                        style={styles.currencyOptionIcon}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={18}
                        color={theme.faint}
                        style={styles.currencyOptionIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showLanguagePicker}
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={[styles.modalBackdrop, styles.pickerModalBackdrop]}>
          <Animated.View
            style={[
              styles.modalAnimatedWrap,
              styles.pickerAnimatedWrap,
              modalAnimatedStyle,
            ]}
          >
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.pickerSheet,
              isCompact && styles.pickerSheetCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.addExpenseModalCopy}>
                <Text style={[styles.modalTitle, { color: theme.title }]}>
                  {localizedProfileCopy.chooseLanguageTitle}
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  {localizedProfileCopy.chooseLanguageSubtitle}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  themeMode === "light"
                    ? styles.modalCloseButtonDangerLight
                    : { backgroundColor: theme.mutedSurface },
                ]}
                onPress={() => setShowLanguagePicker(false)}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={themeMode === "light" ? "#DC2626" : theme.title}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerOptionsList}>
              {LANGUAGE_OPTIONS.map((item) => {
                const selected = preferredLanguage === item.key;

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.pickerOptionRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                      selected && styles.currencyOptionRowActive,
                    ]}
                    onPress={() => {
                      setPreferredLanguage(item.key);
                      onLanguageChange?.(item.key);
                      setShowLanguagePicker(false);
                    }}
                  >
                    <View style={styles.pickerOptionCopy}>
                      <Text
                        style={[
                          styles.pickerOptionCode,
                          { color: theme.title },
                          selected && styles.currencyOptionCodeActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.pickerOptionLabel,
                          { color: theme.muted },
                        ]}
                      >
                        {item.nativeLabel}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.accent}
                        style={styles.pickerOptionIcon}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={18}
                        color={theme.faint}
                        style={styles.pickerOptionIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showDateRangePicker}
        onRequestClose={() => setShowDateRangePicker(false)}
      >
        <View style={[styles.modalBackdrop, styles.pickerModalBackdrop]}>
          <Animated.View
            style={[
              styles.modalAnimatedWrap,
              styles.pickerAnimatedWrap,
              modalAnimatedStyle,
            ]}
          >
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.pickerSheet,
              isCompact && styles.pickerSheetCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.addExpenseModalCopy}>
                <Text style={[styles.modalTitle, { color: theme.title }]}>
                  {languageCopy.activityRangeTitle}
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  {languageCopy.activityRangeSubtitle}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  themeMode === "light"
                    ? styles.modalCloseButtonDangerLight
                    : { backgroundColor: theme.mutedSurface },
                ]}
                onPress={() => setShowDateRangePicker(false)}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={themeMode === "light" ? "#DC2626" : theme.title}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerOptionsList}>
              {activityRangeOptions.map((option) => {
                const selected = dateRange === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.pickerOptionRow,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                      selected && styles.currencyOptionRowActive,
                    ]}
                    onPress={() => {
                      setDateRange(option.key);
                      setShowDateRangePicker(false);
                    }}
                  >
                    <View style={styles.pickerOptionCopy}>
                      <Text
                        style={[
                          styles.pickerOptionCode,
                          { color: theme.title },
                          selected && styles.currencyOptionCodeActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.accent}
                        style={styles.pickerOptionIcon}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={18}
                        color={theme.faint}
                        style={styles.pickerOptionIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showPasswordModal}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
            <BlurView
              intensity={34}
              tint={themeMode === "light" ? "light" : "dark"}
              style={[
                styles.compactFormCard,
                isCompact && styles.compactFormCardCompact,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.addExpenseModalCopy}>
                  <Text style={[styles.modalTitle, { color: theme.title }]}>
                    {languageCopy.changePasswordTitle}
                  </Text>
                  <Text
                    style={[
                      styles.addExpenseModalSubtitle,
                      { color: theme.muted },
                    ]}
                  >
                    {languageCopy.changePasswordSubtitle}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.modalCloseButton,
                    themeMode === "light"
                      ? styles.modalCloseButtonDangerLight
                      : { backgroundColor: theme.mutedSurface },
                  ]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={themeMode === "light" ? "#DC2626" : theme.title}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.compactModalBody}>
                <View
                  style={[
                    styles.passwordCard,
                    styles.passwordModalCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {passwordSuccess ? (
                    <Text
                      style={[
                        styles.passwordSuccess,
                        themeMode === "light" && styles.passwordSuccessLight,
                      ]}
                    >
                      {passwordSuccess}
                    </Text>
                  ) : null}
                  {passwordError ? (
                    <Text
                      style={[
                        styles.passwordError,
                        themeMode === "light" && styles.passwordErrorLight,
                      ]}
                    >
                      {passwordError}
                    </Text>
                  ) : null}
                  <TextInput
                    style={[
                      styles.profileInput,
                      styles.passwordModalInput,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                        color: theme.title,
                      },
                    ]}
                    placeholder={languageCopy.currentPassword}
                    placeholderTextColor={theme.faint}
                    secureTextEntry
                    value={oldPassword}
                    onChangeText={setOldPassword}
                  />
                  <TextInput
                    style={[
                      styles.profileInput,
                      styles.passwordModalInput,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                        color: theme.title,
                      },
                    ]}
                    placeholder={languageCopy.newPassword}
                    placeholderTextColor={theme.faint}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TextInput
                    style={[
                      styles.profileInput,
                      styles.passwordModalInput,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                        color: theme.title,
                      },
                    ]}
                    placeholder={languageCopy.confirmNewPassword}
                    placeholderTextColor={theme.faint}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <View style={styles.passwordModalActions}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        themeMode === "light" && styles.secondaryButtonLight,
                      ]}
                      onPress={() => setShowPasswordModal(false)}
                    >
                      <Text
                        style={[
                          styles.secondaryButtonText,
                          themeMode === "light" &&
                            styles.secondaryButtonTextLight,
                        ]}
                      >
                        {languageCopy.cancel}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleChangePassword}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <ActivityIndicator size="small" color="#020617" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          {languageCopy.updatePassword}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </BlurView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showExportOptions}
        onRequestClose={() => setShowExportOptions(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.title }]}>
              {languageCopy.exportOptions}
            </Text>
            <Text style={[styles.infoBody, { color: theme.text }]}>
              {languageCopy.exportOptionsSubtitle}
            </Text>

            <View style={styles.exportOptionsStack}>
              {[
                {
                  key: "csv" as const,
                  icon: "grid-outline" as const,
                  title: languageCopy.csvSpreadsheet,
                  subtitle: languageCopy.csvSpreadsheetSubtitle,
                },
                {
                  key: "pdf" as const,
                  icon: "document-outline" as const,
                  title: languageCopy.pdfReport,
                  subtitle: languageCopy.pdfReportSubtitle,
                },
                {
                  key: "summary" as const,
                  icon: "document-text-outline" as const,
                  title: languageCopy.summaryReport,
                  subtitle: languageCopy.summaryReportSubtitle,
                },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.exportOptionCard,
                    {
                      backgroundColor: theme.mutedSurface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => handleExportReport(option.key)}
                  disabled={isExporting}
                >
                  <Ionicons name={option.icon} size={18} color={theme.accent} />
                  <View style={styles.exportOptionCopy}>
                    <Text
                      style={[styles.exportOptionTitle, { color: theme.title }]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.exportOptionSubtitle,
                        { color: theme.muted },
                      ]}
                    >
                      {option.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowExportOptions(false)}
            >
              <Text style={styles.secondaryButtonText}>{languageCopy.close}</Text>
            </TouchableOpacity>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedReceipt)}
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setSelectedReceipt(null)}
          >
            <Ionicons name="close" size={22} color="#F8FAFC" />
          </TouchableOpacity>

          {selectedReceipt?.imageUrl ? (
            <Image
              source={{ uri: selectedReceipt.imageUrl }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          ) : null}

          {selectedReceipt ? (
            <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
            <BlurView intensity={32} tint="dark" style={styles.viewerInfo}>
              <Text style={styles.viewerTitle}>
                {selectedReceipt.description}
              </Text>
              <Text style={styles.viewerMeta}>
                {formatAmount(selectedReceipt.amount)} {"-"}{" "}
                {getCategoryDisplayLabel(selectedReceipt.category)}
              </Text>
              <Text style={styles.viewerMeta}>
                {new Date(selectedReceipt.date).toLocaleString()}
              </Text>
              {selectedReceipt.notes ? (
                <Text style={styles.viewerNotes}>{selectedReceipt.notes}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setSelectedReceipt(null);
                  startEditingExpense(selectedReceipt);
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {languageCopy.editExpenseAction}
                </Text>
              </TouchableOpacity>
            </BlurView>
            </Animated.View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(editingExpense)}
        onRequestClose={closeEditingExpense}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={36}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.modalCard,
              isCompact && styles.modalCardCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.title }]}>
                {languageCopy.editExpenseTitle}
              </Text>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  themeMode === "light"
                    ? styles.modalCloseButtonDangerLight
                    : { backgroundColor: theme.mutedSurface },
                ]}
                onPress={closeEditingExpense}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={themeMode === "light" ? "#DC2626" : theme.title}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: theme.mutedSurface,
                    borderColor: theme.cardBorder,
                    color: theme.title,
                  },
                ]}
                placeholder={languageCopy.description}
                placeholderTextColor={theme.faint}
                value={editDescription}
                onChangeText={setEditDescription}
              />
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: theme.mutedSurface,
                    borderColor: theme.cardBorder,
                    color: theme.title,
                  },
                ]}
                placeholder={languageCopy.amount}
                placeholderTextColor={theme.faint}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              />
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: theme.mutedSurface,
                    borderColor: theme.cardBorder,
                    color: theme.title,
                  },
                ]}
                placeholder={languageCopy.category}
                placeholderTextColor={theme.faint}
                value={editCategory}
                onChangeText={setEditCategory}
              />
              <TextInput
                style={[
                  styles.profileInput,
                  styles.modalNotes,
                  {
                    backgroundColor: theme.mutedSurface,
                    borderColor: theme.cardBorder,
                    color: theme.title,
                  },
                ]}
                placeholder={languageCopy.notes}
                placeholderTextColor={theme.faint}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.legalRow,
                  {
                    backgroundColor: theme.mutedSurface,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={pickExpenseReceipt}
              >
                <View>
                  <Text style={[styles.legalTitle, { color: theme.title }]}>
                    {languageCopy.receiptImage}
                  </Text>
                  <Text style={[styles.legalSubtitle, { color: theme.muted }]}>
                    {languageCopy.uploadReceiptSubtitle}
                  </Text>
                </View>
                <Ionicons name="image-outline" size={18} color="#7DD3FC" />
              </TouchableOpacity>

              {editImageUrl ? (
                <TouchableOpacity
                  style={styles.editReceiptPreview}
                  activeOpacity={0.9}
                  onPress={() =>
                    editingExpense
                      ? setSelectedReceipt({
                          ...editingExpense,
                          description:
                            editDescription.trim() ||
                            editingExpense.description,
                          amount:
                            Number.parseFloat(editAmount) > 0
                              ? Number.parseFloat(editAmount)
                              : editingExpense.amount,
                          category:
                            editCategory.trim() || editingExpense.category,
                          notes: editNotes.trim() || editingExpense.notes,
                          imageUrl: editImageUrl,
                        })
                      : null
                  }
                >
                  <Image
                    source={{ uri: editImageUrl }}
                    style={styles.editReceiptImage}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.editReceiptRemove}
                    onPress={() => setEditImageUrl(null)}
                  >
                    <Ionicons name="close" size={16} color="#F8FAFC" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                isVeryCompact && styles.modalActionsStack,
                { borderTopColor: theme.cardBorder },
              ]}
            >
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={closeEditingExpense}
                disabled={isSavingEdit}
              >
                <Text style={styles.secondaryButtonText}>
                  {languageCopy.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                <Text style={styles.primaryButtonText}>
                  {isSavingEdit ? languageCopy.saving : languageCopy.saveChanges}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(infoSheet)}
        onRequestClose={() => setInfoSheet(null)}
      >
        <View
          style={[
            styles.modalBackdrop,
            isCompact && styles.infoModalBackdropCompact,
          ]}
        >
          <Animated.View style={[styles.modalAnimatedWrap, modalAnimatedStyle]}>
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.infoCard,
              isCompact && styles.infoCardCompact,
              isCompact && styles.infoCardBottomSheet,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.title }]}>
              {infoSheet ? infoContent[infoSheet].title : ""}
            </Text>
            <ScrollView
              style={styles.infoBodyScroll}
              contentContainerStyle={styles.infoBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {infoSheet === "faq" ? (
                <View style={styles.infoStack}>
                  {infoContent.faq.items.map((item, index) => {
                    const expanded = expandedFaqIndex === index;

                    return (
                      <TouchableOpacity
                        key={item.question}
                        style={[
                          styles.infoSectionCard,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        activeOpacity={0.88}
                        onPress={() =>
                          setExpandedFaqIndex((current) =>
                            current === index ? null : index,
                          )
                        }
                      >
                        <View style={styles.infoQuestionRow}>
                          <Text
                            style={[
                              styles.infoSectionTitle,
                              { color: theme.title },
                            ]}
                          >
                            {item.question}
                          </Text>
                          <Ionicons
                            name={expanded ? "remove-outline" : "add-outline"}
                            size={18}
                            color={theme.accent}
                          />
                        </View>
                        {expanded ? (
                          <Animated.View
                            style={{
                              opacity: modalAnim,
                              transform: [
                                {
                                  translateY: modalAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [8, 0],
                                  }),
                                },
                              ],
                            }}
                          >
                            <Text
                              style={[
                                styles.infoSectionBody,
                                { color: theme.text },
                              ]}
                            >
                              {item.answer}
                            </Text>
                          </Animated.View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : infoSheet ? (
                <View style={styles.infoStack}>
                  {infoContent[infoSheet].sections.map((section) => {
                    const sectionKey = `${infoSheet}-${section.heading}`;
                    const expanded = expandedInfoSectionKey === sectionKey;

                    return (
                      <TouchableOpacity
                        key={section.heading}
                        style={[
                          styles.infoSectionCard,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        activeOpacity={0.88}
                        onPress={() =>
                          setExpandedInfoSectionKey((current) =>
                            current === sectionKey ? null : sectionKey,
                          )
                        }
                      >
                        <View style={styles.infoQuestionRow}>
                          <Text
                            style={[
                              styles.infoSectionTitle,
                              { color: theme.title },
                            ]}
                          >
                            {section.heading}
                          </Text>
                          <Ionicons
                            name={expanded ? "remove-outline" : "add-outline"}
                            size={18}
                            color={theme.accent}
                          />
                        </View>
                        {expanded ? (
                          <Animated.View
                            style={{
                              opacity: modalAnim,
                              transform: [
                                {
                                  translateY: modalAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [8, 0],
                                  }),
                                },
                              ],
                            }}
                          >
                            <Text
                              style={[styles.infoSectionBody, { color: theme.text }]}
                            >
                              {section.body}
                            </Text>
                          </Animated.View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setInfoSheet(null)}
            >
              <Text style={styles.primaryButtonText}>{languageCopy.close}</Text>
            </TouchableOpacity>
          </BlurView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  backgroundOrbOne: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    bottom: 120,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(99, 102, 241, 0.06)",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 22 : 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 12,
  },
  headerActionsCompact: {
    width: "100%",
    justifyContent: "space-between",
    alignItems: "stretch",
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 8,
  },
  headerActionsNativeCompact: {
    width: "100%",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "stretch",
    flexWrap: "nowrap",
    rowGap: 8,
    columnGap: 8,
  },
  headerActionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  headerActionTopRowCompact: {
    width: "100%",
    justifyContent: "space-between",
    gap: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerLeftCompact: {
    width: "100%",
    flex: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    alignSelf: "stretch",
    gap: 10,
  },
  headerBrandBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 0,
    backgroundColor: "transparent",
    flexShrink: 0,
  },
  headerBrandBadgeFill: {
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrandLogo: {
    width: 50,
    height: 50,
  },
  headerBrandCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  headerBrandCopyCompact: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#F8FAFC",
    flexShrink: 1,
  },
  headerTitleCompact: { fontSize: 20 },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    flexShrink: 1,
  },
  headerSubtitleCompact: {
    textAlign: "left",
    maxWidth: "100%",
  },
  headerBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  headerClockCard: {
    minWidth: 150,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  headerClockCardCompact: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerClockCardNativeCompact: {
    flex: 1,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerClockTime: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  headerClockDate: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },
  syncStatusPill: {
    minHeight: 52,
    minWidth: 178,
    maxWidth: 230,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  syncStatusToast: {
    alignSelf: "stretch",
    zIndex: 20,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 12,
  },
  syncStatusPillCompact: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  syncStatusPillNativeCompact: {
    width: "100%",
    flexGrow: 0,
    flexBasis: "auto",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  syncStatusTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  syncStatusTitle: {
    fontSize: 12,
    fontWeight: "900",
  },
  syncStatusSubtitle: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  headerProfileButton: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerProfileButtonCompact: {
    width: "100%",
    minWidth: 0,
    minHeight: 46,
    justifyContent: "center",
  },
  headerProfileButtonNativeCompact: {
    width: 56,
    height: 56,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 0,
    justifyContent: "center",
    flexShrink: 0,
  },
  headerProfileButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  themeToggle: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  headerAddButton: {
    borderRadius: 999,
    overflow: "hidden",
    ...createShadow("0px 10px 18px rgba(56, 189, 248, 0.22)", {
      shadowColor: "#38BDF8",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 6,
    }),
  },
  headerAddButtonFill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerAddButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#082F49",
  },
  themeToggleCompact: {
    marginTop: 4,
    alignSelf: "flex-end",
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#020617", fontWeight: "900" },
  dashboardShell: {
    flex: 1,
  },
  dashboardShellWeb: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sideNav: {
    width: 220,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    alignSelf: "flex-start",
    gap: 18,
  },
  sideNavIntro: {
    gap: 12,
  },
  sideNavBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.16)",
    backgroundColor: "rgba(8, 15, 30, 0.42)",
  },
  sideNavBrandBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 0,
    backgroundColor: "transparent",
  },
  sideNavBrandBadgeFill: {
    flex: 1,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sideNavBrandLogo: {
    width: 50,
    height: 50,
  },
  sideNavBrandCopy: {
    flex: 1,
    justifyContent: "center",
  },
  sideNavBrandText: {
    fontSize: 18,
    fontWeight: "900",
  },
  sideNavTitle: {
    fontSize: 19,
    fontWeight: "900",
  },
  sideNavSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  sideNavItems: {
    gap: 10,
  },
  sideNavItem: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sideNavLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  scroll: { flex: 1 },
  scrollWeb: {
    flex: 1,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  scrollContentCompact: {
    paddingBottom: 252,
  },
  scrollContentProfile: {
    paddingTop: 8,
    paddingBottom: 156,
  },
  scrollContentProfileCompact: {
    paddingTop: 16,
    paddingBottom: 188,
  },
  scrollContentWeb: {
    paddingHorizontal: 0,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(8, 15, 30, 0.84)",
  },
  heroEyebrow: {
    fontSize: 11,
    color: "#7DD3FC",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    color: "#F8FAFC",
    maxWidth: 560,
  },
  heroSubtitle: {
    marginTop: 8,
    maxWidth: 400,
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
  },
  guideCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  guideCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  guideCardCopy: {
    flex: 1,
  },
  guideStepStack: {
    marginTop: 16,
    gap: 10,
  },
  guideStepCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  guideStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.16)",
  },
  guideStepBadgeText: {
    color: "#67E8F9",
    fontSize: 12,
    fontWeight: "900",
  },
  guideStepCopy: {
    flex: 1,
  },
  guideStepTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  guideStepBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
  },
  guideActionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  addPanel: { marginTop: 16 },
  filterShell: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  filterRangeButton: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 74,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  filterRangeButtonCopy: {
    flex: 1,
    minWidth: 0,
  },
  filterRangeButtonTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 24,
    flexShrink: 1,
  },
  filterRangeButtonSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 20,
    flexShrink: 1,
  },
  filterChipRow: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  filterChipActive: {
    backgroundColor: "rgba(34, 211, 238, 0.14)",
    borderColor: "rgba(34, 211, 238, 0.28)",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: "#CFFAFE",
  },
  filterChipTextActiveLight: {
    color: "#0F766E",
  },
  panel: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(8, 15, 30, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  panelHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  panelHeaderStack: {
    flexDirection: "column",
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#F8FAFC" },
  sectionTitleLarge: { fontSize: 22, fontWeight: "900", color: "#F8FAFC" },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    maxWidth: 520,
  },
  iconToggle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.92)",
    borderWidth: 1,
    ...createShadow("0px 8px 16px rgba(34, 211, 238, 0.2)", {
      shadowColor: "#22D3EE",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 6,
    }),
  },
  quickAddRow: { paddingTop: 12, gap: 10, paddingBottom: 4 },
  recurringPlansWrap: {
    marginTop: 18,
  },
  recurringPlansList: {
    marginTop: 12,
    gap: 10,
  },
  recurringPlanCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recurringPlanCopy: {
    flex: 1,
  },
  recurringPlanTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  recurringPlanMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  recurringPlanRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127, 29, 29, 0.24)",
  },
  quickAddChip: {
    width: 148,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    ...createShadow("0px 10px 20px rgba(2, 6, 23, 0.12)", {
      shadowColor: "#020617",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 4,
    }),
  },
  quickAddChipTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  quickAddChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAddChipLabel: { fontSize: 14, fontWeight: "700", color: "#F8FAFC" },
  quickAddChipMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  quickAddChipAmount: {
    marginTop: 12,
    fontSize: 18,
    color: "#F8FAFC",
    fontWeight: "900",
  },
  statsSkeletonCard: {
    width: "100%",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
      web: {
        width: "31%",
        minWidth: 196,
      } as object,
    }),
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statsGridCompact: {
    gap: 0,
  },
  budgetShell: {
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.06)",
  },
  overviewBudgetShell: {
    gap: 12,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  budgetHeaderStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  overviewBudgetHeader: {
    alignItems: "stretch",
  },
  budgetBlock: { flex: 1 },
  budgetSummary: { alignItems: "flex-end" },
  overviewBudgetSummary: {
    minWidth: 180,
  },
  budgetSummaryCompact: {
    alignItems: "flex-start",
    marginTop: 8,
  },
  overviewBudgetShortcutButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  overviewBudgetShortcutButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  budgetInput: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    color: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  budgetValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  budgetTrack: {
    marginTop: 16,
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(30, 41, 59, 0.9)",
  },
  budgetFill: { height: "100%", borderRadius: 999 },
  budgetMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  budgetMetaRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  budgetMetaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  budgetMetaTextCompact: {
    flexShrink: 1,
  },
  budgetMetricsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  budgetMetricCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  budgetMetricCardSingle: {
    minWidth: "100%",
  },
  budgetMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  budgetMetricValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "900",
  },
  budgetAlertCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  budgetAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  budgetAlertTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  budgetAlertText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  budgetAlertDanger: {},
  budgetAlertWarning: {},
  budgetAlertSuccess: {},
  budgetAlertNeutral: {},
  budgetPlannerLoading: {
    marginTop: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetPlannerStatRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  budgetPlannerSectionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  budgetPlannerStackCompact: {
    flexDirection: "column",
    gap: 0,
    flexWrap: "nowrap",
    width: "100%",
    alignItems: "stretch",
  },
  budgetPlannerStatCard: {
    flex: 1,
    minWidth: 210,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: "space-between",
    minHeight: 144,
  },
  budgetPlannerStatLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  budgetPlannerStatValue: {
    marginTop: 10,
    fontSize: 40,
    fontWeight: "900",
  },
  budgetPlannerStatHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  budgetPlannerFormCard: {
    flex: 1,
    minWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 2,
  },
  budgetPlannerCardCompact: {
    flex: 0,
    flexBasis: "auto",
    minWidth: 0,
    width: "100%",
    padding: 16,
    marginTop: 12,
  },
  budgetPlannerInput: {
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#F8FAFC",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  budgetPlannerPicker: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetPlannerPickerText: {
    fontSize: 17,
    fontWeight: "700",
  },
  budgetPlannerCategoryMenu: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 220,
  },
  budgetPlannerCategoryMenuScroll: {
    flexGrow: 0,
  },
  budgetPlannerCategoryMenuContent: {
    paddingVertical: 4,
  },
  budgetPlannerCategoryOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetPlannerCategoryOptionActive: {
    backgroundColor: "rgba(34, 211, 238, 0.1)",
  },
  budgetPlannerCategoryOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  budgetPlannerPrimaryButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#7DD3FC",
  },
  budgetPlannerPrimaryButtonCompact: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  budgetPlannerPrimaryButtonText: {
    color: "#082F49",
    fontSize: 16,
    fontWeight: "900",
  },
  budgetPlannerNoteInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  budgetPlannerListCard: {
    flex: 1,
    minWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  budgetPlannerListRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  budgetPlannerListRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  budgetPlannerListCopy: {
    flex: 1,
    gap: 4,
  },
  budgetPlannerListTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  budgetPlannerListMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  budgetPlannerBudgetTrack: {
    marginTop: 2,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  budgetPlannerBudgetFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 6,
  },
  budgetPlannerBudgetCaption: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  budgetPlannerRowActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  budgetPlannerRowActionsCompact: {
    width: "100%",
    alignItems: "stretch",
  },
  budgetPlannerActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  budgetPlannerPaidText: {
    fontSize: 12,
    fontWeight: "800",
  },
  budgetPlannerDeleteText: {
    fontSize: 12,
    fontWeight: "800",
  },
  budgetPlannerPaidTag: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  workspaceRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  workspaceColumn: {
    flexDirection: "column",
    flexWrap: "nowrap",
    width: "100%",
    alignItems: "stretch",
  },
  recentPanel: { flex: 2, minWidth: 320 },
  signalPanel: { flex: 1, minWidth: 280 },
  overviewPanelCompact: {
    flex: 0,
    minWidth: 0,
    width: "100%",
  },
  overviewStackWrapper: {
    width: "100%",
    gap: 16,
  },
  overviewStackPanel: {
    flex: 0,
    minWidth: 0,
    width: "100%",
    alignSelf: "stretch",
    overflow: "visible",
    position: "relative",
  },
  fullWidthPanel: { minWidth: "100%", width: "100%", flex: 0 },
  clearButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(127, 29, 29, 0.18)",
  },
  clearButtonAligned: {
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  clearButtonText: { color: "#FCA5A5", fontWeight: "700" },
  clearButtonLight: {
    backgroundColor: "rgba(254, 226, 226, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.34)",
  },
  clearButtonTextLight: {
    color: "#DC2626",
  },
  searchInput: {
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#F8FAFC",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  categoryRow: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    alignItems: "center",
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    flexShrink: 0,
  },
  categoryChipFixed: {
    minWidth: 88,
  },
  categoryChipActive: {
    backgroundColor: "rgba(34, 211, 238, 0.14)",
    borderColor: "rgba(34, 211, 238, 0.24)",
  },
  categoryChipText: { color: "#94A3B8", fontWeight: "700" },
  categoryChipTextActive: { color: "#CFFAFE" },
  categoryChipTextActiveLight: { color: "#0F766E" },
  showAllButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  showAllButtonText: { color: "#7DD3FC", fontWeight: "700" },
  signalCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 15,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  signalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  signalValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  signalMeta: { marginTop: 6, fontSize: 12, color: "#94A3B8" },
  skeletonBlock: {
    borderRadius: 999,
    marginBottom: 10,
  },
  skeletonStack: {
    marginTop: 12,
    gap: 10,
  },
  skeletonExpenseCard: {
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonExpenseCopy: {
    flex: 1,
  },
  skeletonExpenseMeta: {
    alignItems: "flex-end",
  },
  statsSummaryRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statsSummaryCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  statsSummaryLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  statsSummaryValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  exportButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  exportOptionsStack: {
    gap: 10,
    marginBottom: 16,
  },
  exportOptionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  exportOptionCopy: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  exportOptionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  trendHighlightCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  trendMomentumCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  statsInsightsCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  statsInsightGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statsInsightGridStack: {
    flexDirection: "column",
  },
  statsInsightTile: {
    flex: 1,
    minWidth: 180,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  statsInsightIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  statsInsightLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  statsInsightValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },
  statsInsightMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  momentumWindowSwitch: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: 4,
    gap: 6,
  },
  momentumWindowOption: {
    minWidth: 64,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  momentumWindowOptionActive: {
    backgroundColor: "#7DD3FC",
    ...createShadow("0px 8px 14px rgba(56, 189, 248, 0.22)", {
      shadowColor: "#38BDF8",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 6,
    }),
  },
  momentumWindowOptionText: {
    fontSize: 16,
    fontWeight: "900",
  },
  trendChartShell: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    position: "relative",
  },
  trendAxisLabels: {
    position: "absolute",
    left: 8,
    top: 20,
    bottom: 50,
    justifyContent: "space-between",
    alignItems: "flex-start",
    pointerEvents: "none",
  },
  trendAxisValue: {
    fontSize: 11,
    fontWeight: "800",
  },
  trendXAxis: {
    marginTop: 2,
    height: 18,
    position: "relative",
  },
  trendXAxisLabel: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  trendXAxisLabelAbsolute: {
    position: "absolute",
    width: 48,
    marginLeft: -24,
  },
  analyticsHeroCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 16,
  },
  analyticsHeroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  analyticsHeroCopy: {
    flex: 1,
  },
  analyticsSummaryCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  analyticsHeroValue: {
    marginTop: 10,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    textAlign: "center",
  },
  analyticsTrendIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsGaugeCaption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  analyticsTrendMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
  },
  analyticsInfoGrid: {
    marginTop: 6,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  analyticsInfoGridStack: {
    flexDirection: "column",
  },
  analyticsInfoCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
  },
  analyticsHeroStatLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  analyticsHeroStatValue: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30,
  },
  analyticsInfoValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  analyticsInfoMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  analyticsFeatureRow: {
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  analyticsFeatureRowStack: {
    alignItems: "flex-start",
  },
  analyticsFeatureCopy: {
    flex: 1,
    minWidth: 0,
  },
  analyticsFeatureLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  analyticsFeatureTitle: {
    fontSize: 15,
    fontWeight: "900",
    flexShrink: 1,
  },
  analyticsFeatureMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },
  analyticsFeatureValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  analyticsReceiptWrap: {
    minWidth: 118,
    alignItems: "flex-end",
    gap: 8,
  },
  analyticsReceiptTrack: {
    width: 118,
    height: 16,
    borderRadius: 999,
    overflow: "hidden",
  },
  analyticsReceiptFill: {
    height: "100%",
    borderRadius: 999,
  },
  analyticsReceiptValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  budgetImpactCard: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  budgetImpactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  budgetImpactHeaderStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  budgetImpactCopy: {
    flex: 1,
    minWidth: 0,
  },
  budgetImpactBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: "flex-start",
  },
  budgetImpactBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  budgetImpactGauge: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  budgetImpactGaugeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  budgetImpactAmount: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  budgetImpactTrack: {
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
  },
  budgetImpactFill: {
    height: "100%",
    borderRadius: 999,
  },
  budgetImpactMetricGrid: {
    flexDirection: "row",
    gap: 12,
  },
  budgetImpactMetricGridStack: {
    flexDirection: "column",
  },
  budgetImpactMetric: {
    flex: 1,
    minWidth: 120,
  },
  budgetImpactMetricLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  budgetImpactMetricValue: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  budgetWatchTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "900",
  },
  budgetWatchList: {
    gap: 10,
  },
  budgetWatchRow: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  budgetWatchRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  budgetWatchCategory: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "900",
  },
  budgetWatchAmount: {
    fontSize: 12,
    fontWeight: "800",
  },
  budgetWatchTrack: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  budgetWatchFill: {
    height: "100%",
    borderRadius: 999,
  },
  budgetWatchMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  categoryBreakdownCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  categoryPieWrap: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  categoryPieLegend: {
    flex: 1,
    minWidth: 160,
    gap: 8,
  },
  categoryPieLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryPieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryPieLegendText: {
    fontSize: 12,
    fontWeight: "700",
  },
  categoryBreakdownList: {
    marginTop: 14,
    gap: 12,
  },
  categoryBreakdownRow: {
    gap: 8,
  },
  categoryBreakdownTouchable: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  categoryBreakdownCopy: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  categoryBreakdownLabel: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  categoryBreakdownValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  categoryBreakdownTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  categoryBreakdownFill: {
    height: "100%",
    borderRadius: 999,
  },
  categoryDrilldownCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  categoryDrilldownHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  categoryDrilldownHeaderStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  categoryDrilldownCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryDrilldownBadge: {
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryDrilldownBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  categoryDrilldownMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  categoryDrilldownList: {
    gap: 10,
  },
  categoryDrilldownRow: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryDrilldownExpenseCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryDrilldownExpenseTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  categoryDrilldownExpenseMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  categoryDrilldownAmount: {
    fontSize: 14,
    fontWeight: "900",
  },
  graphShell: {
    marginTop: 18,
    minHeight: 340,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(2, 6, 23, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.06)",
    gap: 14,
  },
  graphScrollContent: {
    paddingRight: 8,
  },
  graphShellCompact: {
    minWidth: 560,
  },
  graphHeader: {
    gap: 2,
    marginBottom: 4,
  },
  graphTitle: {
    fontSize: 24,
    fontWeight: "900",
  },
  graphSubtitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  graphBody: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    minHeight: 270,
  },
  graphYAxis: {
    width: 78,
    justifyContent: "space-between",
    paddingBottom: 28,
    paddingTop: 4,
  },
  graphAxisLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  graphPlotArea: {
    flex: 1,
    justifyContent: "space-between",
    position: "relative",
    paddingBottom: 8,
  },
  graphGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  graphBenchmarkLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
    zIndex: 1,
  },
  graphColumnsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
    paddingTop: 20,
  },
  graphColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  graphColumnCompact: {
    minWidth: 88,
  },
  graphColumnCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 72,
  },
  graphValue: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  graphBarShell: {
    width: "100%",
    maxWidth: 84,
    height: 220,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  graphBar: {
    width: "100%",
    borderRadius: 18,
    ...createShadow("0px 10px 18px rgba(56, 189, 248, 0.28)", {
      shadowColor: "#38BDF8",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
      elevation: 7,
    }),
  },
  graphLabel: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center",
  },
  emptyGraphText: {
    marginTop: 18,
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 22,
  },
  galleryCountBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  galleryCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  galleryGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  galleryCard: {
    width: "31%",
    minWidth: 180,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
  },
  galleryCardCompact: {
    width: "100%",
  },
  galleryImageWrap: {
    position: "relative",
  },
  galleryImage: {
    width: "100%",
    height: 150,
    borderRadius: 14,
  },
  galleryImageOverlay: {
    position: "absolute",
    inset: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  galleryOverlayBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    maxWidth: "58%",
  },
  galleryOverlayBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  galleryOverlayAmount: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    marginLeft: 10,
  },
  galleryOverlayAmountText: {
    fontSize: 11,
    fontWeight: "900",
  },
  galleryTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "800",
  },
  galleryMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  profileCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  profileSectionLabel: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  profileSectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  profileSectionGridCompact: {
    flexDirection: "column",
  },
  profileMiniCard: {
    flex: 1,
    minWidth: 220,
  },
  profileTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  profileTopRowCompact: {
    alignItems: "flex-start",
    gap: 12,
  },
  profileAvatarWrap: { position: "relative" },
  avatarCamera: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#020617",
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 20, fontWeight: "900", color: "#F8FAFC" },
  profileEmail: { marginTop: 4, fontSize: 14, color: "#CBD5E1" },
  profileUsername: { marginTop: 4, fontSize: 13, color: "#94A3B8" },
  profileMeta: { marginTop: 8, fontSize: 12, color: "#67E8F9" },
  profileMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  profileMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  profileMetaPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileActionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  selectField: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 78,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  selectFieldCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  selectFieldIcon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  selectFieldValue: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 24,
    flexShrink: 1,
  },
  selectFieldLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  preferenceThemeRow: {
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  preferenceThemeCopy: {
    minWidth: 0,
  },
  preferenceThemeValue: {
    flexShrink: 1,
  },
  preferenceThemeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preferenceThemeSwitchWrap: {
    width: "100%",
    justifyContent: "space-between",
  },
  preferenceThemeOption: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    minWidth: 104,
    alignItems: "center",
  },
  preferenceThemeOptionActive: {
    backgroundColor: "#7DD3FC",
  },
  preferenceThemeOptionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  preferenceLanguageRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  preferenceLanguageChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  preferenceLanguageChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  currencyChipRow: {
    gap: 10,
    paddingTop: 14,
    paddingBottom: 4,
  },
  currencyChip: {
    width: 152,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  currencyChipActive: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderColor: "rgba(34, 211, 238, 0.32)",
  },
  currencyChipCode: {
    fontSize: 15,
    fontWeight: "900",
  },
  currencyChipCodeActive: {
    color: "#22D3EE",
  },
  currencyChipLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  profileInput: {
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(8, 15, 30, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    color: "#F8FAFC",
  },
  passwordCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  passwordSuccess: { color: "#86EFAC", fontWeight: "700" },
  passwordError: { color: "#FCA5A5", fontWeight: "700" },
  passwordSuccessLight: { color: "#047857" },
  passwordErrorLight: { color: "#B91C1C" },
  passwordModalCard: {
    marginTop: 16,
  },
  passwordModalInput: {
    marginTop: 10,
  },
  passwordModalActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  currencyOptionsList: {
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  pickerOptionsList: {
    marginTop: 12,
    gap: 8,
    width: "100%",
    paddingBottom: 18,
  },
  dateRangeOptionList: {
    marginTop: 12,
    gap: 10,
    width: "100%",
  },
  pickerOptionRow: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
  },
  pickerOptionCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  pickerOptionCode: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
    flexShrink: 1,
  },
  pickerOptionLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 15,
    flexShrink: 1,
  },
  pickerOptionIcon: {
    width: 24,
    flexShrink: 0,
  },
  currencyOptionRow: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 60,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
  },
  currencyOptionRowActive: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  currencyOptionCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  currencyOptionCode: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 24,
    flexShrink: 1,
  },
  currencyOptionCodeActive: {
    color: "#22D3EE",
  },
  currencyOptionLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 20,
    flexShrink: 1,
  },
  currencyOptionIcon: {
    width: 24,
    marginTop: 2,
    flexShrink: 0,
  },
  primaryButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "#7DD3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#020617", fontWeight: "900" },
  secondaryButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(30, 41, 59, 0.92)",
  },
  secondaryButtonLight: {
    backgroundColor: "rgba(241, 245, 249, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
  },
  secondaryButtonText: { color: "#E2E8F0", fontWeight: "800" },
  secondaryButtonTextLight: { color: "#0F172A", fontWeight: "800" },
  legalRow: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  legalCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  legalIconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  legalTitle: { fontSize: 16, fontWeight: "800", color: "#F8FAFC" },
  legalSubtitle: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  logoutButton: {
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 20,
    paddingVertical: 14,
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutButtonText: { color: "#FCA5A5", fontWeight: "800" },
  logoutButtonLight: {
    backgroundColor: "rgba(254, 226, 226, 0.98)",
    borderColor: "rgba(248, 113, 113, 0.32)",
  },
  logoutButtonTextLight: {
    color: "#DC2626",
  },
  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    overflow: "visible",
  },
  bottomNavCompact: {
    left: 12,
    right: 12,
    bottom: 24,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
  },
  navItemWrap: {
    flex: 1,
    minWidth: 0,
  },
  navItemActive: {
    backgroundColor: "rgba(34, 211, 238, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.2)",
  },
  navLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
  },
  navLabelActive: { color: "#E0F2FE" },
  navAddButtonWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -32,
  },
  navAddButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    ...createShadow("0px 10px 20px rgba(56, 189, 248, 0.26)", {
      shadowColor: "#38BDF8",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.26,
      shadowRadius: 20,
      elevation: 10,
    }),
  },
  navAddLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalKeyboardWrap: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
  },
  infoModalBackdropCompact: {
    justifyContent: "flex-end",
    alignItems: "stretch",
    paddingHorizontal: 0,
    paddingTop: 72,
    paddingBottom: 0,
  },
  modalAnimatedWrap: {
    width: "100%",
    alignItems: "center",
  },
  pickerModalBackdrop: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  pickerAnimatedWrap: {
    maxWidth: 520,
    alignSelf: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    borderRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  modalCardCompact: {
    maxWidth: "100%",
    maxHeight: "92%",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  addExpenseModalCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  addExpenseModalSubtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F8FAFC",
    lineHeight: 26,
    flexShrink: 1,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.92)",
    flexShrink: 0,
  },
  modalCloseButtonDangerLight: {
    backgroundColor: "rgba(254, 226, 226, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
  },
  modalBodyScroll: {
    marginTop: 14,
    flexGrow: 1,
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingBottom: 4,
  },
  compactModalBody: {
    marginTop: 14,
  },
  modalNotes: { minHeight: 96, textAlignVertical: "top" },
  editReceiptPreview: {
    marginTop: 14,
    position: "relative",
    borderRadius: 22,
    overflow: "hidden",
  },
  editReceiptImage: { width: "100%", height: 190, borderRadius: 22 },
  editReceiptRemove: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.72)",
  },
  modalFooter: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.1)",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalActionsStack: {
    flexDirection: "column-reverse",
    alignItems: "stretch",
  },
  confirmationModalFooterCompact: {
    marginTop: 8,
    paddingTop: 10,
    gap: 8,
  },
  confirmationDialogCopy: {
    gap: 10,
  },
  confirmationDialogCopyCompact: {
    gap: 6,
  },
  confirmationPrimaryButton: {
    minWidth: 116,
  },
  confirmationPrimaryButtonCompact: {
    width: "100%",
    minWidth: 0,
  },
  confirmationPrimaryButtonDanger: {
    minWidth: 116,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationPrimaryButtonDangerText: {
    color: "#FFF7ED",
    fontWeight: "900",
  },
  confirmationSecondaryButtonCompact: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "80%",
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  pickerSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    borderRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    overflow: "hidden",
  },
  pickerInfoCard: {
    maxHeight: "92%",
    paddingBottom: 24,
  },
  compactFormCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  compactFormCardCompact: {
    padding: 18,
    borderRadius: 20,
  },
  infoCardCompact: {
    maxHeight: "78%",
    padding: 18,
    borderRadius: 20,
  },
  pickerSheetCompact: {
    maxHeight: "94%",
    borderRadius: 22,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "android" ? 30 : 28,
  },
  pickerInfoCardCompact: {
    maxHeight: "94%",
    paddingBottom: Platform.OS === "android" ? 24 : 22,
  },
  infoCardBottomSheet: {
    maxWidth: "100%",
    width: "100%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "android" ? 28 : 24,
    borderBottomWidth: 0,
  },
  confirmationSheetCompact: {
    maxHeight: 260,
    paddingBottom: Platform.OS === "android" ? 18 : 16,
  },
  infoBody: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 24,
    color: "#CBD5E1",
    marginBottom: 18,
  },
  infoBodyScroll: {
    marginTop: 14,
    flexGrow: 0,
    flexShrink: 1,
  },
  infoBodyContent: {
    paddingBottom: 18,
  },
  infoStack: {
    gap: 10,
  },
  infoSectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  infoSectionBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 21,
  },
  infoQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.94)",
    justifyContent: "center",
    padding: 20,
  },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    zIndex: 2,
  },
  viewerImage: {
    width: "100%",
    height: "62%",
    borderRadius: 24,
  },
  viewerInfo: {
    marginTop: 18,
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  viewerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  viewerMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#CBD5E1",
  },
  viewerNotes: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
  },
});


