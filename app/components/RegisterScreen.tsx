import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
  onRegister: (email: string, password: string, name: string) => void;
  onBackPress: () => void;
  onLoginPress: () => void;
}

export default function RegisterScreen({
  onRegister,
  onBackPress,
  onLoginPress,
}: Props) {
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    terms: "",
  });

  const scrollRef = useRef<ScrollView>(null);
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const scrollToField = (y: number) => {
    if (Platform.OS === "web" || isWebWide) {
      return;
    }

    scrollRef.current?.scrollTo({ y, animated: true });
  };

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entranceAnim]);

  const handleRegister = () => {
    let valid = true;
    const nextErrors = { name: "", email: "", password: "", terms: "" };

    if (!name.trim()) {
      nextErrors.name = "Full name is required";
      valid = false;
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required";
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = "Invalid email address";
      valid = false;
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required";
      valid = false;
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
      valid = false;
    }

    if (!agreeToTerms) {
      nextErrors.terms = "Please agree to the terms to continue";
      valid = false;
    }

    setErrors(nextErrors);

    if (valid) {
      onRegister(email, password, name);
    }
  };

  const showTerms = () => {
    const message =
      "By creating an account, you agree to:\n\n" +
      "1. Use EyeGasto for personal expense tracking.\n" +
      "2. Keep your account credentials secure.\n" +
      "3. Upload only lawful and relevant receipt images.\n" +
      "4. Manage your own exported and shared financial information carefully.";

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
      return;
    }

    Alert.alert("Terms and Conditions", message);
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
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            !isWebWide && styles.scrollContentMobile,
            isWebWide && styles.scrollContentWide,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                  <LinearGradient
                    colors={["#67E8F9", "#38BDF8", "#2563EB"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.brandBadgeFill}
                  >
                    <Ionicons name="eye-outline" size={20} color="#082F49" />
                  </LinearGradient>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandText}>EyeGasto</Text>
                </View>
              </View>

              <Text style={styles.eyebrow}>Get started!</Text>
              <Text style={[styles.title, isWebWide && styles.titleWide]}>
                Tracking made simple.
              </Text>
              <Text style={styles.subtitle}>
                Create an account to save receipts, see your spending charts,
                and track your budget and expenses.
              </Text>

              {isWebWide ? (
                <View style={styles.sideNotes}>
                  {[
                    "Log on your phone, review on your computer",
                    "Your receipts and settings in one place",
                    "A calm dashboard for your daily budget",
                  ].map((item) => (
                    <View key={item} style={styles.noteRow}>
                      <View style={styles.noteDot} />
                      <Text style={styles.noteText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <BlurView intensity={30} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>Create account</Text>
              <Text style={styles.cardSubtitle}>
                Just a few details to get your smart budget started.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="John Kyle Perez"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => scrollToField(220)}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    autoCapitalize="words"
                  />
                </View>
                {errors.name ? (
                  <Text style={styles.error}>{errors.name}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="you@gmail.com"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => scrollToField(320)}
                    keyboardType="email-address"
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    autoCapitalize="none"
                  />
                </View>
                {errors.email ? (
                  <Text style={styles.error}>{errors.email}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Create a password"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => scrollToField(430)}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
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
                {errors.password ? (
                  <Text style={styles.error}>{errors.password}</Text>
                ) : null}
              </View>

              <View style={styles.termsRow}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    agreeToTerms && styles.checkboxChecked,
                  ]}
                  onPress={() => setAgreeToTerms((value) => !value)}
                  activeOpacity={0.84}
                >
                  {agreeToTerms ? (
                    <Ionicons name="checkmark" size={14} color="#020617" />
                  ) : null}
                </TouchableOpacity>

                <View style={styles.termsCopy}>
                  <Text style={styles.termsText}>I agree to the</Text>
                  <TouchableOpacity onPress={showTerms} activeOpacity={0.8}>
                    <Text style={styles.termsLink}>Terms and Conditions</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {errors.terms ? (
                <Text style={styles.error}>{errors.terms}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRegister}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Create Account</Text>
                <Ionicons name="arrow-forward" size={16} color="#020617" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchLink}
                onPress={onLoginPress}
                activeOpacity={0.8}
              >
                <Text style={styles.switchText}>
                  Already have an account? Log in
                </Text>
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
    paddingBottom: 220,
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
    padding: 2,
    backgroundColor: "rgba(103, 232, 249, 0.16)",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  brandBadgeFill: {
    flex: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
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
    maxWidth: 500,
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
  termsRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.44)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#7DD3FC",
    borderColor: "#7DD3FC",
  },
  termsCopy: {
    flex: 1,
    gap: 3,
  },
  termsText: {
    color: "#B6C2D3",
    fontSize: 13,
    lineHeight: 18,
  },
  termsLink: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  error: {
    marginTop: 6,
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 18,
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
  switchLink: {
    marginTop: 18,
    alignItems: "center",
  },
  switchText: {
    color: "#B6C2D3",
    fontSize: 14,
  },
});
