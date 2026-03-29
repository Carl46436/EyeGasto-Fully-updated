import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import AddExpenseForm from "./AddExpenseForm";
import ExpenseList from "./ExpenseList";
import StatsCard from "./StatsCard";
import { Expense, User } from "../types/index";

interface Props {
  user: User;
  expenses: Expense[];
  onAddExpense: (
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
  ) => boolean | Promise<boolean>;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (
    id: string,
    updates: Partial<Expense>,
  ) => Promise<boolean> | boolean;
  onUpdateUser?: (updates: Partial<User>) => Promise<void>;
  onChangePassword?: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<void>;
  onClearAll: () => Promise<void>;
  onLogout: () => void;
}

type InfoSheet = "terms" | "about" | null;

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);

export default function DashboardScreen({
  user,
  expenses,
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "profile">(
    "overview",
  );
  const [showAddForm, setShowAddForm] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | "All">(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(10000);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
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
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [infoSheet, setInfoSheet] = useState<InfoSheet>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonth = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return (
          date.getMonth() === currentMonth &&
          date.getFullYear() === currentYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const lastMonthTotal = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return (
          date.getMonth() === lastMonth &&
          date.getFullYear() === lastMonthYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      thisMonth,
      lastMonth: lastMonthTotal,
      total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    };
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach((expense) => {
      const key = expense.category || "Uncategorized";
      breakdown[key] = (breakdown[key] || 0) + expense.amount;
    });
    return breakdown;
  }, [expenses]);

  const categories = useMemo(
    () => ["All", ...Object.keys(categoryBreakdown)],
    [categoryBreakdown],
  );

  const visibleExpenses = useMemo(() => {
    let filtered =
      selectedCategory === "All"
        ? expenses
        : expenses.filter(
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
  }, [expenses, searchQuery, selectedCategory]);

  const displayedExpenses = useMemo(() => {
    if (showAllExpenses || searchQuery.trim()) {
      return visibleExpenses;
    }
    return visibleExpenses.slice(0, 5);
  }, [searchQuery, showAllExpenses, visibleExpenses]);

  const budgetUsage =
    monthlyBudget > 0 ? Math.min(stats.thisMonth / monthlyBudget, 1) : 0;

  const topCategory =
    Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0] || null;

  const graphEntries = useMemo(
    () => Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]),
    [categoryBreakdown],
  );

  const quickAdds = [
    { label: "Coffee", amount: 80, category: "Food" },
    { label: "Lunch", amount: 150, category: "Food" },
    { label: "Transport", amount: 120, category: "Transport" },
    { label: "Groceries", amount: 650, category: "Groceries" },
    { label: "Bills", amount: 1200, category: "Bills" },
  ];

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

  const handleQuickAdd = async (
    description: string,
    amount: number,
    category?: string,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onAddExpense(description, amount, category);
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
    if (!editDescription.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Missing details", "Please enter a valid description and amount.");
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
        await onUpdateUser({ avatar: result.assets[0]?.uri });
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
      setShowPasswordFields(false);
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const infoContent = {
    terms: {
      title: "Terms of Use",
      body:
        "EyeGasto stores account details, expense records, and attached receipt images so users can manage spending history. By using the app, users agree to keep uploaded files lawful, personal, and relevant to expense tracking. Shared devices should be protected with account logout and secure passwords.",
    },
    about: {
      title: "About EyeGasto",
      body:
        "EyeGasto is a modern expense tracker focused on fast entry, clean analytics, and visual proof through receipt uploads. The current experience is built around daily monitoring, category trends, and a streamlined dark interface for mobile-first budgeting.",
    },
  } as const;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View style={styles.headerLeft}>
          {renderAvatar(40, 18)}
          <View>
            <Text style={styles.headerTitle}>EyeGasto</Text>
            <Text style={styles.headerSubtitle}>
              Smart expense tracking with saved receipt evidence.
            </Text>
          </View>
        </View>

        {!isCompact ? (
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles-outline" size={14} color="#67E8F9" />
            <Text style={styles.headerBadgeText}>Live Dashboard</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {activeTab === "overview" ? (
            <>
              <LinearGradient
                colors={["rgba(15,23,42,0.92)", "rgba(8,15,30,0.72)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Text style={styles.heroEyebrow}>Today</Text>
                <Text style={styles.heroTitle}>Track expenses and review activity in one place.</Text>
                <Text style={styles.heroSubtitle}>
                  Add a receipt, update your budget, and scan recent entries without leaving the dashboard.
                </Text>
              </LinearGradient>

              <View style={[styles.panel, styles.addPanel]}>
                <View style={[styles.panelHeader, isCompact && styles.panelHeaderStack]}>
                  <View>
                    <Text style={styles.sectionTitle}>Add Expense</Text>
                    <Text style={styles.sectionSubtitle}>
                      Save the amount, category, notes, and optional receipt.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconToggle}
                    onPress={() => setShowAddForm((value) => !value)}
                  >
                    <Ionicons
                      name={showAddForm ? "remove" : "add"}
                      size={18}
                      color="#E2E8F0"
                    />
                  </TouchableOpacity>
                </View>

                {showAddForm ? <AddExpenseForm onAdd={onAddExpense} /> : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickAddRow}
                >
                  {quickAdds.map((item) => (
                    <TouchableOpacity
                      key={`${item.label}-${item.amount}`}
                      style={styles.quickAddChip}
                      onPress={() =>
                        handleQuickAdd(item.label, item.amount, item.category)
                      }
                    >
                      <Text style={styles.quickAddChipLabel}>{item.label}</Text>
                      <Text style={styles.quickAddChipAmount}>
                        {formatAmount(item.amount)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.panel}>
                <View style={[styles.panelHeader, isCompact && styles.panelHeaderStack]}>
                  <View>
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.sectionSubtitle}>Monthly totals and budget status.</Text>
                  </View>
                </View>

                <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                  <StatsCard
                    title="Last Month"
                    amount={stats.lastMonth}
                    type="expense"
                    period="month"
                  />
                  <StatsCard
                    title="This Month"
                    amount={stats.thisMonth}
                    type="expense"
                    period="month"
                  />
                  <StatsCard
                    title="Total Expenses"
                    amount={stats.total}
                    type="expense"
                    period="total"
                  />
                </View>

                <View style={styles.budgetShell}>
                  <View style={[styles.budgetHeader, isCompact && styles.budgetHeaderStack]}>
                    <View style={styles.budgetBlock}>
                      <Text style={styles.budgetLabel}>Monthly budget</Text>
                      <TextInput
                        style={styles.budgetInput}
                        value={String(monthlyBudget)}
                        onChangeText={(value) =>
                          setMonthlyBudget(
                            Number.parseFloat(value.replace(/[^0-9.]/g, "")) ||
                              0,
                          )
                        }
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.budgetSummary}>
                      <Text style={styles.budgetLabel}>Spent so far</Text>
                      <Text style={styles.budgetValue}>
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
                </View>
              </View>

              <View style={[styles.workspaceRow, isCompact && styles.workspaceColumn]}>
                <View style={[styles.panel, styles.recentPanel, isCompact && styles.fullWidthPanel]}>
                  <View style={[styles.panelHeader, isCompact && styles.panelHeaderStack]}>
                    <View>
                      <Text style={styles.sectionTitleLarge}>Recent Expenses</Text>
                      <Text style={styles.sectionSubtitle}>
                        Search and review your latest entries.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={confirmClearAll}
                    >
                      <Text style={styles.clearButtonText}>Clear all</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search expenses, categories, or notes"
                    placeholderTextColor="#64748B"
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
                          selectedCategory === category &&
                            styles.categoryChipActive,
                        ]}
                        onPress={() =>
                          setSelectedCategory(category as typeof selectedCategory)
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            selectedCategory === category &&
                              styles.categoryChipTextActive,
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <ExpenseList
                    expenses={displayedExpenses}
                    onDelete={onDeleteExpense}
                    onEdit={startEditingExpense}
                  />

                  {visibleExpenses.length > 5 && !searchQuery.trim() ? (
                    <TouchableOpacity
                      style={styles.showAllButton}
                      onPress={() => setShowAllExpenses((value) => !value)}
                    >
                      <Text style={styles.showAllButtonText}>
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

                <View style={[styles.panel, styles.signalPanel, isCompact && styles.fullWidthPanel]}>
                  <Text style={styles.sectionTitle}>Insights</Text>
                  <Text style={styles.sectionSubtitle}>
                    Quick context from your current expense activity.
                  </Text>

                  <View style={styles.signalCard}>
                    <Text style={styles.signalLabel}>Top category</Text>
                    <Text style={styles.signalValue}>
                      {topCategory ? topCategory[0] : "No data yet"}
                    </Text>
                    <Text style={styles.signalMeta}>
                      {topCategory ? formatAmount(topCategory[1]) : "Add expenses"}
                    </Text>
                  </View>

                  <View style={styles.signalCard}>
                    <Text style={styles.signalLabel}>Receipts saved</Text>
                    <Text style={styles.signalValue}>
                      {expenses.filter((expense) => expense.imageUrl).length}
                    </Text>
                    <Text style={styles.signalMeta}>
                      Entries with photo proof attached
                    </Text>
                  </View>

                  <View style={styles.signalCard}>
                    <Text style={styles.signalLabel}>Member since</Text>
                    <Text style={styles.signalValue}>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "Today"}
                    </Text>
                    <Text style={styles.signalMeta}>{user.email}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {activeTab === "stats" ? (
              <View style={styles.panel}>
                <View style={[styles.panelHeader, isCompact && styles.panelHeaderStack]}>
                <View>
                  <Text style={styles.sectionTitleLarge}>Expenses Graph</Text>
                  <Text style={styles.sectionSubtitle}>Category totals for the current data set.</Text>
                </View>
              </View>

              <View style={styles.statsSummaryRow}>
                <View style={styles.statsSummaryCard}>
                  <Text style={styles.statsSummaryLabel}>This month</Text>
                  <Text style={styles.statsSummaryValue}>
                    {formatAmount(stats.thisMonth)}
                  </Text>
                </View>
                <View style={styles.statsSummaryCard}>
                  <Text style={styles.statsSummaryLabel}>Last month</Text>
                  <Text style={styles.statsSummaryValue}>
                    {formatAmount(stats.lastMonth)}
                  </Text>
                </View>
              </View>

              {graphEntries.length === 0 ? (
                <Text style={styles.emptyGraphText}>
                  No expenses yet. Add one in the overview tab to populate the
                  graph.
                </Text>
              ) : (
                <ScrollView
                  horizontal={isCompact}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={isCompact ? styles.graphScrollContent : undefined}
                >
                <View style={[styles.graphShell, isCompact && styles.graphShellCompact]}>
                  {graphEntries.map(([category, total], index) => {
                    const max = Math.max(...graphEntries.map(([, value]) => value), 1);
                    const height = Math.max((total / max) * 210, 26);
                    const gradients: Record<number, string[]> = {
                      0: ["#22D3EE", "#3B82F6"],
                      1: ["#34D399", "#10B981"],
                      2: ["#F59E0B", "#FB7185"],
                      3: ["#A78BFA", "#8B5CF6"],
                    };
                    const barColors =
                      gradients[index] || ["#38BDF8", "#818CF8"];

                    return (
                      <View key={category} style={[styles.graphColumn, isCompact && styles.graphColumnCompact]}>
                        <Text style={styles.graphValue}>
                          {formatAmount(total)}
                        </Text>
                        <View style={styles.graphTrack}>
                          <LinearGradient
                            colors={barColors as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={[styles.graphBar, { height }]}
                          />
                        </View>
                        <Text style={styles.graphLabel} numberOfLines={2}>
                          {category}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                </ScrollView>
              )}
            </View>
          ) : null}

          {activeTab === "profile" ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Profile</Text>
                <Text style={styles.sectionSubtitle}>Manage your account, photo, and security details.</Text>

                <View style={styles.profileCard}>
                  {isEditingProfile ? (
                    <>
                      <TextInput
                        style={styles.profileInput}
                        placeholder="Name"
                        placeholderTextColor="#64748B"
                        value={editName}
                        onChangeText={setEditName}
                      />
                      <TextInput
                        style={styles.profileInput}
                        placeholder="Email"
                        placeholderTextColor="#64748B"
                        value={editEmail}
                        onChangeText={setEditEmail}
                      />
                      <View style={styles.profileActionRow}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => {
                            setEditName(user.name);
                            setEditEmail(user.email);
                            setIsEditingProfile(false);
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={handleSaveProfile}
                        >
                          <Text style={styles.primaryButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
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
                          <Text style={styles.profileName}>{user.name}</Text>
                          <Text style={styles.profileEmail}>{user.email}</Text>
                          <Text style={styles.profileMeta}>
                            Logged in since{" "}
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "Today"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.profileActionRow}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => setIsEditingProfile(true)}
                        >
                          <Text style={styles.secondaryButtonText}>
                            Edit profile
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() =>
                            setShowPasswordFields((value) => !value)
                          }
                        >
                          <Text style={styles.secondaryButtonText}>
                            Change password
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {showPasswordFields ? (
                  <View style={styles.passwordCard}>
                    {passwordSuccess ? (
                      <Text style={styles.passwordSuccess}>{passwordSuccess}</Text>
                    ) : null}
                    {passwordError ? (
                      <Text style={styles.passwordError}>{passwordError}</Text>
                    ) : null}
                    <TextInput
                      style={styles.profileInput}
                      placeholder="Current password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={oldPassword}
                      onChangeText={setOldPassword}
                    />
                    <TextInput
                      style={styles.profileInput}
                      placeholder="New password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TextInput
                      style={styles.profileInput}
                      placeholder="Confirm new password"
                      placeholderTextColor="#64748B"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
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
                ) : null}
              </View>

              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Legal and App Info</Text>
                <Text style={styles.sectionSubtitle}>Terms and product information for the app.</Text>

                <TouchableOpacity
                  style={styles.legalRow}
                  onPress={() => setInfoSheet("terms")}
                >
                  <View>
                    <Text style={styles.legalTitle}>Terms of Agreement / Use</Text>
                    <Text style={styles.legalSubtitle}>
                      Privacy, storage, and acceptable receipt uploads.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#7DD3FC"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.legalRow}
                  onPress={() => setInfoSheet("about")}
                >
                  <View>
                    <Text style={styles.legalTitle}>About EyeGasto</Text>
                    <Text style={styles.legalSubtitle}>
                      Product purpose and what makes this tracker different.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#7DD3FC"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={confirmLogout}
              >
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color="#FCA5A5"
                />
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      <BlurView
        intensity={26}
        tint="dark"
        style={[styles.bottomNav, isCompact && styles.bottomNavCompact]}
      >
        {[
          { key: "overview", icon: "grid-outline", label: "Overview" },
          { key: "stats", icon: "stats-chart-outline", label: "Stats" },
          { key: "profile", icon: "person-circle-outline", label: "Profile" },
        ].map((item) => {
          const active = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => setActiveTab(item.key as typeof activeTab)}
            >
              <Ionicons
                name={item.icon as any}
                size={20}
                color={active ? "#E0F2FE" : "#64748B"}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(editingExpense)}
        onRequestClose={closeEditingExpense}
      >
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={36}
            tint="dark"
            style={[styles.modalCard, isCompact && styles.modalCardCompact]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeEditingExpense}
              >
                <Ionicons name="close" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.profileInput}
                placeholder="Description"
                placeholderTextColor="#64748B"
                value={editDescription}
                onChangeText={setEditDescription}
              />
              <TextInput
                style={styles.profileInput}
                placeholder="Amount"
                placeholderTextColor="#64748B"
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.profileInput}
                placeholder="Category"
                placeholderTextColor="#64748B"
                value={editCategory}
                onChangeText={setEditCategory}
              />
              <TextInput
                style={[styles.profileInput, styles.modalNotes]}
                placeholder="Notes"
                placeholderTextColor="#64748B"
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
              />

              <TouchableOpacity
                style={styles.legalRow}
                onPress={pickExpenseReceipt}
              >
                <View>
                  <Text style={styles.legalTitle}>Receipt image</Text>
                  <Text style={styles.legalSubtitle}>
                    Upload or replace the saved receipt for this expense.
                  </Text>
                </View>
                <Ionicons name="image-outline" size={18} color="#7DD3FC" />
              </TouchableOpacity>

              {editImageUrl ? (
                <View style={styles.editReceiptPreview}>
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
              </View>
            ) : null}
            </ScrollView>

            <View style={[styles.modalFooter, isVeryCompact && styles.modalActionsStack]}>
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
        <View style={styles.modalBackdrop}>
          <BlurView intensity={34} tint="dark" style={styles.infoCard}>
            <Text style={styles.modalTitle}>
              {infoSheet ? infoContent[infoSheet].title : ""}
            </Text>
            <Text style={styles.infoBody}>
              {infoSheet ? infoContent[infoSheet].body : ""}
            </Text>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#F8FAFC" },
  headerSubtitle: { marginTop: 3, fontSize: 12, color: "#64748B" },
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
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#020617", fontWeight: "900" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
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
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
  },
  panel: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(8, 15, 30, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  addPanel: { marginTop: 16 },
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.92)",
  },
  quickAddRow: { paddingTop: 12, gap: 8 },
  quickAddChip: {
    width: 118,
    borderRadius: 18,
    padding: 13,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  quickAddChipLabel: { fontSize: 14, fontWeight: "700", color: "#F8FAFC" },
  quickAddChipAmount: {
    marginTop: 6,
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
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
  categoryRow: { paddingTop: 12, paddingBottom: 4, gap: 8 },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  categoryChipFixed: {
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipActive: {
    backgroundColor: "rgba(34, 211, 238, 0.14)",
    borderColor: "rgba(34, 211, 238, 0.24)",
  },
  categoryChipText: { color: "#94A3B8", fontWeight: "700" },
  categoryChipTextActive: { color: "#CFFAFE" },
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
  graphShell: {
    marginTop: 18,
    minHeight: 340,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(2, 6, 23, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.06)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  graphScrollContent: {
    paddingRight: 8,
  },
  graphShellCompact: {
    minWidth: 560,
  },
  graphColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  graphColumnCompact: {
    minWidth: 88,
  },
  graphValue: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#CFFAFE",
    textAlign: "center",
  },
  graphTrack: {
    width: "100%",
    maxWidth: 62,
    height: 220,
    justifyContent: "flex-end",
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    padding: 8,
  },
  graphBar: { width: "100%", borderRadius: 18 },
  graphLabel: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center",
  },
  emptyGraphText: { marginTop: 18, color: "#94A3B8", fontSize: 14, lineHeight: 22 },
  profileCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
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
  profileActionRow: { marginTop: 16, flexDirection: "row", gap: 10, flexWrap: "wrap" },
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
  secondaryButtonText: { color: "#E2E8F0", fontWeight: "800" },
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
  legalTitle: { fontSize: 16, fontWeight: "800", color: "#F8FAFC" },
  legalSubtitle: {
    marginTop: 4,
    maxWidth: 260,
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
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
  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    overflow: "hidden",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
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
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#F8FAFC" },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.92)",
  },
  modalBodyScroll: {
    marginTop: 14,
    flexGrow: 1,
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingBottom: 12,
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
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  infoBody: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 24,
    color: "#CBD5E1",
    marginBottom: 18,
  },
});
