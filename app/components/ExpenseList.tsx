import React from "react";
import { View, StyleSheet, Text } from "react-native";
import ExpenseItem from "./ExpenseItem";
import { Expense } from "../types/index";

interface Props {
  expenses: Expense[];
  onDelete?: (id: string) => void;
  onEdit?: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, onDelete, onEdit }: Props) {
  if (expenses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No expenses yet</Text>
      </View>
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
      
      if (dateStr === today) label = "Today";
      else if (dateStr === yesterday) label = "Yesterday";
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(expense);
    });

    return groups;
  };

  const grouped = groupExpenses();
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Yesterday") return -1;
    if (b === "Yesterday") return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <View style={styles.listContainer}>
      {sortedKeys.map((dateLabel) => (
        <View key={dateLabel} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLabelBadge}>
              <Text style={styles.sectionHeaderText}>{dateLabel}</Text>
            </View>
            <View style={styles.sectionLine} />
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
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginLeft: 10,
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
