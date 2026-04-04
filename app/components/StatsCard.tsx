import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { CurrencyCode, formatCurrency } from "../services/currency";

interface Props {
  title: string;
  amount: number;
  type: "expense" | "income";
  period: "month" | "total";
  mode?: "dark" | "light";
  currencyCode?: CurrencyCode;
}

export default function StatsCard({
  title,
  amount,
  type,
  period,
  mode = "dark",
  currencyCode = "PHP",
}: Props) {
  const isExpense = type === "expense";
  const accent = isExpense ? ["#7DD3FC", "#38BDF8"] : ["#86EFAC", "#34D399"];
  const isLight = mode === "light";

  return (
    <BlurView intensity={26} tint="dark" style={styles.card}>
      <View
        style={[
          styles.inner,
          isLight && styles.innerLight,
        ]}
      >
        <Text style={[styles.title, isLight && styles.titleLight]}>{title}</Text>
        <LinearGradient
          colors={accent as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.amountPill}
        >
          <Text style={styles.amount}>{formatCurrency(amount, currencyCode)}</Text>
        </LinearGradient>
        <Text style={[styles.metaLabel, isLight && styles.metaLabelLight]}>
          {period === "total" ? "All recorded expenses" : "Live monthly total"}
        </Text>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    width: "100%",
    ...Platform.select({
      web: {
        width: "31%",
        minWidth: 196,
      } as object,
    }),
  },
  inner: {
    backgroundColor: "rgba(8, 15, 30, 0.82)",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  innerLight: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  title: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  titleLight: {
    color: "#64748B",
  },
  amountPill: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  amount: {
    fontSize: 21,
    fontWeight: "900",
    color: "#020617",
  },
  metaLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  metaLabelLight: {
    color: "#64748B",
  },
});
