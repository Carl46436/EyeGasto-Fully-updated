import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Image as RNImage,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  user: User;
  expenses: Expense[];
  onAddExpense: (
    description: string,
    amount: number,
    category?: string,
    notes?: string,
  ) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (
    id: string,
    updates: Partial<Expense>,
  ) => Promise<void> | void;
  onUpdateUser?: (updates: Partial<User>) => Promise<void>;
  onChangePassword?: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<void>;
  onClearAll: () => Promise<void>;
  onLogout: () => void;
}

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | "All">(
    "All",
  );
  const [monthlyBudget, setMonthlyBudget] = useState(10000);

  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isLargeScreen = windowWidth > 768;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthExpenses = expenses
      .filter((e) => {
        const eDate = new Date(e.date);
        return (
          eDate.getMonth() === currentMonth &&
          eDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const lastMonthExpenses = expenses
      .filter((e) => {
        const eDate = new Date(e.date);
        return (
          eDate.getMonth() === lastMonth &&
          eDate.getFullYear() === lastMonthYear
        );
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      thisMonth: thisMonthExpenses,
      lastMonth: lastMonthExpenses,
      total: totalExpenses,
    };
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "Uncategorized";
      breakdown[cat] = (breakdown[cat] || 0) + e.amount;
    });
    return breakdown;
  }, [expenses]);

  const categories = useMemo(
    () => ["All", ...Object.keys(categoryBreakdown)],
    [categoryBreakdown],
  );

  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "profile">(
    "overview",
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  const visibleExpenses = useMemo(
    () =>
      (() => {
        let filtered =
          selectedCategory === "All"
            ? expenses
            : expenses.filter(
                (e) => (e.category || "Uncategorized") === selectedCategory,
              );

        const q = searchQuery.trim().toLowerCase();
        if (q) {
          filtered = filtered.filter(
            (e) =>
              e.description.toLowerCase().includes(q) ||
              (e.notes?.toLowerCase().includes(q) ?? false),
          );
        }

        return filtered;
      })(),
    [expenses, selectedCategory, searchQuery],
  );

  const displayedExpenses = useMemo(() => {
    if (showAllExpenses || searchQuery.trim()) {
      return visibleExpenses;
    }
    return visibleExpenses.slice(0, 5);
  }, [visibleExpenses, showAllExpenses, searchQuery]);

  const budgetUsage =
    monthlyBudget > 0 ? Math.min(stats.thisMonth / monthlyBudget, 1) : 0;

  const topCategory =
    Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0] || null;

  // Chart Data Logic
  const chartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: 0,
    }));

    expenses.forEach((e) => {
      const eDate = new Date(e.date);
      if (
        eDate.getMonth() === currentMonth &&
        eDate.getFullYear() === currentYear
      ) {
        const dayIndex = eDate.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < dailyData.length) {
          dailyData[dayIndex].amount += e.amount;
        }
      }
    });

    const maxAmount = Math.max(...dailyData.map((d) => d.amount), 1);
    return { data: dailyData, maxAmount };
  }, [expenses]);

  const quickAdds = [
    {
      label: "Coffee ₱80",
      description: "Coffee",
      amount: 80,
      category: "Food",
    },
    {
      label: "Lunch ₱150",
      description: "Lunch",
      amount: 150,
      category: "Food",
    },
    {
      label: "Transport ₱120",
      description: "Transport",
      amount: 120,
      category: "Transport",
    },
    {
      label: "Bills ₱500",
      description: "Bills",
      amount: 500,
      category: "Bills",
    },
    {
      label: "Groceries ₱300",
      description: "Groceries",
      amount: 300,
      category: "Groceries",
    },
    {
      label: "Snacks ₱50",
      description: "Snacks",
      amount: 50,
      category: "Food",
    },
    {
      label: "Entertainment ₱200",
      description: "Entertainment",
      amount: 200,
      category: "Entertainment",
    },
    {
      label: "Other ₱100",
      description: "Miscellaneous",
      amount: 100,
      category: "Other",
    },
  ];

  const handleQuickAdd = async (
    description: string,
    amount: number,
    category?: string,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddExpense(description, amount, category);
  };

  const startEditingExpense = async (expense: Expense) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(expense.amount.toString());
    setEditCategory(expense.category || "");
    setEditNotes(expense.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    const num = parseFloat(editAmount);
    if (!editDescription.trim() || isNaN(num)) {
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onUpdateExpense(editingExpense.id, {
      description: editDescription.trim(),
      amount: num,
      category: editCategory.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    setEditingExpense(null);
  };

  const handleCancelEdit = async () => {
    await Haptics.selectionAsync();
    setEditingExpense(null);
  };

  const confirmClearAll = () => {
    Alert.alert(
      "Clear all expenses",
      "This will remove all your saved expenses. Continue?",
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

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onUpdateUser) {
      await onUpdateUser({ name: editName.trim(), email: editEmail.trim() });
    }
    setIsEditingProfile(false);
  };

  const handleCancelProfile = () => {
    setEditName(user.name);
    setEditEmail(user.email);
    setIsEditingProfile(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword.trim()) {
      setPasswordError("Please enter your current password");
      return;
    }
    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setIsChangingPassword(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!onChangePassword) {
        setPasswordError(
          "Password change is not configured. Please contact support.",
        );
        setIsChangingPassword(false);
        return;
      }

      console.log("[v0] Starting password change...");
      await onChangePassword(oldPassword, newPassword);
      console.log("[v0] Password change successful");

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setPasswordSuccess("Password changed successfully!");
      setShowPasswordFields(false);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success!", "Your password has been changed successfully.");

      setTimeout(() => {
        setPasswordSuccess("");
      }, 3000);
    } catch (error) {
      console.log("[v0] Password change error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to change password. Please try again.";
      setPasswordError(errorMessage);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelPassword = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordFields(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Sorry, we need camera roll permissions to make this work!",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        if (onUpdateUser) {
          await onUpdateUser({ avatar: result.assets[0].uri });
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const renderAvatar = (size: number = 50, fontSize: number = 20) => {
    if (user.avatar) {
      return (
        <Image
          source={{ uri: user.avatar }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={200}
        />
      );
    }
    return (
      <View
        style={[
          styles.profileAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#4F46E5",
          },
        ]}
      >
        <Text style={[styles.profileAvatarText, { fontSize }]}>
          {user.name?.charAt(0).toUpperCase() || "U"}
        </Text>
      </View>
    );
  };

  const confirmLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {renderAvatar(32, 14)}
            <View>
              <Text style={styles.headerTitle}>EyeGasto</Text>
              <Text style={styles.headerSubtitle}>
                Track your expenses in one clean view.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === "overview" && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
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

              <View style={styles.budgetContainer}>
                <View style={styles.budgetHeader}>
                  <View>
                    <Text style={styles.budgetLabel}>This month's budget</Text>
                    <TextInput
                      style={styles.budgetInput}
                      keyboardType="numeric"
                      value={monthlyBudget.toString()}
                      onChangeText={(text) => {
                        const num =
                          parseFloat(text.replace(/[^0-9]/g, "")) || 0;
                        setMonthlyBudget(num);
                      }}
                    />
                  </View>
                  <View>
                    <Text style={styles.budgetLabel}>Spent</Text>
                    <Text style={styles.budgetValue}>
                      ₱{stats.thisMonth.toFixed(0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.budgetBarBackground}>
                  <View
                    style={[
                      styles.budgetBarFill,
                      { width: `${budgetUsage * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={isLargeScreen ? styles.responsiveRow : null}>
              <View style={isLargeScreen ? styles.leftCol : null}>
                <View style={styles.formSection}>
                  <View style={styles.formHeader}>
                    <Text style={styles.sectionTitle}>Add New Expense</Text>
                    <TouchableOpacity
                      onPress={() => setShowAddForm(!showAddForm)}
                      style={styles.toggleBtn}
                    >
                      <Text style={styles.toggleText}>
                        {showAddForm ? "−" : "+"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {showAddForm && (
                    <View>
                      <AddExpenseForm onAdd={onAddExpense} />
                    </View>
                  )}
                  <BlurView
                    intensity={25}
                    tint="dark"
                    style={styles.quickAddWrapper}
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickAddRow}
                    >
                      {quickAdds.map((qa) => (
                        <TouchableOpacity
                          key={qa.label}
                          style={styles.quickAddChip}
                          onPress={() =>
                            handleQuickAdd(
                              qa.description,
                              qa.amount,
                              qa.category,
                            )
                          }
                        >
                          <Text style={styles.quickAddText}>{qa.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </BlurView>
                </View>
              </View>

              <View style={isLargeScreen ? styles.rightCol : null}>
                <View
                  style={[
                    styles.listSection,
                    isLargeScreen && { marginTop: 0 },
                  ]}
                >
                  <View style={styles.listHeaderRow}>
                    <Text style={styles.sectionTitle}>Recent Expenses</Text>
                    <View style={styles.listHeaderActions}>
                      <TouchableOpacity
                        onPress={confirmClearAll}
                        style={styles.clearBtn}
                      >
                        <Text style={styles.clearBtnText}>Clear all</Text>
                      </TouchableOpacity>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryChipsRow}
                      >
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.categoryChip,
                              selectedCategory === cat &&
                                styles.categoryChipActive,
                            ]}
                            onPress={() => setSelectedCategory(cat as any)}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                selectedCategory === cat &&
                                  styles.categoryChipTextActive,
                              ]}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search Expenses or notes"
                    placeholderTextColor="#6B7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <ExpenseList
                    expenses={displayedExpenses}
                    onDelete={onDeleteExpense}
                    onEdit={startEditingExpense}
                  />

                  {visibleExpenses.length > 5 && !searchQuery.trim() && (
                    <TouchableOpacity
                      style={styles.showAllBtn}
                      onPress={() => setShowAllExpenses(!showAllExpenses)}
                    >
                      <Text style={styles.showAllText}>
                        {showAllExpenses
                          ? "Show Less"
                          : `View All (${visibleExpenses.length})`}
                      </Text>
                      <Ionicons
                        name={showAllExpenses ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#6366F1"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {editingExpense && (
              <BlurView intensity={30} tint="dark" style={styles.editCard}>
                <Text style={styles.editTitle}>Edit Expense</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="Description"
                  placeholderTextColor="#6B7280"
                  value={editDescription}
                  onChangeText={setEditDescription}
                />
                <TextInput
                  style={styles.editInput}
                  placeholder="Amount (₱)"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  value={editAmount}
                  onChangeText={setEditAmount}
                />
                <TextInput
                  style={styles.editInput}
                  placeholder="Category"
                  placeholderTextColor="#6B7280"
                  value={editCategory}
                  onChangeText={setEditCategory}
                />
                <TextInput
                  style={[styles.editInput, styles.editNotesInput]}
                  placeholder="Notes"
                  placeholderTextColor="#6B7280"
                  multiline
                  value={editNotes}
                  onChangeText={setEditNotes}
                />
                <View style={styles.editButtonsRow}>
                  <TouchableOpacity
                    style={styles.editCancelBtn}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveBtn}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.editSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Welcome, {user?.name}!</Text>
              <Text style={styles.emailText}>{user?.email}</Text>
              {topCategory && (
                <Text style={styles.loginTimeText}>
                  Top category this month: {topCategory[0]} (₱
                  {topCategory[1].toFixed(0)})
                </Text>
              )}
              <Text style={styles.loginTimeText}>
                Logged in since:{" "}
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "Today"}
              </Text>
            </View>
          </Animated.View>
        )}

        {activeTab === "stats" && (
          <View style={styles.statsTab}>
            <Text style={styles.sectionTitle}>Spending insights</Text>
            <Text style={styles.statsTabSubtitle}>
              See how your Expense are distributed.
            </Text>
            <View style={styles.statsTabRow}>
              <Text style={styles.statsTabLabel}>This month</Text>
              <Text style={styles.statsTabValue}>
                ₱{stats.thisMonth.toFixed(0)}
              </Text>
            </View>
            <View style={styles.statsTabRow}>
              <Text style={styles.statsTabLabel}>Last month</Text>
              <Text style={styles.statsTabValue}>
                ₱{stats.lastMonth.toFixed(0)}
              </Text>
            </View>
            <View style={styles.statsTabRow}>
              <Text style={styles.statsTabLabel}>Total recorded</Text>
              <Text style={styles.statsTabValue}>
                ₱{stats.total.toFixed(0)}
              </Text>
            </View>

            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Expenses Graph</Text>
              {Object.keys(categoryBreakdown).length === 0 ? (
                <Text style={styles.statsTabSubtitle}>
                  No expenses yet. Add some in Overview.
                </Text>
              ) : (
                <View
                  style={[
                    styles.tradingChartContainer,
                    isLargeScreen && {
                      maxWidth: 800,
                      alignSelf: "center",
                      width: "100%",
                    },
                  ]}
                >
                  {/* Background Grid Lines - Horizontal */}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const maxVal = Math.max(
                      ...Object.values(categoryBreakdown),
                      1000,
                    );
                    const labelVal = (maxVal * (i / 4)).toFixed(0);
                    // Use fixed pixel steps for perfect alignment on all platforms
                    const gridBottom = i * 40 + 36;
                    return (
                      <View
                        key={`h-${i}`}
                        style={[styles.tradingGridLine, { bottom: gridBottom }]}
                      >
                        <Text style={styles.tradingYLabel}>₱{labelVal}</Text>
                      </View>
                    );
                  })}
                  {/* Background Grid Lines - Vertical */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={`v-${i}`}
                      style={[
                        styles.tradingGridLineVertical,
                        { left: `${i * 18 + 5}%` },
                      ]}
                    />
                  ))}

                  <View style={styles.tradingChartGrid}>
                    {Object.entries(categoryBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, total], index) => {
                        const maxVal = Math.max(
                          ...Object.values(categoryBreakdown),
                          1000,
                        );
                        // Lowered the multiplier to 140 (from 160) to provide 20px of "Headroom"
                        const barHeight = (total / maxVal) * 140;

                        const gradientMap: Record<number, string[]> = {
                          0: ["#4F46E5", "#6366F1"], // Indigo
                          1: ["#10B981", "#34D399"], // Emerald
                          2: ["#F59E0B", "#FBBF24"], // Amber
                          3: ["#EF4444", "#F87171"], // red
                        };
                        const defaultColors = ["#8B5CF6", "#C084FC"]; // purple
                        const barColors = gradientMap[index] || defaultColors;

                        return (
                          <View key={cat} style={styles.tradingBarColumn}>
                            <View style={styles.tradingBarWrapper}>
                              <View
                                style={[
                                  styles.tradingBarContainer,
                                  { height: barHeight },
                                ]}
                              >
                                <LinearGradient
                                  colors={
                                    barColors as [string, string, ...string[]]
                                  }
                                  style={styles.tradingBarGradient}
                                >
                                  {/* Glow Top Cap */}
                                  <View style={styles.tradingBarGlow} />
                                </LinearGradient>
                              </View>
                            </View>
                            <Text
                              style={styles.tradingBarLabel}
                              numberOfLines={1}
                            >
                              {cat}
                            </Text>
                            <Text style={styles.tradingBarValue}>
                              ₱{total.toFixed(0)}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === "profile" && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionTitle}>Profile</Text>

            <View style={styles.profileCard}>
              {isEditingProfile ? (
                <>
                  <Text style={styles.profileName}>Edit Profile</Text>
                  <TextInput
                    style={styles.profileInput}
                    placeholder="Name"
                    placeholderTextColor="#9CA3AF"
                    value={editName}
                    onChangeText={setEditName}
                  />
                  <TextInput
                    style={styles.profileInput}
                    placeholder="Email"
                    placeholderTextColor="#9CA3AF"
                    value={editEmail}
                    onChangeText={setEditEmail}
                  />
                  <View style={styles.profileActionButtons}>
                    <TouchableOpacity
                      style={styles.profileCancelBtn}
                      onPress={handleCancelProfile}
                    >
                      <Text style={styles.profileCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileSaveBtn}
                      onPress={handleSaveProfile}
                    >
                      <Text style={styles.profileSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.profileHeaderRow}>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      activeOpacity={0.7}
                    >
                      {renderAvatar(60, 24)}
                      <View
                        style={{
                          position: "absolute",
                          right: -4,
                          bottom: -4,
                          backgroundColor: "#4F46E5",
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor: "#111827",
                        }}
                      >
                        <Ionicons name="camera" size={12} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={styles.profileName}>{user.name}</Text>
                      <Text style={styles.profileEmail}>{user.email}</Text>
                    </View>
                  </View>
                  <View style={styles.profileDivider} />
                  <Text style={styles.profileMeta}>
                    Member since{" "}
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "Today"}
                  </Text>
                  <View style={styles.profileButtonsRow}>
                    <TouchableOpacity
                      style={styles.profileEditBtn}
                      onPress={() => setIsEditingProfile(true)}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text style={styles.profileEditText}>Edit Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileSecurityBtn}
                      onPress={() => setShowPasswordFields(!showPasswordFields)}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={14}
                        color="#F59E0B"
                      />
                      <Text style={styles.profileSecurityText}>
                        Change Password
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {showPasswordFields && !isEditingProfile && (
              <View style={styles.profileCard}>
                <Text style={styles.profileName}>Change Password</Text>

                {passwordSuccess ? (
                  <View style={styles.passwordSuccessContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#10B981"
                    />
                    <Text style={styles.passwordSuccessText}>
                      {passwordSuccess}
                    </Text>
                  </View>
                ) : null}

                {passwordError ? (
                  <View style={styles.passwordErrorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text style={styles.passwordErrorText}>
                      {passwordError}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.profileInput}
                  placeholder="Current Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  editable={!isChangingPassword}
                />
                <TextInput
                  style={styles.profileInput}
                  placeholder="New Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!isChangingPassword}
                />
                <TextInput
                  style={styles.profileInput}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isChangingPassword}
                />
                <Text style={styles.passwordHint}>
                  Password must be at least 6 characters
                </Text>
                <View style={styles.profileActionButtons}>
                  <TouchableOpacity
                    style={styles.profileCancelBtn}
                    onPress={handleCancelPassword}
                    disabled={isChangingPassword}
                  >
                    <Text style={styles.profileCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.profileSaveBtn,
                      { backgroundColor: "#F59E0B" },
                    ]}
                    onPress={handleChangePassword}
                    disabled={isChangingPassword}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {isChangingPassword && (
                        <ActivityIndicator size="small" color="#FFF" />
                      )}
                      <Text style={styles.profileSaveText}>
                        {isChangingPassword ? "Updating..." : "Update Password"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.profileSecuritySection}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color="#F59E0B"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.profileSecuritySectionTitle}>
                Account Security
              </Text>
              <Text style={styles.profileSecuritySectionText}>
                Your password is encrypted and secure. Change it regularly for
                better account protection.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileLogoutBtn}
              onPress={confirmLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={16}
                color="#EF4444"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.profileLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <BlurView intensity={35} tint="dark" style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.bottomNavItem,
            activeTab === "overview" && styles.bottomNavItemActive,
          ]}
          onPress={() => setActiveTab("overview")}
        >
          <Ionicons
            name="home-outline"
            size={20}
            color={activeTab === "overview" ? "#F9FAFB" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.bottomNavLabel,
              activeTab === "overview" && styles.bottomNavLabelActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bottomNavItem,
            activeTab === "stats" && styles.bottomNavItemActive,
          ]}
          onPress={() => setActiveTab("stats")}
        >
          <Ionicons
            name="stats-chart-outline"
            size={20}
            color={activeTab === "stats" ? "#F9FAFB" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.bottomNavLabel,
              activeTab === "stats" && styles.bottomNavLabelActive,
            ]}
          >
            Stats
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bottomNavItem,
            activeTab === "profile" && styles.bottomNavItemActive,
          ]}
          onPress={() => setActiveTab("profile")}
        >
          <Ionicons
            name="person-circle-outline"
            size={20}
            color={activeTab === "profile" ? "#F9FAFB" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.bottomNavLabel,
              activeTab === "profile" && styles.bottomNavLabelActive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1120",
  },
  header: {
    marginTop: 25,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#111827",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1F2937",
    alignItems: "center",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    maxWidth: 1200,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogoText: {
    fontSize: 18,
    color: "#FACC15",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5fa",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    opacity: 0.9,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(127, 128, 125, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  logoutText: {
    fontSize: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 140,
    backgroundColor: "#020617",
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 12,
  },
  statsGrid: {
    gap: 10,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    flexWrap: "wrap",
    justifyContent: Platform.OS === "web" ? "space-between" : "flex-start",
  },
  chartSection: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(11, 12, 15, 0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  chartGrid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  chartGridLine: {
    height: 1,
    backgroundColor: "#2b3645",
    opacity: 0.5,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  chartBar: {
    width: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  chartDayLabel: {
    fontSize: 10,
    color: "#e2e8f5",
    marginTop: 4,
  },
  categoryChartContainer: {
    gap: 16,
    marginTop: 12,
  },
  categoryChartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryChartLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    width: 90,
  },
  categoryChartBarWrapper: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(15,23,42,0.9)",
    overflow: "hidden",
  },
  categoryChartBar: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#4F46E5",
  },
  categoryChartAmount: {
    fontSize: 12,
    color: "#E5E7EB",
    fontWeight: "600",
    width: 70,
    textAlign: "right",
  },
  tradingChartContainer: {
    height: 240,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    position: "relative",
    overflow: "hidden", // Prevent bleeding outside
  },
  tradingGridLine: {
    position: "absolute",
    left: 10,
    right: 55, // Increased room for labels
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    flexDirection: "row",
    alignItems: "center",
  },
  tradingYLabel: {
    position: "absolute",
    right: -48, // Adjusted position
    fontSize: 9,
    color: "#64748B",
    fontWeight: "600",
    width: 45,
    textAlign: "left",
  },
  tradingGridLineVertical: {
    position: "absolute",
    top: 10,
    bottom: 20,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  tradingChartGrid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    zIndex: 1,
    paddingTop: 30, // Extra headroom
    paddingBottom: 36,
    paddingRight: 55,
  },
  tradingBarColumn: {
    flex: 1,
    alignItems: "center",
    maxWidth: Platform.OS === "web" ? 80 : 60,
  },
  tradingBarWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  tradingBarContainer: {
    width: Platform.OS === "web" ? 24 : 18,
    borderRadius: 12, // Ensure full rounding
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tradingBarGradient: {
    flex: 1,
    borderRadius: 10,
  },
  tradingBarGlow: {
    height: 4,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tradingBarLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 2,
    fontWeight: "600",
    textAlign: "center",
  },
  tradingBarValue: {
    fontSize: 11,
    color: "#F9FAFB",
    fontWeight: "800",
    textAlign: "center",
  },
  budgetContainer: {
    marginTop: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  budgetValue: {
    fontSize: 12,
    color: "#E5E7EB",
    fontWeight: "600",
  },
  budgetInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E5E7EB",
    fontSize: 14,
    width: 140,
    marginTop: 4,
  },
  budgetBarBackground: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  budgetBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  formSection: {
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  toggleText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  listSection: {
    marginBottom: 20,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChipsRow: {
    paddingLeft: 8,
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    backgroundColor: "rgba(15,23,42,0.7)",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  categoryChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#6366F1",
  },
  categoryChipText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  categoryChipTextActive: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4B5563",
    backgroundColor: "rgba(15,23,42,0.8)",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  clearBtnText: {
    fontSize: 11,
    color: "#F97316",
    fontWeight: "600",
  },
  showAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.1)",
    gap: 8,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  showAllText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "700",
  },
  quickAddWrapper: {
    marginTop: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  quickAddRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  quickAddChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  quickAddText: {
    fontSize: 12,
    color: "#E5E7EB",
    fontWeight: "500",
  },
  responsiveRow: {
    flexDirection: "row",
    gap: 24,
  },
  leftCol: {
    flex: 1.2,
  },
  rightCol: {
    flex: 2,
  },
  searchInput: {
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#E5E7EB",
    fontSize: 13,
  },
  editCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
  },
  editTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 8,
  },
  editInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#E5E7EB",
    fontSize: 13,
    marginBottom: 8,
  },
  editNotesInput: {
    height: 64,
    textAlignVertical: "top",
  },
  editButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4B5563",
    backgroundColor: "transparent",
  },
  editCancelText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  editSaveBtn: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  editSaveText: {
    fontSize: 12,
    color: "#F9FAFB",
    fontWeight: "600",
  },
  statsTab: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
  },
  statsTabSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  statsTabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statsTabLabel: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  statsTabValue: {
    fontSize: 13,
    color: "#E5E7EB",
    fontWeight: "600",
  },
  statsCategories: {
    marginTop: 14,
  },
  statsCategoriesTitle: {
    fontSize: 13,
    color: "#E5E7EB",
    fontWeight: "600",
    marginBottom: 6,
  },
  statsCategoryRow: {
    marginTop: 6,
  },
  statsCategoryLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  statsCategoryBarBackground: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  statsCategoryBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#6366F1",
  },
  statsCategoryAmount: {
    fontSize: 11,
    color: "#E5E7EB",
    marginTop: 2,
  },
  profileSection: {
    marginTop: 16,
  },
  profileCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 12,
  },
  profileEmail: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 2,
  },
  profileMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  profileHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 10,
  },
  profileInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#374151",
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#E5E7EB",
    fontSize: 13,
    marginBottom: 8,
  },
  profileActionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  profileCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4B5563",
    backgroundColor: "transparent",
  },
  profileCancelText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  profileSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#4F46E5",
  },
  profileSaveText: {
    fontSize: 12,
    color: "#F9FAFB",
    fontWeight: "600",
  },
  profileEditBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4F46E5",
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    gap: 6,
  },
  profileEditText: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "600",
  },
  profileLogoutBtn: {
    marginTop: 16,
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  profileLogoutText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "600",
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  profileDivider: {
    height: 1,
    backgroundColor: "#1F2937",
    marginVertical: 10,
  },
  profileButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  profileSecurityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    gap: 6,
  },
  profileSecurityText: {
    fontSize: 12,
    color: "#F59E0B",
    fontWeight: "600",
  },
  passwordErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  passwordErrorText: {
    fontSize: 12,
    color: "#FCA5A5",
    fontWeight: "500",
    flex: 1,
  },
  passwordSuccessContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#10B981",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  passwordSuccessText: {
    fontSize: 12,
    color: "#A7F3D0",
    fontWeight: "500",
    flex: 1,
  },
  passwordHint: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 12,
    marginTop: -6,
  },
  profileSecuritySection: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F59E0B",
    alignItems: "center",
  },
  profileSecuritySectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F59E0B",
    marginBottom: 6,
  },
  profileSecuritySectionText: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
    textAlign: "center",
  },
  bottomNav: {
    position: "absolute",
    left: Platform.OS === "web" ? "50%" : 16,
    right: Platform.OS === "web" ? "auto" : 16,
    bottom: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    ...Platform.select({
      web: {
        width: 400,
        marginLeft: -200,
      } as any,
    }),
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  bottomNavItemActive: {
    transform: [{ translateY: -2 }],
  },
  bottomNavLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  bottomNavLabelActive: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
  userInfo: {
    padding: 16,
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E5E7EB",
  },
  emailText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  loginTimeText: {
    fontSize: 12,
    color: "#6B7280",
  },
});
