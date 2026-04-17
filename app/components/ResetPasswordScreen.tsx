import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onBackPress: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export default function ResetPasswordScreen({
  onBackPress,
  onSubmit,
}: Props) {
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entranceAnim]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      Alert.alert("Missing password", "Enter a new password to continue.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Password too short",
        "Your new password must be at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please re-enter both fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={["#020617", "#081225", "#10213F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />
      <View style={styles.backgroundMesh} />

      <KeyboardAvoidingView
        style={styles.keyboardShell}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            !isWebWide && styles.scrollContentMobile,
            isWebWide && styles.scrollContentWide,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.contentWrap,
              isWebWide && styles.contentWrapWide,
              {
                opacity: entranceAnim,
                transform: [
                  {
                    translateY: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[styles.copyColumn, isWebWide && styles.copyColumnWide]}
            >
              <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                <Ionicons name="arrow-back" size={16} color="#E0F2FE" />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <View style={styles.brandBadgeFill}>
                    <Image
                      source={require("../../assets/images/app2.png")}
                      style={styles.brandLogo}
                      resizeMode="contain"
                    />
                  </View>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandText}>EyeGasto</Text>
                </View>
              </View>

              <Text style={styles.eyebrow}>Password recovery</Text>
              <Text style={[styles.title, isWebWide && styles.titleWide]}>
                Choose a new password.
              </Text>
              <Text style={styles.subtitle}>
                Your recovery link is valid. Set a new password below, then log
                back in with your updated credentials.
              </Text>
            </View>

            <BlurView intensity={30} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>Reset password</Text>
              <Text style={styles.cardSubtitle}>
                Use at least 6 characters for your new password.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter a new password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeButton}
                    activeOpacity={0.86}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#E2E8F0"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((value) => !value)}
                    style={styles.eyeButton}
                    activeOpacity={0.86}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={18}
                      color="#E2E8F0"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSubmit}
                activeOpacity={0.88}
                disabled={isSubmitting}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? "Updating..." : "Update password"}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#020617" />
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  keyboardShell: {
    flex: 1,
  },
  backgroundOrbOne: {
    position: "absolute",
    top: -120,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(34, 211, 238, 0.16)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    bottom: -90,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(59, 130, 246, 0.14)",
  },
  backgroundMesh: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(2, 6, 23, 0.18)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 30,
    justifyContent: "center",
  },
  scrollContentMobile: {
    justifyContent: "flex-start",
    paddingTop: 26,
    paddingBottom: 180,
  },
  scrollContentWide: {
    paddingHorizontal: 48,
    paddingTop: 42,
    paddingBottom: 42,
  },
  contentWrap: {
    gap: 20,
  },
  contentWrapWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 30,
  },
  copyColumn: {
    gap: 14,
  },
  copyColumnWide: {
    flex: 1,
    maxWidth: 520,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  backText: {
    color: "#E0F2FE",
    fontSize: 14,
    fontWeight: "700",
  },
  brandRow: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.16)",
    backgroundColor: "rgba(8, 15, 30, 0.62)",
  },
  brandBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    padding: 0,
    backgroundColor: "transparent",
  },
  brandBadgeFill: {
    flex: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogo: {
    width: 50,
    height: 50,
  },
  brandCopy: {
    justifyContent: "center",
  },
  brandText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 0.6,
  },
  eyebrow: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  titleWide: {
    fontSize: 52,
    lineHeight: 58,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "#B6C2D3",
  },
  card: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.74)",
    padding: 22,
    width: "100%",
    maxWidth: 480,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "#94A3B8",
  },
  inputGroup: {
    marginTop: 18,
  },
  label: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#94A3B8",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: "#F8FAFC",
    fontSize: 15,
  },
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    ...Platform.select({
      web: { cursor: "pointer" } as object,
    }),
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 22,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#7DD3FC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#020617",
  },
});
