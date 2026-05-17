import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

interface Props {
  language?: AppLanguage;
  onLogin: (loginIdentifier: string, password: string) => void;
  onBackPress: () => void;
  onRegisterPress: () => void;
  onForgotPassword: (loginIdentifier: string) => Promise<void>;
  onNotify?: (message: string, type?: "error" | "warning" | "success") => void;
}

export default function LoginScreen({
  language = "English",
  onLogin,
  onBackPress,
  onRegisterPress,
  onForgotPassword,
  onNotify,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;
  const authContentInsetStyle = {
    paddingTop: Math.max(isWebWide ? 42 : 26, insets.top + 12),
    paddingBottom: isWebWide ? 42 : 180 + bottomInset,
  };
  const KeyboardShell = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const AuthCard = Platform.OS === "android" ? View : BlurView;
  const authCardProps =
    Platform.OS === "android"
      ? {}
      : { intensity: 30, tint: "dark" as const };
  const shouldTrackFocusState = Platform.OS !== "android";
  const uiLanguage = resolveUiLanguage(language);
  const copy =
    uiLanguage === "Filipino"
      ? {
          warning: "Pakilagay ang iyong email o username at password.",
          forgotWarning:
            "I-type muna ang iyong email o username para ma-reset ang password mo.",
          forgotFailed: "Hindi maipadala ang reset code.",
          back: "Back",
          eyebrow: "Welcome back",
          title: "Handa ka nang bumalik?",
          subtitle:
            "Mag-log in para makita ang pinakabagong gastos, saved receipts, at synced data.",
          sideNotes: [
            "Tingnan agad ang receipts at dashboard mo",
            "Naka-sync ang lahat sa cloud profile mo",
            "Handa na ulit ang monthly plans mo",
          ],
          cardTitle: "Log in",
          cardSubtitle:
            "Gamitin ang account email o username at password mo para magpatuloy.",
          loginIdentifier: "Email o username",
          loginPlaceholder: "you@gmail.com o username",
          password: "Password",
          passwordPlaceholder: "Ilagay ang password mo",
          forgot: "Nakalimutan ang password?",
          login: "Log In",
          switchText: "Wala ka pang account? Gumawa ng bago",
        }
      : {
          warning: "Please enter your email or username and password.",
          forgotWarning:
            "Type your email or username first to reset your password.",
          forgotFailed: "Failed to send reset code.",
          back: "Back",
          eyebrow: "Welcome back",
          title: "Ready to jump back in?",
          subtitle:
            "Log in to see your latest spending, saved receipts, and synced data.",
          sideNotes: [
            "View your receipts and dashboard at a glance",
            "Everything stays synced to your cloud profile",
            "Your monthly plans are ready to go",
          ],
          cardTitle: "Log in",
          cardSubtitle:
            "Use your account email or username and password to continue.",
          loginIdentifier: "Email or username",
          loginPlaceholder: "you@gmail.com or username",
          password: "Password",
          passwordPlaceholder: "Enter your password",
          forgot: "Forgot password?",
          login: "Log In",
          switchText: "Don't have an account? Create one",
        };
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"login" | "password" | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const pendingScrollTargetRef = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const shouldAutoScrollFocusedField = Platform.OS === "ios" && !isWebWide;

  const scrollToField = (y: number) => {
    if (!shouldAutoScrollFocusedField) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  };

  const ensureFieldVisible = (y: number) => {
    if (Platform.OS === "web" || isWebWide) {
      return;
    }

    const nextY = Math.max(0, y - 36);
    pendingScrollTargetRef.current = nextY;

    if (keyboardInset > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: nextY, animated: true });
      });
    }
  };

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (event: any) => {
      const nextInset = Math.max(0, event?.endCoordinates?.height ?? 0);
      setKeyboardInset(nextInset);

      if (pendingScrollTargetRef.current != null) {
        const targetY = pendingScrollTargetRef.current;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        });
      }
    };

    const handleHide = () => {
      setKeyboardInset(0);
      pendingScrollTargetRef.current = null;
    };

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = () => {
    if (loginIdentifier.trim() && password.trim()) {
      onLogin(loginIdentifier, password);
      return;
    }

    onNotify?.(copy.warning, "warning");
  };

  const handleForgotPassword = async () => {
    if (!loginIdentifier.trim()) {
      onNotify?.(copy.forgotWarning, "warning");
      return;
    }

    try {
      await onForgotPassword(loginIdentifier.trim());
    } catch (error: any) {
      onNotify?.(error.message || copy.forgotFailed, "error");
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

      <KeyboardShell
        style={styles.keyboardShell}
        {...(Platform.OS === "ios"
          ? {
              behavior: "padding" as const,
              keyboardVerticalOffset: 24,
            }
          : {})}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            !isWebWide && styles.scrollContentMobile,
            isWebWide && styles.scrollContentWide,
            authContentInsetStyle,
            !isWebWide && keyboardInset > 0
              ? { paddingBottom: keyboardInset + bottomInset + 36 }
              : null,
          ]}
          keyboardShouldPersistTaps="always"
          {...(Platform.OS === "ios"
            ? { keyboardDismissMode: "on-drag" as const }
            : {})}
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
                <Text style={styles.backText}>{copy.back}</Text>
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

              <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
              <Text style={[styles.title, isWebWide && styles.titleWide]}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>

              {isWebWide ? (
                <View style={styles.sideNotes}>
                  {copy.sideNotes.map((item) => (
                    <View key={item} style={styles.noteRow}>
                      <View style={styles.noteDot} />
                      <Text style={styles.noteText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <AuthCard {...authCardProps} style={styles.card}>
              <Text style={styles.cardTitle}>{copy.cardTitle}</Text>
              <Text style={styles.cardSubtitle}>{copy.cardSubtitle}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.loginIdentifier}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === "login" && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={copy.loginPlaceholder}
                    value={loginIdentifier}
                    onChangeText={setLoginIdentifier}
                    onFocus={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField("login");
                        scrollToField(250);
                      }
                      ensureFieldVisible(250);
                    }}
                    onBlur={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField((value) =>
                          value === "login" ? null : value,
                        );
                      }
                    }}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.password}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === "password" && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder={copy.passwordPlaceholder}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField("password");
                        scrollToField(360);
                      }
                      ensureFieldVisible(360);
                    }}
                    onBlur={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField((value) =>
                          value === "password" ? null : value,
                        );
                      }
                    }}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
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

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.forgotText}>{copy.forgot}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleLogin}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>{copy.login}</Text>
                <Ionicons name="arrow-forward" size={16} color="#020617" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchLink}
                onPress={onRegisterPress}
                activeOpacity={0.8}
              >
                <Text style={styles.switchText}>{copy.switchText}</Text>
              </TouchableOpacity>
            </AuthCard>
          </Animated.View>
        </ScrollView>
      </KeyboardShell>
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
    paddingRight: 4,
  },
  backText: {
    color: "#E0F2FE",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 0,
    paddingRight: 2,
    includeFontPadding: false,
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
  inputWrapperFocused: {
    borderColor: "rgba(103, 232, 249, 0.58)",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
  forgotPassword: {
    alignSelf: "stretch",
    marginTop: 12,
    paddingRight: 6,
  },
  forgotText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 0,
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
