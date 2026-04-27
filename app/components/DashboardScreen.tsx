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

import AddExpenseForm from "./AddExpenseForm";
import ExpenseList from "./ExpenseList";
import StatsCard from "./StatsCard";
import { Expense, User } from "@/src/types";
import {
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  formatCurrency,
} from "@/src/services/currency";
import expenseStorage from "@/src/services/expenseStorage";
import storageService, { StorageKeys } from "@/src/services/storageService";
import { createShadow } from "@/src/utils/shadow";

interface Props {
  user: User;
  expenses: Expense[];
  isExpensesLoading?: boolean;
  shouldShowGuideForThisSession?: boolean;
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

type InfoSheet = "terms" | "privacy" | "faq" | "about" | null;
type ThemeMode = "dark" | "light";
type ExportFormat = "csv" | "pdf" | "summary";
type DateRangeKey = "thisMonth" | "lastMonth" | "last30Days" | "allTime";

interface InfoSection {
  heading: string;
  body: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface DashboardPreferences {
  themeMode: ThemeMode;
  monthlyBudget: number;
  activeTab: "overview" | "stats" | "gallery" | "profile";
  selectedCategory: string | "All";
  dateRange: DateRangeKey;
  preferredCurrency: CurrencyCode;
  onboardingSeenForUserId?: string;
}

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  "1.0.0";

const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  "₱": "PHP ",
  "₫": "VND ",
  "€": "EUR ",
  "£": "GBP ",
  "¥": "JPY ",
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

export default function DashboardScreen({
  user,
  expenses,
  isExpensesLoading = false,
  shouldShowGuideForThisSession = false,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onUpdateUser,
  onChangePassword,
  onClearAll,
  onLogout,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const isVeryCompact = width < 420;
  const useSidebarNavigation = Platform.OS === "web" && !isCompact;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(1)).current;

  const [activeTab, setActiveTab] = useState<
    "overview" | "stats" | "gallery" | "profile"
  >("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | "All">(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(10000);
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>("PHP");
  const [onboardingSeenForUserId, setOnboardingSeenForUserId] = useState<
    string | undefined
  >(undefined);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>("thisMonth");
  const [gallerySearchQuery, setGallerySearchQuery] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [infoSheet, setInfoSheet] = useState<InfoSheet>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Expense | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showGuideCard, setShowGuideCard] = useState(false);
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
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [activeTab, contentAnim]);

  useEffect(() => {
    setEditName(user.name);
    setEditEmail(user.email);
  }, [user.email, user.name]);

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
        setThemeMode(storedPreferences.themeMode ?? "dark");
        setMonthlyBudget(storedPreferences.monthlyBudget ?? 10000);
        setActiveTab(storedPreferences.activeTab ?? "overview");
        setSelectedCategory(storedPreferences.selectedCategory ?? "All");
        setDateRange(storedPreferences.dateRange ?? "thisMonth");
        setPreferredCurrency(storedPreferences.preferredCurrency ?? "PHP");
        setOnboardingSeenForUserId(storedPreferences.onboardingSeenForUserId);
      }

      setIsPreferencesReady(true);
    };

    loadPreferences();

    return () => {
      active = false;
    };
  }, []);

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
      onboardingSeenForUserId,
    } satisfies DashboardPreferences);
  }, [
    activeTab,
    dateRange,
    isPreferencesReady,
    monthlyBudget,
    onboardingSeenForUserId,
    preferredCurrency,
    selectedCategory,
    themeMode,
  ]);

  useEffect(() => {
    if (!isPreferencesReady) {
      return;
    }

    setShowGuideCard(
      shouldShowGuideForThisSession && onboardingSeenForUserId !== user.id,
    );
  }, [
    isPreferencesReady,
    onboardingSeenForUserId,
    shouldShowGuideForThisSession,
    user.id,
  ]);

  const formatAmount = useCallback(
    (amount: number) => formatCurrency(amount, preferredCurrency),
    [preferredCurrency],
  );

  const formatChartAmount = useCallback(
    (amount: number) => formatCurrency(amount, preferredCurrency, 0),
    [preferredCurrency],
  );

  const rangeFilteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);

    return expenses.filter((expense) => {
      const date = new Date(expense.date);

      if (dateRange === "allTime") {
        return true;
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
      case "lastMonth":
        return "Last month";
      case "last30Days":
        return "Last 30 days";
      case "allTime":
        return "All time";
      default:
        return "This month";
    }
  }, [dateRange]);

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

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    rangeFilteredExpenses.forEach((expense) => {
      const key = expense.category || "Uncategorized";
      breakdown[key] = (breakdown[key] || 0) + expense.amount;
    });
    return breakdown;
  }, [rangeFilteredExpenses]);

  const sortedCategoryBreakdown = useMemo(
    () => Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]),
    [categoryBreakdown],
  );

  const categories = useMemo(
    () => ["All", ...Object.keys(categoryBreakdown)],
    [categoryBreakdown],
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

  const budgetUsage =
    monthlyBudget > 0 ? Math.min(stats.thisMonth / monthlyBudget, 1) : 0;
  const remainingBudget =
    monthlyBudget > 0 ? Math.max(monthlyBudget - stats.thisMonth, 0) : 0;
  const overspentThisMonth =
    monthlyBudget > 0 ? Math.max(stats.thisMonth - monthlyBudget, 0) : 0;

  const topCategory =
    Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0] || null;

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

  const budgetAlert = useMemo(() => {
    if (monthlyBudget <= 0) {
      return {
        tone: "neutral",
        title: "Budget target missing",
        message: "Add a monthly budget to unlock alerts and spending guidance.",
      };
    }

    if (budgetUsage >= 1) {
      return {
        tone: "danger",
        title: "Budget exceeded",
        message: `You are over your monthly target by ${formatAmount(
          overspentThisMonth,
        )}. Review recent expenses and pause non-essential spending.`,
      };
    }

    if (budgetUsage >= 0.8) {
      return {
        tone: "warning",
        title: "Budget warning",
        message:
          "You are close to your monthly limit. Keep an eye on new spending this week.",
      };
    }

    return {
      tone: "success",
      title: "Budget on track",
      message: `You still have ${formatAmount(
        remainingBudget,
      )} left in this budget cycle.`,
    };
  }, [
    budgetUsage,
    formatAmount,
    monthlyBudget,
    overspentThisMonth,
    remainingBudget,
  ]);

  const galleryExpenses = useMemo(
    () => rangeFilteredExpenses.filter((expense) => expense.imageUrl),
    [rangeFilteredExpenses],
  );

  const filteredGalleryExpenses = useMemo(() => {
    const query = gallerySearchQuery.trim().toLowerCase();
    if (!query) {
      return galleryExpenses;
    }

    return galleryExpenses.filter((expense) =>
      [expense.description, expense.category, expense.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [galleryExpenses, gallerySearchQuery]);

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
    { key: "overview", icon: "grid-outline", label: "Overview" },
    { key: "stats", icon: "stats-chart-outline", label: "Stats" },
    { key: "gallery", icon: "images-outline", label: "Gallery" },
    { key: "profile", icon: "person-circle-outline", label: "Profile" },
  ] as const;

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

  const confirmClearAll = () => {
    Alert.alert(
      "Clear all expenses",
      "This removes every saved expense entry from your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
            await onClearAll();
          },
        },
      ],
    );
  };

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      const shouldLogout =
        typeof window !== "undefined" &&
        window.confirm("Are you sure you want to sign out?");

      if (shouldLogout) {
        onLogout();
      }
      return;
    }

    Alert.alert("Log out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          onLogout();
        },
      },
    ]);
  };

  const confirmDeleteExpense = (id: string) => {
    const expense = expenses.find((entry) => entry.id === id);
    const message = expense
      ? `Delete "${expense.description}" from your expense list?`
      : "Delete this expense from your expense list?";

    if (Platform.OS === "web") {
      const shouldDelete =
        typeof window !== "undefined" && window.confirm(message);

      if (shouldDelete) {
        onDeleteExpense(id);
      }
      return;
    }

    Alert.alert("Delete expense", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          onDeleteExpense(id);
        },
      },
    ]);
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

  const dismissOnboardingGuide = () => {
    setOnboardingSeenForUserId(user.id);
    setShowGuideCard(false);
  };

  const exportRows = useMemo(
    () =>
      rangeFilteredExpenses.map((expense) => ({
        date: new Date(expense.date).toLocaleDateString(),
        description: expense.description,
        category: expense.category || "Uncategorized",
        amount: expense.amount.toFixed(2),
        notes: expense.notes || "",
        receipt: expense.imageUrl ? "Yes" : "No",
      })),
    [rangeFilteredExpenses],
  );

  const summaryRows = useMemo(
    () => [
      ["Metric", "Value"],
      ["Total expenses", formatAmount(stats.total)],
      ["This month", formatAmount(stats.thisMonth)],
      ["Last month", formatAmount(stats.lastMonth)],
      ["Current week", formatAmount(trendStats.currentWeekTotal)],
      ["Last week", formatAmount(trendStats.lastWeekTotal)],
      ["Average expense", formatAmount(trendStats.averageExpense)],
      ["Receipt coverage", `${Math.round(trendStats.receiptCoverage * 100)}%`],
      ["Entries exported", String(rangeFilteredExpenses.length)],
    ],
    [
      formatAmount,
      rangeFilteredExpenses.length,
      stats.lastMonth,
      stats.thisMonth,
      stats.total,
      trendStats,
    ],
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
      Alert.alert("Export ready", `Saved report to ${fileUri}`);
    }
  };

  const sanitizePdfText = (value: string) =>
    value
      .replace(/[₱₫€£¥]/g, (char) => PDF_TEXT_REPLACEMENTS[char] ?? "")
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
        ["Date", "Description", "Category", "Amount", "Receipt"],
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
        "EyeGasto Expense Summary",
        `Generated: ${new Date().toLocaleString()}`,
        "",
        ...summaryRows.slice(1).map(([label, value]) => `${label}: ${value}`),
        "",
        "Recent Exported Expenses",
        ...exportRows.map(
          (row) =>
            `${row.date} | ${row.description} | ${row.category} | ${preferredCurrency} ${row.amount} | Receipt: ${row.receipt}`,
        ),
      ].join("\n");

      const pdfReport = buildPdfDocument(summaryText);

      if (Platform.OS === "web") {
        if (format === "summary") {
          const reportWindow = window.open("", "_blank", "noopener,noreferrer");
          if (!reportWindow) {
            Alert.alert(
              "Export blocked",
              "Please allow pop-ups to print the report.",
            );
            return;
          }
          reportWindow.document.write(
            `<html><head><title>EyeGasto Report</title></head><body><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${summaryText.replace(/[<&>]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] as string)}</pre></body></html>`,
          );
          reportWindow.document.close();
          reportWindow.focus();
          reportWindow.print();
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
          "Export summary report",
        );
      } else if (format === "pdf") {
        await shareNativeFile(
          pdfReport,
          "pdf",
          "application/pdf",
          "Export PDF report",
        );
      } else {
        await shareNativeFile(csv, "csv", "text/csv", "Export CSV report");
      }
    } catch (error) {
      console.error("Failed to export report", error);
      Alert.alert("Export failed", "We couldn't generate the report.");
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
          "Permission needed",
          "Allow photo access to attach a receipt to this expense.",
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
        "Missing details",
        "Please enter a valid description and amount.",
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
    if (!editName.trim() || !editEmail.trim() || !onUpdateUser) {
      return;
    }

    await onUpdateUser({
      name: editName.trim(),
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
          "Permission needed",
          "Photo access is required to update your profile image.",
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
            "Avatar upload failed",
            uploadResult.error || "We could not save your profile image.",
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
      setPasswordError("Enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError("Enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (!onChangePassword) {
      setPasswordError("Password changes are not configured yet.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setPasswordSuccess("Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const infoContent = {
    terms: {
      title: "Terms of Use",
      sections: [
        {
          heading: "Using EyeGasto",
          body: "EyeGasto is designed for personal expense tracking, receipt storage, and budgeting insights. Use the app only for lawful and relevant financial records.",
        },
        {
          heading: "Your Responsibility",
          body: "You are responsible for keeping your login credentials secure, reviewing what you upload, and protecting access on shared devices by logging out when needed.",
        },
        {
          heading: "Uploads and Records",
          body: "Receipt images, notes, and exported reports should only contain information you are comfortable storing and sharing from your account.",
        },
      ] satisfies InfoSection[],
    },
    privacy: {
      title: "Privacy Policy",
      sections: [
        {
          heading: "What We Store",
          body: "EyeGasto stores your profile details, expense records, recurring plans, and receipt files so your data can sync across supported devices.",
        },
        {
          heading: "How It Is Used",
          body: "Stored data is used to power dashboard analytics, exports, receipt previews, and recurring expense generation within your own account experience.",
        },
        {
          heading: "Sharing and Exports",
          body: "Exports and shared files are initiated by you. Review their contents carefully before sending or storing them outside the app.",
        },
      ] satisfies InfoSection[],
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
            "Receipt images attached to expenses are stored with your account so they can appear across supported devices.",
        },
        {
          question: "Can I export my data?",
          answer:
            "Yes. The dashboard includes CSV, PDF, and summary export options for your expense records.",
        },
        {
          question: "How do recurring expenses work?",
          answer:
            "Monthly recurring plans automatically create upcoming expense entries when they become due.",
        },
      ] satisfies FaqItem[],
    },
    about: {
      title: "About EyeGasto",
      sections: [
        {
          heading: "What EyeGasto Is",
          body: "EyeGasto is a modern expense tracker focused on fast entry, clean analytics, and visual proof through receipt uploads.",
        },
        {
          heading: "What It Helps With",
          body: "The app is built for daily monitoring, category trends, recurring planning, and quick review of recent spending activity.",
        },
        {
          heading: "Experience Focus",
          body: "The current experience emphasizes a streamlined dashboard, mobile-friendly flow, and a consistent look across app and web.",
        },
      ] satisfies InfoSection[],
    },
  } as const;

  const openMailAction = async (subject: string) => {
    const mailtoUrl = `mailto:carl46436@gmail.com?subject=${encodeURIComponent(subject)}`;
    const canOpen = await Linking.canOpenURL(mailtoUrl);

    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return;
    }

    Alert.alert(
      "Email unavailable",
      "Please email support@eyegasto.app from your preferred mail app.",
    );
  };

  const handleContactSupport = async () => {
    try {
      await openMailAction("EyeGasto Support Request");
    } catch (error) {
      console.error("Failed to open support email", error);
      Alert.alert(
        "Support unavailable",
        "Please email support@eyegasto.app for help.",
      );
    }
  };

  const handleReportBug = async () => {
    try {
      await openMailAction("EyeGasto Bug Report");
    } catch (error) {
      console.error("Failed to open bug report email", error);
      Alert.alert(
        "Bug report unavailable",
        "Please email support@eyegasto.app with the issue details.",
      );
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.safeBackground }]}
    >
      <StatusBar
        barStyle={themeMode === "dark" ? "light-content" : "dark-content"}
      />

      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <View style={[styles.header, isCompact && styles.headerCompact]}>
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
          <View style={styles.headerBrandCopy}>
            <Text style={[styles.headerTitle, { color: theme.title }]}>
              EyeGasto
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.faint }]}>
              Smart expense tracking with saved receipt evidence.
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
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

          <TouchableOpacity
            style={[
              styles.themeToggle,
              isVeryCompact && styles.themeToggleCompact,
              {
                backgroundColor: theme.mutedSurface,
                borderColor: theme.cardBorder,
              },
            ]}
            onPress={() =>
              setThemeMode((value) => (value === "dark" ? "light" : "dark"))
            }
          >
            <Ionicons
              name={themeMode === "dark" ? "sunny-outline" : "moon-outline"}
              size={16}
              color={theme.accent}
            />
            <Text style={[styles.themeToggleText, { color: theme.title }]}>
              {themeMode === "dark" ? "Light" : "Dark"}
            </Text>
          </TouchableOpacity>
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
                Dashboard Navigation
              </Text>
              <Text style={[styles.sideNavSubtitle, { color: theme.faint }]}>
                Jump between dashboard sections.
              </Text>
            </View>

            <View style={styles.sideNavItems}>
              {navigationItems.map((item) => {
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
                    Today
                  </Text>
                  <Text style={[styles.heroTitle, { color: theme.title }]}>
                    Track your expenses one place.
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: theme.muted }]}>
                    Add a receipt, update your budget, and scan recent entries
                    without leaving the dashboard.
                  </Text>
                </LinearGradient>

                {showGuideCard ? (
                  <View
                    style={[
                      styles.guideCard,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.guideCardHeader,
                        isCompact && styles.panelHeaderStack,
                      ]}
                    >
                      <View style={styles.guideCardCopy}>
                        <Text
                          style={[styles.sectionTitle, { color: theme.title }]}
                        >
                          Getting Started
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: theme.faint },
                          ]}
                        >
                          Start with three quick steps so the dashboard feels
                          easy right away.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.modalCloseButton,
                          themeMode === "light"
                            ? styles.modalCloseButtonDangerLight
                            : { backgroundColor: theme.mutedSurface },
                        ]}
                        onPress={dismissOnboardingGuide}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={
                            themeMode === "light" ? "#DC2626" : theme.title
                          }
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.guideStepStack}>
                      {[
                        {
                          step: "1",
                          title: "Add your first expense",
                          body: "Use Add expense to open the form, then save the amount, notes, and optional receipt.",
                        },
                        {
                          step: "2",
                          title: "Set your budget and currency",
                          body: "Choose your preferred currency in Profile, then set a monthly budget to track what you have left.",
                        },
                        {
                          step: "3",
                          title: "Save receipts faster",
                          body: "Take a photo directly or choose one from your gallery when you want proof for an expense.",
                        },
                      ].map((item) => (
                        <View
                          key={item.step}
                          style={[
                            styles.guideStepCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <View style={styles.guideStepBadge}>
                            <Text style={styles.guideStepBadgeText}>
                              {item.step}
                            </Text>
                          </View>
                          <View style={styles.guideStepCopy}>
                            <Text
                              style={[
                                styles.guideStepTitle,
                                { color: theme.title },
                              ]}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                styles.guideStepBody,
                                { color: theme.muted },
                              ]}
                            >
                              {item.body}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={styles.guideActionRow}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={dismissOnboardingGuide}
                      >
                        <Text style={styles.secondaryButtonText}>Got it</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => {
                          dismissOnboardingGuide();
                          setQuickAddDraft(null);
                          setShowAddForm(true);
                        }}
                      >
                        <Text style={styles.primaryButtonText}>
                          Add first expense
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

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
                        Quick-add Expense
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        Save the amount, category, notes, and optional receipt.
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
                          handleQuickAdd(item.label, item.amount, item.category)
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
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            styles.quickAddChipMeta,
                            { color: theme.faint },
                          ]}
                        >
                          {item.category}
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
                          Monthly Plans
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: theme.faint },
                          ]}
                        >
                          These recurring expenses are recreated automatically
                          each month.
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
                                {formatAmount(item.amount)} · every month on day{" "}
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
                      Activity Range
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      Dashboard lists, gallery, and exports currently reflect{" "}
                      {dateRangeLabel.toLowerCase()}.
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterChipRow}
                  >
                    {[
                      { key: "thisMonth" as const, label: "This month" },
                      { key: "lastMonth" as const, label: "Last month" },
                      { key: "last30Days" as const, label: "Last 30 days" },
                      { key: "allTime" as const, label: "All time" },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                          dateRange === option.key && styles.filterChipActive,
                        ]}
                        onPress={() => setDateRange(option.key)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            { color: theme.faint },
                            dateRange === option.key &&
                              styles.filterChipTextActive,
                            themeMode === "light" &&
                              dateRange === option.key &&
                              styles.filterChipTextActiveLight,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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
                        Overview
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        Monthly totals and budget status with{" "}
                        {dateRangeLabel.toLowerCase()} activity in view.
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
                          title="Last Month"
                          amount={stats.lastMonth}
                          type="expense"
                          period="month"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                        <StatsCard
                          title="This Month"
                          amount={stats.thisMonth}
                          type="expense"
                          period="month"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                        <StatsCard
                          title="Total Expenses"
                          amount={stats.total}
                          type="expense"
                          period="total"
                          mode={themeMode}
                          currencyCode={preferredCurrency}
                        />
                      </>
                    )}
                  </View>

                  <View
                    style={[
                      styles.budgetShell,
                      {
                        backgroundColor: theme.mutedSurface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.budgetHeader,
                        isCompact && styles.budgetHeaderStack,
                      ]}
                    >
                      <View style={styles.budgetBlock}>
                        <Text
                          style={[styles.budgetLabel, { color: theme.muted }]}
                        >
                          Monthly budget
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
                              Number.parseFloat(
                                value.replace(/[^0-9.]/g, ""),
                              ) || 0,
                            )
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <View
                        style={[
                          styles.budgetSummary,
                          isCompact && styles.budgetSummaryCompact,
                        ]}
                      >
                        <Text
                          style={[styles.budgetLabel, { color: theme.muted }]}
                        >
                          Spent so far
                        </Text>
                        <Text
                          style={[styles.budgetValue, { color: theme.title }]}
                        >
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
                      <Text
                        style={[styles.budgetMetaText, { color: theme.faint }]}
                      >
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
                          styles.budgetMetricCardSingle,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.budgetMetricLabel,
                            { color: theme.muted },
                          ]}
                        >
                          Remaining
                        </Text>
                        <Text
                          style={[
                            styles.budgetMetricValue,
                            {
                              color:
                                overspentThisMonth > 0
                                  ? "#F87171"
                                  : theme.title,
                            },
                          ]}
                        >
                          {overspentThisMonth > 0
                            ? `-${formatAmount(overspentThisMonth)}`
                            : formatAmount(remainingBudget)}
                        </Text>
                      </View>
                    </View>
                  </View>

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
                      <Text
                        style={[
                          styles.budgetAlertTitle,
                          { color: theme.title },
                        ]}
                      >
                        {budgetAlert.title}
                      </Text>
                    </View>
                    <Text
                      style={[styles.budgetAlertText, { color: theme.muted }]}
                    >
                      {budgetAlert.message}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.workspaceRow,
                    isCompact && styles.workspaceColumn,
                  ]}
                >
                  <View
                    style={[
                      styles.panel,
                      styles.recentPanel,
                      isCompact && styles.fullWidthPanel,
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
                          style={[
                            styles.sectionTitleLarge,
                            { color: theme.title },
                          ]}
                        >
                          Recent Expenses
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: theme.faint },
                          ]}
                        >
                          Search and review your latest entries.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.clearButton,
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
                          Clear all
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
                      placeholder="Search expenses, categories, or notes"
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
                        emptyTitle="No expenses yet"
                        emptySubtitle="Start with Add expense, use a quick-add card, and attach a receipt when you want proof for the purchase."
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
                            ? "Show less"
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
                      isCompact && styles.fullWidthPanel,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.title }]}>
                      Insights
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      Quick context from your current expense activity.
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
                            Top category
                          </Text>
                          <Text
                            style={[styles.signalValue, { color: theme.title }]}
                          >
                            {topCategory ? topCategory[0] : "No data yet"}
                          </Text>
                          <Text
                            style={[styles.signalMeta, { color: theme.muted }]}
                          >
                            {topCategory
                              ? formatAmount(topCategory[1])
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
                            Receipts saved
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
                            Entries with photo proof attached in{" "}
                            {dateRangeLabel.toLowerCase()}
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
                            Member since
                          </Text>
                          <Text
                            style={[styles.signalValue, { color: theme.title }]}
                          >
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "Today"}
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
                </View>
              </>
            ) : null}

            {activeTab === "stats" ? (
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
                      Analytics
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      Weekly spending trend and export tools for{" "}
                      {dateRangeLabel.toLowerCase()} activity.
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
                      {isExporting ? "Exporting..." : "Export"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isExpensesLoading ? (
                  <>
                    <View
                      style={[
                        styles.analyticsHeroCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      {renderSkeletonCard(12, "28%")}
                      {renderSkeletonCard(30, "42%")}
                      {renderSkeletonCard(12, "74%")}
                    </View>
                    <View style={styles.statsSummaryRow}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <View
                          key={`analytics-skeleton-${index}`}
                          style={[
                            styles.statsSummaryCard,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          {renderSkeletonCard(12, "44%")}
                          {renderSkeletonCard(26, "64%")}
                          {renderSkeletonCard(12, "52%")}
                        </View>
                      ))}
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
                      {renderSkeletonCard(16, "38%")}
                      {renderSkeletonCard(12, "88%")}
                      {renderSkeletonCard(12, "76%")}
                    </View>
                    <View
                      style={[
                        styles.graphShell,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                          minHeight: 260,
                        },
                      ]}
                    >
                      {Array.from({ length: isCompact ? 4 : 6 }).map(
                        (_, index) => (
                          <View
                            key={`graph-skeleton-${index}`}
                            style={styles.graphColumn}
                          >
                            {renderSkeletonCard(12, 60)}
                            <View
                              style={[
                                styles.graphBarShell,
                                {
                                  height: 160,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.graphBar,
                                  {
                                    height: 50 + index * 18,
                                    backgroundColor:
                                      themeMode === "dark"
                                        ? "rgba(125, 211, 252, 0.4)"
                                        : "rgba(2, 132, 199, 0.28)",
                                  },
                                ]}
                              />
                            </View>
                            {renderSkeletonCard(12, 56)}
                          </View>
                        ),
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <LinearGradient
                      colors={
                        themeMode === "light"
                          ? [
                              "rgba(125, 211, 252, 0.5)",
                              "rgba(255,255,255,0.96)",
                            ]
                          : ["rgba(34,211,238,0.18)", "rgba(15,23,42,0.96)"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.analyticsHeroCard,
                        {
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.analyticsHeroHeader,
                          isCompact && styles.panelHeaderStack,
                        ]}
                      >
                        <View style={styles.analyticsHeroCopy}>
                          <Text
                            style={[
                              styles.signalLabel,
                              {
                                color:
                                  themeMode === "light" ? "#0369A1" : "#67E8F9",
                              },
                            ]}
                          >
                            Analytics
                          </Text>
                          <Text
                            style={[
                              styles.sectionSubtitle,
                              { color: theme.muted },
                            ]}
                          >
                            Weekly spending trend and export tools for this
                            month activity.
                          </Text>
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
                        <View
                          style={[
                            styles.analyticsTrendIconWrap,
                            {
                              backgroundColor:
                                themeMode === "light"
                                  ? "rgba(125, 211, 252, 0.22)"
                                  : "rgba(8, 15, 30, 0.5)",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              trendStats.monthlyChange >= 0
                                ? "arrow-up-outline"
                                : "arrow-down-outline"
                            }
                            size={20}
                            color={theme.accent}
                          />
                        </View>
                        <Text
                          style={[
                            styles.analyticsHeroValue,
                            { color: theme.title },
                          ]}
                        >
                          {trendStats.monthlyChange >= 0 ? "+" : ""}
                          {trendStats.monthlyChange.toFixed(0)}%
                        </Text>
                        <Text
                          style={[
                            styles.analyticsGaugeCaption,
                            { color: theme.muted },
                          ]}
                        >
                          {trendStats.monthlyChange >= 0
                            ? "You spent more than last month."
                            : "You spent less than last month."}
                        </Text>
                        <Text
                          style={[
                            styles.analyticsTrendMeta,
                            { color: theme.faint },
                          ]}
                        >
                          {topCategory
                            ? `${topCategory[0]} is currently your top category.`
                            : "Add more expenses to unlock category insights."}
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
                          <Text
                            style={[
                              styles.analyticsHeroStatLabel,
                              { color: theme.faint },
                            ]}
                          >
                            Weeks with spending
                          </Text>
                          <Text
                            style={[
                              styles.analyticsHeroStatValue,
                              { color: theme.title },
                            ]}
                          >
                            {weeklyInsight.activeWeeks}
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
                          <Text
                            style={[
                              styles.analyticsHeroStatLabel,
                              { color: theme.faint },
                            ]}
                          >
                            This week
                          </Text>
                          <Text
                            style={[
                              styles.analyticsInfoValue,
                              { color: theme.title },
                            ]}
                          >
                            {formatAmount(trendStats.currentWeekTotal)}
                          </Text>
                          <Text
                            style={[
                              styles.analyticsInfoMeta,
                              { color: theme.muted },
                            ]}
                          >
                            vs last week{" "}
                            {formatAmount(trendStats.lastWeekTotal)}
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
                            <Ionicons
                              name="restaurant-outline"
                              size={18}
                              color={theme.accent}
                            />
                            <Text
                              style={[
                                styles.analyticsFeatureTitle,
                                { color: theme.title },
                              ]}
                            >
                              {topCategory ? topCategory[0] : "Top category"}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.analyticsFeatureMeta,
                              { color: theme.muted },
                            ]}
                          >
                            {topCategory
                              ? `Current spend ${formatAmount(topCategory[1])}`
                              : "No category data yet"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.analyticsFeatureValue,
                            { color: theme.title },
                          ]}
                        >
                          {topCategory ? formatAmount(topCategory[1]) : "--"}
                        </Text>
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
                            <Ionicons
                              name="images-outline"
                              size={18}
                              color={theme.accent}
                            />
                            <Text
                              style={[
                                styles.analyticsFeatureTitle,
                                { color: theme.title },
                              ]}
                            >
                              Receipt Attachment Rate
                            </Text>
                          </View>
                        </View>
                        <View style={styles.analyticsReceiptWrap}>
                          <View
                            style={[
                              styles.analyticsReceiptTrack,
                              { backgroundColor: theme.mutedSurface },
                            ]}
                          >
                            <LinearGradient
                              colors={["#67E8F9", "#8B5CF6"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.analyticsReceiptFill,
                                {
                                  width: `${Math.max(
                                    Math.round(
                                      trendStats.receiptCoverage * 100,
                                    ),
                                    8,
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.analyticsReceiptValue,
                              { color: theme.title },
                            ]}
                          >
                            {Math.round(trendStats.receiptCoverage * 100)}%
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>

                    <View style={styles.statsSummaryRow}>
                      <View
                        style={[
                          styles.statsSummaryCard,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statsSummaryLabel,
                            { color: theme.muted },
                          ]}
                        >
                          This month
                        </Text>
                        <Text
                          style={[
                            styles.statsSummaryValue,
                            { color: theme.title },
                          ]}
                        >
                          {formatAmount(stats.thisMonth)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statsSummaryCard,
                          {
                            backgroundColor: theme.mutedSurface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statsSummaryLabel,
                            { color: theme.muted },
                          ]}
                        >
                          Last month
                        </Text>
                        <Text
                          style={[
                            styles.statsSummaryValue,
                            { color: theme.title },
                          ]}
                        >
                          {formatAmount(stats.lastMonth)}
                        </Text>
                      </View>
                    </View>

                    {!isExpensesLoading &&
                    graphEntries.every(([, total]) => total === 0) ? (
                      <Text style={styles.emptyGraphText}>
                        No spending recorded for the current month yet. Add a
                        new expense to start the weekly trend chart.
                      </Text>
                    ) : !isExpensesLoading ? (
                      <ScrollView
                        horizontal={isCompact}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={
                          isCompact ? styles.graphScrollContent : undefined
                        }
                      >
                        <View
                          style={[
                            styles.graphShell,
                            isCompact && styles.graphShellCompact,
                            {
                              backgroundColor: theme.mutedSurface,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <View style={styles.graphHeader}>
                            <Text
                              style={[
                                styles.graphTitle,
                                { color: theme.title },
                              ]}
                            >
                              Weekly Spending Trend
                            </Text>
                            <Text
                              style={[
                                styles.graphSubtitle,
                                { color: theme.faint },
                              ]}
                            >
                              Current Month
                            </Text>
                          </View>

                          <View style={styles.graphBody}>
                            <View style={styles.graphYAxis}>
                              {[1, 0.75, 0.5, 0.25, 0].map((step) => {
                                const maxValue = Math.max(
                                  ...graphEntries.map(([, value]) => value),
                                  1,
                                );
                                const labelValue =
                                  step === 0
                                    ? 0
                                    : Math.ceil((maxValue * step) / 100) * 100;
                                return (
                                  <Text
                                    key={`axis-${step}`}
                                    style={[
                                      styles.graphAxisLabel,
                                      { color: theme.faint },
                                    ]}
                                  >
                                    {labelValue === 0
                                      ? "0"
                                      : formatChartAmount(labelValue)}
                                  </Text>
                                );
                              })}
                            </View>

                            <View style={styles.graphPlotArea}>
                              {[1, 0.75, 0.5, 0.25, 0].map(
                                (step, lineIndex) => (
                                  <View
                                    key={`line-${lineIndex}`}
                                    style={[
                                      styles.graphGridLine,
                                      {
                                        top: `${(1 - step) * 100}%`,
                                        borderColor: theme.cardBorder,
                                      },
                                    ]}
                                  />
                                ),
                              )}

                              <View
                                style={[
                                  styles.graphBenchmarkLine,
                                  {
                                    top: `${(1 - 0.5) * 100}%`,
                                    borderColor: "rgba(226, 232, 240, 0.55)",
                                  },
                                ]}
                              />

                              <View style={styles.graphColumnsRow}>
                                {graphEntries.map(
                                  ([dayLabel, total], index) => {
                                    const max = Math.max(
                                      ...graphEntries.map(([, value]) => value),
                                      1,
                                    );
                                    const height = Math.max(
                                      (total / max) * 210,
                                      total > 0 ? 32 : 12,
                                    );
                                    const gradients: Record<number, string[]> =
                                      {
                                        0: ["#2F80ED", "#3B82F6"],
                                        1: ["#22C55E", "#34D399"],
                                        2: ["#F59E0B", "#FB923C"],
                                        3: ["#38BDF8", "#22D3EE"],
                                      };
                                    const barColors = gradients[index] || [
                                      "#38BDF8",
                                      "#818CF8",
                                    ];

                                    return (
                                      <View
                                        key={dayLabel}
                                        style={styles.graphColumnCard}
                                      >
                                        <Text
                                          style={[
                                            styles.graphValue,
                                            { color: theme.title },
                                          ]}
                                        >
                                          {formatChartAmount(total)}
                                        </Text>
                                        <View style={styles.graphBarShell}>
                                          <LinearGradient
                                            colors={
                                              barColors as [
                                                string,
                                                string,
                                                ...string[],
                                              ]
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 0, y: 1 }}
                                            style={[
                                              styles.graphBar,
                                              { height },
                                            ]}
                                          />
                                        </View>
                                        <Text
                                          style={[
                                            styles.graphLabel,
                                            { color: theme.title },
                                          ]}
                                        >
                                          {dayLabel}
                                        </Text>
                                      </View>
                                    );
                                  },
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      </ScrollView>
                    ) : null}

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
                        Weekly summary
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        Highest spend week is{" "}
                        {weeklyInsight.highestWeek?.[0] || "N/A"} at{" "}
                        {formatAmount(weeklyInsight.highestWeek?.[1] || 0)}.
                        Average active-week spend is{" "}
                        {formatAmount(weeklyInsight.averageWeeklySpend)} across{" "}
                        {weeklyInsight.activeWeeks} active weeks this month.
                      </Text>
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
                        Category breakdown
                      </Text>
                      <Text
                        style={[styles.sectionSubtitle, { color: theme.faint }]}
                      >
                        Which categories are driving the most spend in{" "}
                        {dateRangeLabel.toLowerCase()}.
                      </Text>
                      <View style={styles.categoryBreakdownList}>
                        {sortedCategoryBreakdown
                          .slice(0, 5)
                          .map(([label, total]) => {
                            const max = sortedCategoryBreakdown[0]?.[1] || 1;
                            return (
                              <View
                                key={label}
                                style={styles.categoryBreakdownRow}
                              >
                                <View style={styles.categoryBreakdownCopy}>
                                  <Text
                                    style={[
                                      styles.categoryBreakdownLabel,
                                      { color: theme.title },
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.categoryBreakdownValue,
                                      { color: theme.muted },
                                    ]}
                                  >
                                    {formatAmount(total)}
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
                                        width: `${Math.max((total / max) * 100, 12)}%`,
                                      },
                                    ]}
                                  />
                                </View>
                              </View>
                            );
                          })}
                      </View>
                    </View>
                  </>
                )}
              </View>
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
                      Receipt Gallery
                    </Text>
                    <Text
                      style={[styles.sectionSubtitle, { color: theme.faint }]}
                    >
                      Review every uploaded proof in one place for{" "}
                      {dateRangeLabel.toLowerCase()} activity.
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
                      {filteredGalleryExpenses.length} saved
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
                  placeholder="Search receipts by expense, category, or note"
                  placeholderTextColor={theme.faint}
                  value={gallerySearchQuery}
                  onChangeText={setGallerySearchQuery}
                />

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
                      ? "No receipts matched that search yet."
                      : "No receipt images yet. Add one when creating or editing an expense."}
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
                                {expense.category || "Receipt"}
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
                          {expense.notes?.trim() ||
                            "Tap to view the full receipt"}
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
                    Account
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: theme.faint }]}
                  >
                    Manage your identity, preferences, and security details.
                  </Text>

                  <Text
                    style={[styles.profileSectionLabel, { color: theme.faint }]}
                  >
                    Account overview
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
                      <View style={styles.profileTopRow}>
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
                          >
                            {user.name}
                          </Text>
                          <Text
                            style={[styles.profileEmail, { color: theme.text }]}
                          >
                            {user.email}
                          </Text>
                          <Text
                            style={[
                              styles.profileMeta,
                              { color: theme.accent },
                            ]}
                          >
                            Logged in since{" "}
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "Today"}
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
                                Currency {preferredCurrency}
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
                        Account actions
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Update your profile details or reopen the first-time
                        tips.
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
                            Edit profile
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            themeMode === "light" &&
                              styles.secondaryButtonLight,
                          ]}
                          onPress={() => setShowGuideCard(true)}
                        >
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              themeMode === "light" &&
                                styles.secondaryButtonTextLight,
                            ]}
                          >
                            Show tips again
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
                        Preferences
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Choose the currency you want to see across totals and
                        exports.
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
                            )?.label || "Preferred currency"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={theme.accent}
                        />
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
                        Security
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Keep your sign-in details up to date and secure.
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
                            Change password
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
                    Help and Support
                  </Text>
                  <Text
                    style={[styles.sectionSubtitle, { color: theme.faint }]}
                  >
                    Policies, answers, support contact, and app information.
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
                        Terms and Conditions
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Usage rules, storage expectations, and account
                        responsibility.
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
                        Privacy Policy
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        How profile details, expenses, and receipts are handled.
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
                        FAQ
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Common questions about sync, receipts, exports, and
                        recurring plans.
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
                        About EyeGasto
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Product purpose and what makes this tracker different.
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
                        Contact Support
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Reach the EyeGasto support inbox for help with your
                        account.
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons name="mail-outline" size={18} color="#7DD3FC" />
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
                    onPress={handleReportBug}
                  >
                    <View style={styles.legalCopy}>
                      <Text style={[styles.legalTitle, { color: theme.title }]}>
                        Report a Bug
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Send a bug report with the issue details and what you
                        expected.
                      </Text>
                    </View>
                    <View style={styles.legalIconWrap}>
                      <Ionicons name="bug-outline" size={18} color="#7DD3FC" />
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
                        App Version
                      </Text>
                      <Text
                        style={[styles.legalSubtitle, { color: theme.muted }]}
                      >
                        Version {APP_VERSION}
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
                  Session
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
                    Log Out
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
            },
          ]}
        >
          {navigationItems.slice(0, 2).map((item) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => setActiveTab(item.key)}
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

          {navigationItems.slice(2).map((item) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => setActiveTab(item.key)}
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
                  Add Expense
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  Log a new expense without leaving your dashboard.
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
                initialValues={quickAddDraft ?? undefined}
                onSuccess={() => {
                  setShowAddForm(false);
                  setQuickAddDraft(null);
                }}
                embedded
              />
            </ScrollView>
          </BlurView>
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
                    Edit Profile
                  </Text>
                  <Text
                    style={[
                      styles.addExpenseModalSubtitle,
                      { color: theme.muted },
                    ]}
                  >
                    Update your name and email in one place.
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
                  placeholder="Name"
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
                  placeholder="Email"
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
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSaveProfile}
                  >
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showCurrencyPicker}
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={34}
            tint={themeMode === "light" ? "light" : "dark"}
            style={[
              styles.infoCard,
              isCompact && styles.infoCardCompact,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.addExpenseModalCopy}>
                <Text style={[styles.modalTitle, { color: theme.title }]}>
                  Choose Currency
                </Text>
                <Text
                  style={[
                    styles.addExpenseModalSubtitle,
                    { color: theme.muted },
                  ]}
                >
                  Pick the currency you want to use across the app.
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
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={18}
                        color={theme.faint}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </BlurView>
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
                    Change Password
                  </Text>
                  <Text
                    style={[
                      styles.addExpenseModalSubtitle,
                      { color: theme.muted },
                    ]}
                  >
                    Update your password without leaving the profile screen.
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
                    placeholder="Current password"
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
                    placeholder="New password"
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
                    placeholder="Confirm new password"
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
                        Cancel
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
                          Update password
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </BlurView>
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
              Export Options
            </Text>
            <Text style={[styles.infoBody, { color: theme.text }]}>
              Choose the format that fits your review flow: spreadsheet-ready
              CSV, shareable PDF, or a printable summary report.
            </Text>

            <View style={styles.exportOptionsStack}>
              {[
                {
                  key: "csv" as const,
                  icon: "grid-outline" as const,
                  title: "CSV Spreadsheet",
                  subtitle:
                    "Best for Excel, Google Sheets, and finance review.",
                },
                {
                  key: "pdf" as const,
                  icon: "document-outline" as const,
                  title: "PDF Report",
                  subtitle: "Readable report for sharing, saving, or printing.",
                },
                {
                  key: "summary" as const,
                  icon: "document-text-outline" as const,
                  title: "Summary Report",
                  subtitle:
                    "Printable report on web and shareable text summary on app.",
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
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </BlurView>
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
            <BlurView intensity={32} tint="dark" style={styles.viewerInfo}>
              <Text style={styles.viewerTitle}>
                {selectedReceipt.description}
              </Text>
              <Text style={styles.viewerMeta}>
                {formatAmount(selectedReceipt.amount)} {"•"}{" "}
                {selectedReceipt.category || "Uncategorized"}
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
                <Text style={styles.primaryButtonText}>Edit expense</Text>
              </TouchableOpacity>
            </BlurView>
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
                Edit Expense
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
                placeholder="Description"
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
                placeholder="Amount"
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
                placeholder="Category"
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
                placeholder="Notes"
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
                    Receipt image
                  </Text>
                  <Text style={[styles.legalSubtitle, { color: theme.muted }]}>
                    Upload or replace the saved receipt for this expense.
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
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                <Text style={styles.primaryButtonText}>
                  {isSavingEdit ? "Saving..." : "Save changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
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
                          <Text
                            style={[
                              styles.infoSectionBody,
                              { color: theme.text },
                            ]}
                          >
                            {item.answer}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : infoSheet ? (
                <View style={styles.infoStack}>
                  {infoContent[infoSheet].sections.map((section) => (
                    <View
                      key={section.heading}
                      style={[
                        styles.infoSectionCard,
                        {
                          backgroundColor: theme.mutedSurface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.infoSectionTitle,
                          { color: theme.title },
                        ]}
                      >
                        {section.heading}
                      </Text>
                      <Text
                        style={[styles.infoSectionBody, { color: theme.text }]}
                      >
                        {section.body}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setInfoSheet(null)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </TouchableOpacity>
          </BlurView>
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
    alignItems: "flex-start",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerLeftCompact: {
    alignItems: "flex-start",
  },
  headerBrandBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 0,
    backgroundColor: "transparent",
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
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#F8FAFC" },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    flexShrink: 1,
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
  budgetBlock: { flex: 1 },
  budgetSummary: { alignItems: "flex-end" },
  budgetSummaryCompact: {
    alignItems: "flex-start",
    marginTop: 8,
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
  workspaceRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  workspaceColumn: { flexDirection: "column" },
  recentPanel: { flex: 2, minWidth: 320 },
  signalPanel: { flex: 1, minWidth: 280 },
  fullWidthPanel: { minWidth: "100%", width: "100%", flex: 0 },
  clearButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(127, 29, 29, 0.18)",
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
  categoryBreakdownCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  categoryBreakdownList: {
    marginTop: 14,
    gap: 12,
  },
  categoryBreakdownRow: {
    gap: 8,
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
  profileCopy: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "900", color: "#F8FAFC" },
  profileEmail: { marginTop: 4, fontSize: 14, color: "#CBD5E1" },
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
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectFieldCopy: {
    flex: 1,
  },
  selectFieldValue: {
    fontSize: 15,
    fontWeight: "900",
  },
  selectFieldLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
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
  currencyOptionRow: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  currencyOptionRowActive: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  currencyOptionCopy: {
    flex: 1,
  },
  currencyOptionCode: {
    fontSize: 15,
    fontWeight: "900",
  },
  currencyOptionCodeActive: {
    color: "#22D3EE",
  },
  currencyOptionLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
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
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 8,
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 16,
  },
  navItemActive: { backgroundColor: "rgba(34, 211, 238, 0.12)" },
  navLabel: { marginTop: 4, fontSize: 11, fontWeight: "700", color: "#64748B" },
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
  },
  addExpenseModalSubtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#F8FAFC" },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.92)",
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
