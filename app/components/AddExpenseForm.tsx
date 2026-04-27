import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CurrencyCode } from "@/src/services/currency";
import { createShadow } from "@/src/utils/shadow";

interface Props {
  onAdd: (
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
    options?: {
      recurringMonthly?: boolean;
    },
  ) => boolean | Promise<boolean>;
  mode?: "dark" | "light";
  categories?: string[];
  onSuccess?: () => void;
  embedded?: boolean;
  currencyCode?: CurrencyCode;
  initialValues?: {
    description?: string;
    amount?: number;
    category?: string;
    notes?: string;
  };
  onNotify?: (message: string, type?: "error" | "warning" | "success") => void;
}

const DEFAULT_CATEGORIES = [
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

export default function AddExpenseForm({
  onAdd,
  mode = "dark",
  categories = [],
  onSuccess,
  embedded = false,
  currencyCode = "PHP",
  initialValues,
  onNotify,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const isLight = mode === "light";
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [amount, setAmount] = useState(
    initialValues?.amount !== undefined ? String(initialValues.amount) : "",
  );
  const [category, setCategory] = useState(initialValues?.category ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [isRecurringMonthly, setIsRecurringMonthly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const categoryOptions = Array.from(
    new Set(
      [...DEFAULT_CATEGORIES, ...categories]
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  useEffect(() => {
    setDescription(initialValues?.description ?? "");
    setAmount(
      initialValues?.amount !== undefined ? String(initialValues.amount) : "",
    );
    setCategory(initialValues?.category ?? "");
    setNotes(initialValues?.notes ?? "");
    setImageUri(undefined);
    setIsRecurringMonthly(false);
    setShowCategoryMenu(false);
  }, [initialValues]);

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        onNotify?.(
          "Photo access is required so receipts can be attached to expenses.",
          "warning",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 5],
      });

      if (!result.canceled) {
        setImageUri(result.assets[0]?.uri);
      }
    } catch (error) {
      console.error("Failed to pick receipt image", error);
      onNotify?.("We could not select that image.", "error");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        onNotify?.(
          "Camera access is required so you can capture a receipt directly.",
          "warning",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 5],
      });

      if (!result.canceled) {
        setImageUri(result.assets[0]?.uri);
      }
    } catch (error) {
      console.error("Failed to capture receipt image", error);
      onNotify?.("We could not open the camera.", "error");
    }
  };

  const handleSubmit = async () => {
    const numericAmount = Number.parseFloat(amount);
    if (
      !description.trim() ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      onNotify?.("Please enter a valid expense name and amount.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAdd(
        description.trim(),
        numericAmount,
        category.trim() || undefined,
        notes.trim() || undefined,
        imageUri,
        { recurringMonthly: isRecurringMonthly },
      );

      if (!success) {
        return;
      }

      setDescription("");
      setAmount("");
      setCategory("");
      setNotes("");
      setImageUri(undefined);
      setIsRecurringMonthly(false);
      setShowCategoryMenu(false);
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, embedded && styles.wrapperEmbedded]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {embedded ? (
        <View style={[styles.containerEmbedded, isLight && styles.containerEmbeddedLight]}>
          <View style={[styles.row, isCompact && styles.rowStack]}>
            <View style={styles.inputBlock}>
              <Text style={[styles.label, isLight && styles.labelLight]}>
                Expense name
              </Text>
              <TextInput
                style={[styles.input, isLight && styles.inputLight]}
                placeholder="Dinner with Kean"
                placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
                value={description}
                onChangeText={setDescription}
              />
            </View>
            <View
              style={[
                styles.inputBlock,
                styles.amountBlock,
                isCompact && styles.amountBlockCompact,
              ]}
            >
              <Text style={[styles.label, isLight && styles.labelLight]}>
                Amount ({currencyCode})
              </Text>
              <TextInput
                style={[styles.input, isLight && styles.inputLight]}
                placeholder="0.00"
                placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputBlock}>
              <Text style={[styles.label, isLight && styles.labelLight]}>
                Category
              </Text>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.dropdownField, isLight && styles.inputLight]}
                onPress={() => setShowCategoryMenu((value) => !value)}
              >
                <Text
                  style={[
                    styles.dropdownValue,
                    !category && styles.dropdownPlaceholder,
                    isLight && !category && styles.dropdownPlaceholderLight,
                    isLight && category && styles.dropdownValueLight,
                  ]}
                >
                  {category || "Select a category"}
                </Text>
                <Ionicons
                  name={showCategoryMenu ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={isLight ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
              {showCategoryMenu ? (
                <View
                  style={[
                    styles.dropdownMenu,
                    isLight && styles.dropdownMenuLight,
                  ]}
                >
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={styles.dropdownScroll}
                  >
                    {categoryOptions.map((option) => {
                      const selected = category === option;

                      return (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.82}
                          style={[
                            styles.dropdownOption,
                            selected && styles.dropdownOptionActive,
                          ]}
                          onPress={() => {
                            setCategory(option);
                            setShowCategoryMenu(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              isLight && styles.dropdownOptionTextLight,
                              selected && styles.dropdownOptionTextActive,
                              isLight &&
                                selected &&
                                styles.dropdownOptionTextActiveLight,
                            ]}
                          >
                            {option}
                          </Text>
                          {selected ? (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#22D3EE"
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.inputBlock}>
            <Text style={[styles.label, isLight && styles.labelLight]}>
              Notes
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                isLight && styles.inputLight,
              ]}
              placeholder="Short context, merchant, or reminder"
              placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <View
            style={[styles.receiptCard, isLight && styles.receiptCardLight]}
          >
            <View style={styles.receiptHeader}>
              <View>
                <Text
                  style={[
                    styles.receiptTitle,
                    isLight && styles.receiptTitleLight,
                  ]}
                >
                  Receipt image
                </Text>
                <Text
                  style={[
                    styles.receiptSubtitle,
                    isLight && styles.receiptSubtitleLight,
                  ]}
                >
                  Attach a receipt now or add one later while editing.
                </Text>
              </View>
            </View>

            <View style={styles.receiptActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.receiptActionButton, isLight && styles.receiptActionButtonLight]}
                onPress={handleTakePhoto}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={isLight ? "#0369A1" : "#7DD3FC"}
                />
                <Text
                  style={[
                    styles.receiptActionText,
                    isLight && styles.receiptActionTextLight,
                  ]}
                >
                  Take photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.receiptActionButton, isLight && styles.receiptActionButtonLight]}
                onPress={handlePickImage}
              >
                <Ionicons
                  name="images-outline"
                  size={16}
                  color={isLight ? "#0369A1" : "#7DD3FC"}
                />
                <Text
                  style={[
                    styles.receiptActionText,
                    isLight && styles.receiptActionTextLight,
                  ]}
                >
                  Choose image
                </Text>
              </TouchableOpacity>
            </View>

            {imageUri ? (
              <View style={styles.previewShell}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(undefined)}
                >
                  <Ionicons name="close" size={16} color="#F8FAFC" />
                </TouchableOpacity>
                <View style={styles.imageActionPill}>
                  <Ionicons name="checkmark-circle" size={14} color="#67E8F9" />
                  <Text style={styles.imageActionText}>Receipt attached</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.previewPlaceholder,
                  isLight && styles.previewPlaceholderLight,
                ]}
                onPress={handlePickImage}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={24}
                  color={isLight ? "#0284C7" : "#7DD3FC"}
                />
                <Text
                  style={[
                    styles.previewPlaceholderTitle,
                    isLight && styles.previewPlaceholderTitleLight,
                  ]}
                >
                  Add a receipt
                </Text>
                <Text
                  style={[
                    styles.previewPlaceholderText,
                    isLight && styles.previewPlaceholderTextLight,
                  ]}
                >
                  PNG or JPG images work best for quick expense proof.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.recurringToggle,
              isLight && styles.recurringToggleLight,
              isRecurringMonthly && styles.recurringToggleActive,
            ]}
            onPress={() => setIsRecurringMonthly((value) => !value)}
          >
            <View style={styles.recurringCopy}>
              <Text
                style={[
                  styles.recurringTitle,
                  isLight && styles.recurringTitleLight,
                ]}
              >
                Repeat monthly
              </Text>
              <Text
                style={[
                  styles.recurringSubtitle,
                  isLight && styles.recurringSubtitleLight,
                ]}
              >
                Save this as a recurring monthly expense plan.
              </Text>
            </View>
            <View
              style={[
                styles.recurringSwitch,
                isRecurringMonthly && styles.recurringSwitchActive,
              ]}
            >
              <View
                style={[
                  styles.recurringKnob,
                  isRecurringMonthly && styles.recurringKnobActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <LinearGradient
            colors={["#67E8F9", "#38BDF8", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitWrap}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <View style={styles.submitIconPill}>
                <Ionicons name="add" size={16} color="#082F49" />
              </View>
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Saving expense..." : "Add expense"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : (
        <BlurView
          intensity={28}
          tint={isLight ? "light" : "dark"}
          style={[styles.container, isLight && styles.containerLight]}
        >
        <View style={[styles.row, isCompact && styles.rowStack]}>
          <View style={styles.inputBlock}>
            <Text style={[styles.label, isLight && styles.labelLight]}>
              Expense name
            </Text>
            <TextInput
              style={[styles.input, isLight && styles.inputLight]}
              placeholder="Dinner with Kean"
              placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          <View
            style={[
              styles.inputBlock,
              styles.amountBlock,
              isCompact && styles.amountBlockCompact,
            ]}
          >
              <Text style={[styles.label, isLight && styles.labelLight]}>
                Amount ({currencyCode})
              </Text>
            <TextInput
              style={[styles.input, isLight && styles.inputLight]}
              placeholder="0.00"
              placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.inputBlock}>
            <Text style={[styles.label, isLight && styles.labelLight]}>
              Category
            </Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.dropdownField, isLight && styles.inputLight]}
              onPress={() => setShowCategoryMenu((value) => !value)}
            >
              <Text
                style={[
                  styles.dropdownValue,
                  !category && styles.dropdownPlaceholder,
                  isLight && !category && styles.dropdownPlaceholderLight,
                  isLight && category && styles.dropdownValueLight,
                ]}
              >
                {category || "Select a category"}
              </Text>
              <Ionicons
                name={showCategoryMenu ? "chevron-up" : "chevron-down"}
                size={18}
                color={isLight ? "#64748B" : "#94A3B8"}
              />
            </TouchableOpacity>
            {showCategoryMenu ? (
              <View
                style={[
                  styles.dropdownMenu,
                  isLight && styles.dropdownMenuLight,
                ]}
              >
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.dropdownScroll}
                >
                  {categoryOptions.map((option) => {
                    const selected = category === option;

                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.82}
                        style={[
                          styles.dropdownOption,
                          selected && styles.dropdownOptionActive,
                        ]}
                        onPress={() => {
                          setCategory(option);
                          setShowCategoryMenu(false);
                        }}
                      >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isLight && styles.dropdownOptionTextLight,
                          selected && styles.dropdownOptionTextActive,
                          isLight && selected && styles.dropdownOptionTextActiveLight,
                        ]}
                      >
                        {option}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color="#22D3EE" />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.inputBlock}>
          <Text style={[styles.label, isLight && styles.labelLight]}>
            Notes
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.notesInput,
              isLight && styles.inputLight,
            ]}
            placeholder="Short context, merchant, or reminder"
            placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

          <View style={[styles.receiptCard, isLight && styles.receiptCardLight]}>
            <View style={styles.receiptHeader}>
            <View>
              <Text
                style={[
                  styles.receiptTitle,
                  isLight && styles.receiptTitleLight,
                ]}
              >
                Receipt image
              </Text>
              <Text
                style={[
                  styles.receiptSubtitle,
                  isLight && styles.receiptSubtitleLight,
                ]}
              >
                Save a photo with this expense for future proof.
              </Text>
            </View>
            </View>

            <View style={styles.receiptActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.receiptActionButton, isLight && styles.receiptActionButtonLight]}
                onPress={handleTakePhoto}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={isLight ? "#0369A1" : "#7DD3FC"}
                />
                <Text
                  style={[
                    styles.receiptActionText,
                    isLight && styles.receiptActionTextLight,
                  ]}
                >
                  Take photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.receiptActionButton, isLight && styles.receiptActionButtonLight]}
                onPress={handlePickImage}
              >
                <Ionicons
                  name="images-outline"
                  size={16}
                  color={isLight ? "#0369A1" : "#7DD3FC"}
                />
                <Text
                  style={[
                    styles.receiptActionText,
                    isLight && styles.receiptActionTextLight,
                  ]}
                >
                  Choose image
                </Text>
              </TouchableOpacity>
            </View>

          {imageUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.previewShell}
              onPress={handlePickImage}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                contentFit="cover"
              />
              <View style={styles.imageActionPill}>
                <Ionicons name="image-outline" size={15} color="#E0F2FE" />
                <Text style={styles.imageActionText}>Tap to replace image</Text>
              </View>
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setImageUri(undefined)}
              >
                <Ionicons name="close" size={16} color="#E2E8F0" />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.previewPlaceholder,
                isLight && styles.previewPlaceholderLight,
              ]}
              onPress={handlePickImage}
            >
              <Ionicons name="scan-outline" size={22} color="#38BDF8" />
              <Text
                style={[
                  styles.previewPlaceholderTitle,
                  isLight && styles.previewPlaceholderTitleLight,
                ]}
              >
                Tap to add receipt
              </Text>
              <Text
                style={[
                  styles.previewPlaceholderText,
                  isLight && styles.previewPlaceholderTextLight,
                ]}
              >
                JPG and PNG receipts are supported
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.recurringToggle,
            isLight && styles.recurringToggleLight,
            isRecurringMonthly && styles.recurringToggleActive,
          ]}
          onPress={() => setIsRecurringMonthly((value) => !value)}
        >
          <View style={styles.recurringCopy}>
            <Text
              style={[
                styles.recurringTitle,
                isLight && styles.recurringTitleLight,
              ]}
            >
              Repeat every month
            </Text>
            <Text
              style={[
                styles.recurringSubtitle,
                isLight && styles.recurringSubtitleLight,
              ]}
            >
              Save this expense now and recreate it monthly on the same day.
            </Text>
          </View>
          <View
            style={[
              styles.recurringSwitch,
              isRecurringMonthly && styles.recurringSwitchActive,
            ]}
          >
            <View
              style={[
                styles.recurringKnob,
                isRecurringMonthly && styles.recurringKnobActive,
              ]}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.submitWrap}
        >
          <LinearGradient
            colors={["#22D3EE", "#3B82F6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButton}
          >
            <View style={styles.submitIconPill}>
              <Ionicons name="add" size={20} color="#020617" />
            </View>
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Saving..." : "Save expense"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        </BlurView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  wrapperEmbedded: {
    marginTop: 0,
  },
  container: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    backgroundColor: "rgba(8, 15, 30, 0.86)",
    gap: 12,
    overflow: "hidden",
  },
  containerEmbedded: {
    gap: 12,
  },
  containerEmbeddedLight: {
    backgroundColor: "transparent",
  },
  containerLight: {
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowStack: {
    flexDirection: "column",
  },
  inputBlock: {
    flex: 1,
  },
  amountBlock: {
    maxWidth: 130,
  },
  amountBlockCompact: {
    maxWidth: "100%",
  },
  label: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#94A3B8",
  },
  labelLight: {
    color: "#64748B",
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    color: "#F8FAFC",
    fontSize: 15,
  },
  dropdownField: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dropdownValue: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 15,
  },
  dropdownValueLight: {
    color: "#0F172A",
  },
  dropdownPlaceholder: {
    color: "#64748B",
  },
  dropdownPlaceholderLight: {
    color: "#94A3B8",
  },
  dropdownMenu: {
    marginTop: 10,
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownMenuLight: {
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(241, 245, 249, 0.98)",
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownOptionActive: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
  },
  dropdownOptionText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  dropdownOptionTextLight: {
    color: "#0F172A",
  },
  dropdownOptionTextActive: {
    color: "#67E8F9",
  },
  dropdownOptionTextActiveLight: {
    color: "#0369A1",
  },
  inputLight: {
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(241, 245, 249, 0.96)",
    color: "#0F172A",
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  receiptCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    backgroundColor: "rgba(9, 14, 25, 0.72)",
  },
  receiptCardLight: {
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(241, 245, 249, 0.92)",
  },
  receiptHeader: {
    gap: 10,
  },
  receiptActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  receiptActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  receiptActionButtonLight: {
    borderColor: "rgba(2, 132, 199, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  receiptActionText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "800",
  },
  receiptActionTextLight: {
    color: "#0F172A",
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  receiptTitleLight: {
    color: "#0F172A",
  },
  receiptSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
  },
  receiptSubtitleLight: {
    color: "#64748B",
  },
  previewShell: {
    marginTop: 14,
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
  },
  previewImage: {
    width: "100%",
    height: 176,
    borderRadius: 16,
  },
  removeImageButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageActionPill: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(2, 6, 23, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  imageActionText: {
    color: "#E0F2FE",
    fontWeight: "700",
    fontSize: 12,
  },
  previewPlaceholder: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.18)",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.56)",
    gap: 10,
  },
  previewPlaceholderLight: {
    borderColor: "rgba(148, 163, 184, 0.24)",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  previewPlaceholderTitle: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "800",
  },
  previewPlaceholderTitleLight: {
    color: "#0F172A",
  },
  previewPlaceholderText: {
    color: "#64748B",
    fontSize: 12,
  },
  previewPlaceholderTextLight: {
    color: "#64748B",
  },
  recurringToggle: {
    marginTop: 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recurringToggleLight: {
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(241, 245, 249, 0.96)",
  },
  recurringToggleActive: {
    borderColor: "rgba(34, 211, 238, 0.34)",
    backgroundColor: "rgba(14, 116, 144, 0.12)",
  },
  recurringCopy: {
    flex: 1,
  },
  recurringTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  recurringTitleLight: {
    color: "#0F172A",
  },
  recurringSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
  },
  recurringSubtitleLight: {
    color: "#64748B",
  },
  recurringSwitch: {
    width: 46,
    height: 28,
    borderRadius: 999,
    padding: 3,
    backgroundColor: "rgba(51, 65, 85, 0.92)",
    justifyContent: "center",
  },
  recurringSwitchActive: {
    backgroundColor: "#22D3EE",
  },
  recurringKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
  },
  recurringKnobActive: {
    alignSelf: "flex-end",
    backgroundColor: "#020617",
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    ...createShadow("0px 10px 18px rgba(34, 211, 238, 0.26)", {
      shadowColor: "#22D3EE",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.26,
      shadowRadius: 18,
      elevation: 7,
    }),
  },
  submitWrap: {
    borderRadius: 16,
  },
  submitIconPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  submitButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "800",
  },
});
