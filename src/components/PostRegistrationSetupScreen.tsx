import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CurrencyCode, SUPPORTED_CURRENCIES } from "@/src/services/currency";
import { User } from "@/src/types";
import {
  AppLanguage,
  SUPPORTED_APP_LANGUAGES,
  normalizeAppLanguage,
  resolveUiLanguage,
} from "@/src/i18n/appLanguage";

interface Props {
  language?: AppLanguage;
  user: User;
  initialMonthlyBudget: number;
  initialCurrency: CurrencyCode;
  initialLanguage: AppLanguage;
  isSaving?: boolean;
  onContinue: (payload: {
    username: string;
    monthlyBudget: number;
    preferredCurrency: CurrencyCode;
    preferredLanguage: AppLanguage;
  }) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
}

const LANGUAGE_OPTIONS = SUPPORTED_APP_LANGUAGES;

export default function PostRegistrationSetupScreen({
  language: _language = "English",
  user,
  initialMonthlyBudget,
  initialCurrency,
  initialLanguage,
  isSaving = false,
  onContinue,
  onSkip,
}: Props) {
  const insets = useSafeAreaInsets();
  const copyAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [username, setUsername] = useState(user.username ?? "");
  const [monthlyBudget, setMonthlyBudget] = useState(
    String(initialMonthlyBudget),
  );
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>(initialCurrency);
  const [preferredLanguage, setPreferredLanguage] =
    useState<AppLanguage>(initialLanguage);
  const [focusedField, setFocusedField] = useState<
    "username" | "budget" | null
  >(null);
  const [usernameError, setUsernameError] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const uiLanguage = resolveUiLanguage(preferredLanguage);
  const scrollInsetStyle = {
    paddingTop: Math.max(34, insets.top + 12),
    paddingBottom: 30 + (Platform.OS === "web" ? 0 : insets.bottom),
  };
  const copy =
    uiLanguage === "Filipino"
      ? {
          eyebrow: "Maligayang pagdating",
          titlePrefix: "Maligayang pagdating,",
          subtitle:
            "Handa na ang iyong expense space. Ayusin natin ang basics bago ka dumiretso sa dashboard.",
          notes: [
            "Kumpirmahin ang username na gusto mong gamitin sa pag-login.",
            "Magtakda ng monthly budget para may guide agad ang iyong dashboard.",
            "Piliin ang currency at language na gusto mo sa app.",
          ],
          cardTitle: "Unang setup",
          cardSubtitle:
            "Mai-save mo ito ngayon o i-skip muna at baguhin later sa Profile.",
          username: "Username",
          monthlyBudget: "Buwanang budget",
          preferredCurrency: "Preferred currency",
          appLanguage: "Wika ng app",
          continue: "Magpatuloy sa dashboard",
          skip: "Laktawan muna",
          errors: {
            username:
              "Gumamit ng 3-24 lowercase letters, numbers, o underscore.",
            budget: "Dapat valid na number ang buwanang budget.",
          },
        }
      : {
          eyebrow: "Welcome",
          titlePrefix: "Welcome,",
          subtitle:
            "Your expense space is ready. Let's set the basics before you head into the dashboard.",
          notes: [
            "Confirm the username you want to use for sign-in.",
            "Set a monthly budget so the dashboard has guidance right away.",
            "Choose the currency and language you want across the app.",
          ],
          cardTitle: "First-time setup",
          cardSubtitle:
            "Save these now or skip for the moment and change them later in Profile.",
          username: "Username",
          monthlyBudget: "Monthly budget",
          preferredCurrency: "Preferred currency",
          appLanguage: "App language",
          continue: "Continue to dashboard",
          skip: "Skip for now",
          errors: {
            username:
              "Use 3-24 lowercase letters, numbers, or underscores.",
            budget: "Monthly budget must be a valid number.",
          },
        };

  useEffect(() => {
    setUsername(user.username ?? "");
  }, [user.username]);

  useEffect(() => {
    setMonthlyBudget(String(initialMonthlyBudget));
  }, [initialMonthlyBudget]);

  useEffect(() => {
    setPreferredCurrency(initialCurrency);
  }, [initialCurrency]);

  useEffect(() => {
    setPreferredLanguage(normalizeAppLanguage(initialLanguage));
  }, [initialLanguage]);

  const greetingName = useMemo(
    () => user.name?.trim() || user.username || user.email,
    [user.email, user.name, user.username],
  );

  const handleContinue = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    const parsedBudget = Number(monthlyBudget.replace(/,/g, "").trim());

    let valid = true;

    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setUsernameError(copy.errors.username);
      valid = false;
    } else {
      setUsernameError("");
    }

    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setBudgetError(copy.errors.budget);
      valid = false;
    } else {
      setBudgetError("");
    }

    if (!valid) {
      return;
    }

    Animated.parallel([
      Animated.timing(copyAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(cardAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    await onContinue({
      username: normalizedUsername,
      monthlyBudget: parsedBudget,
      preferredCurrency,
      preferredLanguage,
    });
  };

  useEffect(() => {
    copyAnim.setValue(0);
    cardAnim.setValue(0);

    Animated.parallel([
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [cardAnim, copyAnim]);

  const copyAnimatedStyle = {
    opacity: copyAnim,
    transform: [
      {
        translateY: copyAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
    ],
  };

  const cardAnimatedStyle = {
    opacity: cardAnim,
    transform: [
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [34, 0],
        }),
      },
      {
        scale: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
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
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, scrollInsetStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrap}>
            <Animated.View style={[styles.copyColumn, copyAnimatedStyle]}>
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

              <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
              <Text style={styles.title}>
                {copy.titlePrefix} {greetingName}!
              </Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>

              <View style={styles.sideNotes}>
                {copy.notes.map((item) => (
                  <View key={item} style={styles.noteRow}>
                    <View style={styles.noteDot} />
                    <Text style={styles.noteText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View style={cardAnimatedStyle}>
            <BlurView intensity={30} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>{copy.cardTitle}</Text>
              <Text style={styles.cardSubtitle}>{copy.cardSubtitle}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.username}</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === "username" && styles.inputFocused,
                  ]}
                  placeholder="your_username"
                  placeholderTextColor="#6B7A90"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={(value) => setUsername(value.toLowerCase())}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() =>
                    setFocusedField((value) => (value === "username" ? null : value))
                  }
                />
                {usernameError ? (
                  <Text style={styles.error}>{usernameError}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.monthlyBudget}</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === "budget" && styles.inputFocused,
                  ]}
                  placeholder="10000"
                  placeholderTextColor="#6B7A90"
                  keyboardType="numeric"
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  onFocus={() => setFocusedField("budget")}
                  onBlur={() =>
                    setFocusedField((value) => (value === "budget" ? null : value))
                  }
                />
                {budgetError ? <Text style={styles.error}>{budgetError}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.preferredCurrency}</Text>
                <View style={styles.chipWrap}>
                  {SUPPORTED_CURRENCIES.map((item) => {
                    const active = preferredCurrency === item.code;
                    return (
                      <TouchableOpacity
                        key={item.code}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPreferredCurrency(item.code)}
                        activeOpacity={0.86}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {item.code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.appLanguage}</Text>
                <View style={styles.chipWrap}>
                  {LANGUAGE_OPTIONS.map((item) => {
                    const active = preferredLanguage === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPreferredLanguage(item.key)}
                        activeOpacity={0.86}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                  onPress={handleContinue}
                  activeOpacity={0.88}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#082F49" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {copy.continue}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, isSaving && styles.buttonDisabled]}
                  onPress={onSkip}
                  activeOpacity={0.82}
                  disabled={isSaving}
                >
                  <Text style={styles.secondaryButtonText}>{copy.skip}</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  keyboardShell: { flex: 1 },
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
  contentWrap: {
    gap: 24,
  },
  copyColumn: {
    gap: 14,
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
    backgroundColor: "transparent",
  },
  brandBadgeFill: {
    flex: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogo: { width: 50, height: 50 },
  brandCopy: { justifyContent: "center" },
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
    lineHeight: 40,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "#B6C2D3",
  },
  sideNotes: {
    marginTop: 10,
    gap: 12,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  noteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: "#67E8F9",
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#CBD5E1",
  },
  card: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.74)",
    padding: 22,
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
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
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#F8FAFC",
    fontSize: 15,
  },
  inputFocused: {
    borderColor: "rgba(103, 232, 249, 0.58)",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
  },
  chipActive: {
    borderColor: "rgba(103, 232, 249, 0.42)",
    backgroundColor: "rgba(34, 211, 238, 0.14)",
  },
  chipText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#E0F2FE",
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: "#FCA5A5",
  },
  actionColumn: {
    marginTop: 22,
    gap: 12,
  },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#7DD3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#020617",
  },
  secondaryButton: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.26)",
    backgroundColor: "rgba(15, 23, 42, 0.66)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E2E8F0",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
