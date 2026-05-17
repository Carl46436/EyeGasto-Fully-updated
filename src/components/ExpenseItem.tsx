import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Expense } from "@/src/types";
import { CurrencyCode, formatCurrency } from "@/src/services/currency";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

type Props = Omit<Expense, "id"> & {
  onDelete?: () => void;
  onPress?: () => void;
  mode?: "dark" | "light";
  currencyCode?: CurrencyCode;
  language?: AppLanguage;
};

export default function ExpenseItem({
  description,
  amount,
  date,
  category,
  notes,
  imageUrl,
  isPending,
  onDelete,
  onPress,
  mode = "dark",
  currencyCode = "PHP",
  language = "English",
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isLight = mode === "light";
  const useBlurWrapper = Platform.OS !== "web";
  const uiLanguage = resolveUiLanguage(language);
  const copy =
    uiLanguage === "Filipino"
      ? {
          noNotes: "Walang dagdag na notes",
          syncing: "Nagsi-sync...",
          receiptSaved: "May resibo",
          noReceipt: "Walang resibo",
        }
      : {
          noNotes: "No extra notes saved",
          syncing: "Syncing...",
          receiptSaved: "Receipt saved",
          noReceipt: "No receipt",
        };

  const cardContent = (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        isLight && styles.containerLight,
      ]}
    >
      <TouchableOpacity
        style={[styles.content, isCompact && styles.contentCompact]}
        onPress={onPress}
        activeOpacity={0.86}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.receiptThumb, isCompact && styles.receiptThumbCompact]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.receiptFallback,
              isCompact && styles.receiptFallbackCompact,
              isLight && styles.receiptFallbackLight,
            ]}
          >
            <Ionicons
              name="receipt-outline"
              size={18}
              color={isLight ? "#0284C7" : "#38BDF8"}
            />
          </View>
        )}

        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.desc, isCompact && styles.descCompact, isLight && styles.descLight]}
              numberOfLines={2}
            >
              {description}
            </Text>
            {category ? (
              <View
                style={[
                  styles.categoryPill,
                  isLight && styles.categoryPillLight,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isLight && styles.categoryTextLight,
                  ]}
                >
                  {category}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.date, isLight && styles.dateLight]} numberOfLines={1}>
            {new Date(date).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
            {" | "}
            {new Date(date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>

          {notes ? (
            <Text
              style={[styles.notes, isLight && styles.notesLight]}
              numberOfLines={2}
            >
              {notes}
            </Text>
          ) : (
            <Text style={[styles.notesMuted, isLight && styles.notesMutedLight]}>
              {copy.noNotes}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.amountContainer,
            isCompact && styles.amountContainerCompact,
          ]}
        >
          <Text
            style={[
              styles.amount,
              isCompact && styles.amountCompact,
              isLight && styles.amountLight,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(amount, currencyCode)}
          </Text>
          <Text
            style={[
              styles.amountMeta,
              isCompact && styles.amountMetaCompact,
              isLight && styles.amountMetaLight,
            ]}
            numberOfLines={1}
          >
            {isPending ? copy.syncing : imageUrl ? copy.receiptSaved : copy.noReceipt}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={[styles.actions, isCompact && styles.actionsCompact]}>
        <TouchableOpacity
          onPress={onPress}
          style={[styles.actionButton, isLight && styles.actionButtonLight]}
          disabled={isPending}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={isLight ? "#334155" : "#E2E8F0"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={[
            styles.deleteButton,
            isLight && styles.deleteButtonLight,
            isPending && styles.disabledAction,
          ]}
          disabled={isPending}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={isLight ? "#DC2626" : "#FCA5A5"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.blurWrapper}>
      {useBlurWrapper ? (
        <BlurView
          intensity={24}
          tint={isLight ? "light" : "dark"}
          style={styles.blurFill}
        >
          {cardContent}
        </BlurView>
      ) : (
        <View style={styles.blurFill}>{cardContent}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blurWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginVertical: 5,
  },
  blurFill: {
    borderRadius: 20,
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
  containerCompact: {
    gap: 8,
    padding: 10,
  },
  containerLight: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  contentCompact: {
    gap: 8,
  },
  receiptThumb: {
    width: 58,
    height: 58,
    borderRadius: 16,
  },
  receiptThumbCompact: {
    width: 46,
    height: 46,
    borderRadius: 13,
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
  receiptFallbackCompact: {
    width: 46,
    height: 46,
    borderRadius: 13,
  },
  receiptFallbackLight: {
    backgroundColor: "rgba(240, 249, 255, 0.98)",
    borderColor: "rgba(2, 132, 199, 0.14)",
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  desc: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  descCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  descLight: {
    color: "#0F172A",
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  categoryPillLight: {
    backgroundColor: "rgba(2, 132, 199, 0.08)",
    borderColor: "rgba(2, 132, 199, 0.18)",
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7DD3FC",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  categoryTextLight: {
    color: "#0284C7",
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  dateLight: {
    color: "#64748B",
  },
  notes: {
    marginTop: 5,
    fontSize: 12,
    color: "#CBD5E1",
  },
  notesLight: {
    color: "#475569",
  },
  notesMuted: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
  },
  notesMutedLight: {
    color: "#94A3B8",
  },
  amountContainer: {
    alignItems: "flex-end",
    width: 112,
    flexShrink: 0,
  },
  amountContainerCompact: {
    width: 82,
  },
  amount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "right",
  },
  amountCompact: {
    fontSize: 13,
  },
  amountLight: {
    color: "#0F172A",
  },
  amountMeta: {
    marginTop: 5,
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  amountMetaCompact: {
    fontSize: 10,
  },
  amountMetaLight: {
    color: "#64748B",
  },
  actions: {
    gap: 6,
    paddingTop: 2,
  },
  actionsCompact: {
    gap: 5,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.9)",
  },
  actionButtonLight: {
    backgroundColor: "rgba(241, 245, 249, 0.96)",
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127, 29, 29, 0.24)",
  },
  deleteButtonLight: {
    backgroundColor: "rgba(254, 226, 226, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  disabledAction: {
    opacity: 0.55,
  },
});
