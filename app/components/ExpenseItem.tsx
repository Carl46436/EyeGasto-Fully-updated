import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Expense } from "../types/index";

type Props = Omit<Expense, "id"> & {
  onDelete?: () => void;
  onPress?: () => void;
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);

export default function ExpenseItem({
  description,
  amount,
  date,
  category,
  notes,
  imageUrl,
  onDelete,
  onPress,
}: Props) {
  return (
    <BlurView intensity={24} tint="dark" style={styles.blurWrapper}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.content}
          onPress={onPress}
          activeOpacity={0.86}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.receiptThumb}
              contentFit="cover"
            />
          ) : (
            <View style={styles.receiptFallback}>
              <Ionicons name="receipt-outline" size={18} color="#38BDF8" />
            </View>
          )}

          <View style={styles.details}>
            <View style={styles.titleRow}>
              <Text style={styles.desc}>{description}</Text>
              {category ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.date}>
              {new Date(date).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
              {" • "}
              {new Date(date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            {notes ? (
              <Text style={styles.notes} numberOfLines={2}>
                {notes}
              </Text>
            ) : (
              <Text style={styles.notesMuted}>No extra notes saved</Text>
            )}
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amount}>{formatAmount(amount)}</Text>
            <Text style={styles.amountMeta}>
              {imageUrl ? "Receipt saved" : "No receipt"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onPress} style={styles.actionButton}>
            <Ionicons name="create-outline" size={18} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
          </TouchableOpacity>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blurWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginVertical: 5,
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    backgroundColor: "rgba(10, 17, 32, 0.74)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  receiptThumb: {
    width: 58,
    height: 58,
    borderRadius: 16,
  },
  receiptFallback: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.16)",
  },
  details: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  desc: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7DD3FC",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  notes: {
    marginTop: 5,
    fontSize: 12,
    color: "#CBD5E1",
  },
  notesMuted: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
  },
  amountContainer: {
    alignItems: "flex-end",
    maxWidth: 116,
  },
  amount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "right",
  },
  amountMeta: {
    marginTop: 5,
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  actions: {
    gap: 6,
    paddingTop: 2,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.9)",
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127, 29, 29, 0.24)",
  },
});
