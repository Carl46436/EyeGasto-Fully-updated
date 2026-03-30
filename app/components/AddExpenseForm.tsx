import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
}

export default function AddExpenseForm({ onAdd, mode = "dark" }: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const isLight = mode === "light";
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [isRecurringMonthly, setIsRecurringMonthly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Photo access is required so receipts can be attached to expenses.",
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
      Alert.alert("Upload failed", "We could not select that image.");
    }
  };

  const handleSubmit = async () => {
    const numericAmount = Number.parseFloat(amount);
    if (!description.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Missing details", "Please enter a valid expense name and amount.");
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BlurView
        intensity={28}
        tint={isLight ? "light" : "dark"}
        style={[styles.container, isLight && styles.containerLight]}
      >
        <View style={[styles.row, isCompact && styles.rowStack]}>
          <View style={styles.inputBlock}>
            <Text style={[styles.label, isLight && styles.labelLight]}>Expense name</Text>
            <TextInput
              style={[styles.input, isLight && styles.inputLight]}
              placeholder="Dinner with client"
              placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          <View style={[styles.inputBlock, styles.amountBlock, isCompact && styles.amountBlockCompact]}>
            <Text style={[styles.label, isLight && styles.labelLight]}>Amount</Text>
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
            <Text style={[styles.label, isLight && styles.labelLight]}>Category</Text>
            <TextInput
              style={[styles.input, isLight && styles.inputLight]}
              placeholder="Food, Bills, Transport"
              placeholderTextColor={isLight ? "#94A3B8" : "#64748B"}
              value={category}
              onChangeText={setCategory}
            />
          </View>
        </View>

        <View style={styles.inputBlock}>
          <Text style={[styles.label, isLight && styles.labelLight]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput, isLight && styles.inputLight]}
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
              <Text style={[styles.receiptTitle, isLight && styles.receiptTitleLight]}>
                Receipt image
              </Text>
              <Text style={[styles.receiptSubtitle, isLight && styles.receiptSubtitleLight]}>
                Save a photo with this expense for future proof.
              </Text>
            </View>
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
              style={[styles.previewPlaceholder, isLight && styles.previewPlaceholderLight]}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
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
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 7,
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
