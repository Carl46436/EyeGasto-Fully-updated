import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  Animated,
  Platform,
} from "react-native";
import ExpenseItem from "./ExpenseItem";
import { Expense } from "@/src/types";
import { CurrencyCode } from "@/src/services/currency";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

interface Props {
  expenses: Expense[];
  onDelete?: (id: string) => void;
  onEdit?: (expense: Expense) => void;
  mode?: "dark" | "light";
  currencyCode?: CurrencyCode;
  emptyTitle?: string;
  emptySubtitle?: string;
  language?: AppLanguage;
}

export default function ExpenseList({
  expenses,
  onDelete,
  onEdit,
  mode = "dark",
  currencyCode = "PHP",
  emptyTitle = "No expenses yet",
  emptySubtitle = "Add your first expense, attach a receipt, and start building your budget history.",
  language = "English",
}: Props) {
  const isLight = mode === "light";
  const uiLanguage = resolveUiLanguage(language);
  const todayLabel = uiLanguage === "Filipino" ? "Ngayon" : "Today";
  const yesterdayLabel = uiLanguage === "Filipino" ? "Kahapon" : "Yesterday";
  const emptyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (expenses.length === 0) {
      emptyAnim.setValue(0);
      Animated.timing(emptyAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [emptyAnim, expenses.length]);

  if (expenses.length === 0) {
    return (
      <Animated.View
        style={[
          styles.emptyContainer,
          {
            opacity: emptyAnim,
            transform: [
              {
                translateY: emptyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={[styles.emptyText, isLight && styles.emptyTextLight]}>
          {emptyTitle}
        </Text>
        <Text
          style={[styles.emptySubtitle, isLight && styles.emptySubtitleLight]}
        >
          {emptySubtitle}
        </Text>
      </Animated.View>
    );
  }

  // Helper to group expenses by date
  const groupExpenses = () => {
    const groups: { [key: string]: Expense[] } = {};
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

    expenses.forEach((expense) => {
      const dateStr = new Date(expense.date).toLocaleDateString();
      let label = dateStr;
      
      if (dateStr === today) label = todayLabel;
      else if (dateStr === yesterday) label = yesterdayLabel;
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(expense);
    });

    return groups;
  };

  const grouped = groupExpenses();
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === todayLabel) return -1;
    if (b === todayLabel) return 1;
    if (a === yesterdayLabel) return -1;
    if (b === yesterdayLabel) return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <View style={styles.listContainer}>
      {sortedKeys.map((dateLabel) => (
        <View key={dateLabel} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLabelBadge}>
              <Text
                style={[
                  styles.sectionHeaderText,
                  isLight && styles.sectionHeaderTextLight,
                ]}
              >
                {dateLabel}
              </Text>
            </View>
            <View style={[styles.sectionLine, isLight && styles.sectionLineLight]} />
          </View>
          {grouped[dateLabel].map((item) => (
            <ExpenseItem
              key={item.id}
              description={item.description}
              amount={item.amount}
              date={item.date}
              category={item.category}
              notes={item.notes}
              imageUrl={item.imageUrl}
              isPending={item.isPending}
              mode={mode}
              currencyCode={currencyCode}
              language={language}
              onDelete={onDelete ? () => onDelete(item.id) : undefined}
              onPress={onEdit ? () => onEdit(item) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 12,
  },
  sectionLabelBadge: {
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.3)",
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7DD3FC",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  sectionHeaderTextLight: {
    color: "#0284C7",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginLeft: 10,
  },
  sectionLineLight: {
    backgroundColor: "rgba(15, 23, 42, 0.08)",
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "700",
  },
  emptyTextLight: {
    color: "#64748B",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 280,
  },
  emptySubtitleLight: {
    color: "#64748B",
  },
});
