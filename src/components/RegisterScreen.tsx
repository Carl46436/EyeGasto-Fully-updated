import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
  onRegister: (
    email: string,
    password: string,
    name: string,
    username: string,
  ) => void;
  onBackPress: () => void;
  onLoginPress: () => void;
}

const TERMS_MESSAGE =
  "By creating an account, you agree to:\n\n" +
  "1. Use EyeGasto for lawful personal or business expense tracking only.\n" +
  "2. Provide accurate account details and keep your password secure.\n" +
  "3. You are responsible for all activity that happens under your account.\n" +
  "4. Upload only lawful, relevant, and non-harmful receipt images/content.\n" +
  "5. Do not upload other people's sensitive data without permission.\n" +
  "6. Keep your own backup of critical records and exported reports.\n" +
  "7. Review exported/shared financial files carefully before sending.\n" +
  "8. EyeGasto may update features and terms as the app improves.\n" +
  "9. Continued use after updates means you accept the revised terms.\n" +
  "10. If you disagree with these terms, do not create or use an account.\n\n" +
  "Privacy note: Your account profile, expenses, and receipt files are processed to provide dashboard, sync, and reporting features.";

export default function RegisterScreen({
  language = "English",
  onRegister,
  onBackPress,
  onLoginPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;
  const authContentInsetStyle = {
    paddingTop: Math.max(isWebWide ? 42 : 26, insets.top + 12),
    paddingBottom: isWebWide ? 42 : 220 + bottomInset,
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
          back: "Back",
          eyebrow: "Simulan na",
          title: "Mas simple ang pag-track.",
          subtitle:
            "Gumawa ng account para mag-save ng receipts, makita ang spending charts, at masubaybayan ang budget at gastos mo.",
          sideNotes: [
            "Mag-log sa phone, mag-review sa computer",
            "Nasa iisang lugar ang receipts at settings mo",
            "Kalma at malinaw na dashboard para sa araw-araw mong budget",
          ],
          cardTitle: "Gumawa ng account",
          cardSubtitle:
            "Ilang detalye lang para masimulan ang smart budget mo.",
          fullName: "Buong pangalan",
          fullNamePlaceholder: "Juan Dela Cruz",
          username: "Username",
          usernamePlaceholder: "iyong_username",
          email: "Email",
          password: "Password",
          passwordPlaceholder: "Gumawa ng password",
          termsLead: "Sumasang-ayon ako sa",
          termsLink: "Terms and Conditions",
          submit: "Gumawa ng account",
          switchText: "May account ka na? Mag-log in",
          termsTitle: "Terms and Conditions",
          termsButton: "Naiintindihan ko",
          errors: {
            name: "Kailangan ang buong pangalan",
            usernameRequired: "Kailangan ang username",
            usernameFormat:
              "Gumamit ng 3-24 lowercase letters, numbers, o underscore",
            emailRequired: "Kailangan ang email",
            emailInvalid: "Hindi valid ang email address",
            passwordRequired: "Kailangan ang password",
            passwordLength: "Dapat hindi bababa sa 6 characters ang password",
            terms: "Mangyaring sumang-ayon sa terms para magpatuloy",
          },
        }
      : {
          back: "Back",
          eyebrow: "Get started!",
          title: "Tracking made simple.",
          subtitle:
            "Create an account to save receipts, see your spending charts, and track your budget and expenses.",
          sideNotes: [
            "Log on your phone, review on your computer",
            "Your receipts and settings in one place",
            "A calm dashboard for your daily budget",
          ],
          cardTitle: "Create account",
          cardSubtitle:
            "Just a few details to get your smart budget started.",
          fullName: "Full name",
          fullNamePlaceholder: "John Kyle Perez",
          username: "Username",
          usernamePlaceholder: "your_username",
          email: "Email",
          password: "Password",
          passwordPlaceholder: "Create a password",
          termsLead: "I agree to the",
          termsLink: "Terms and Conditions",
          submit: "Create Account",
          switchText: "Already have an account? Log in",
          termsTitle: "Terms and Conditions",
          termsButton: "I Understand",
          errors: {
            name: "Full name is required",
            usernameRequired: "Username is required",
            usernameFormat:
              "Use 3-24 lowercase letters, numbers, or underscores",
            emailRequired: "Email is required",
            emailInvalid: "Invalid email address",
            passwordRequired: "Password is required",
            passwordLength: "Password must be at least 6 characters",
            terms: "Please agree to the terms to continue",
          },
        };
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [focusedField, setFocusedField] = useState<
    "name" | "username" | "email" | "password" | null
  >(null);
  const [errors, setErrors] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    terms: "",
  });

  const scrollRef = useRef<ScrollView>(null);
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
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

  const handleRegister = () => {
    let valid = true;
    const nextErrors = {
      name: "",
      username: "",
      email: "",
      password: "",
      terms: "",
    };

    if (!name.trim()) {
      nextErrors.name = copy.errors.name;
      valid = false;
    }

    if (!username.trim()) {
      nextErrors.username = copy.errors.usernameRequired;
      valid = false;
    } else if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      nextErrors.username = copy.errors.usernameFormat;
      valid = false;
    }

    if (!email.trim()) {
      nextErrors.email = copy.errors.emailRequired;
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = copy.errors.emailInvalid;
      valid = false;
    }

    if (!password.trim()) {
      nextErrors.password = copy.errors.passwordRequired;
      valid = false;
    } else if (password.length < 6) {
      nextErrors.password = copy.errors.passwordLength;
      valid = false;
    }

    if (!agreeToTerms) {
      nextErrors.terms = copy.errors.terms;
      valid = false;
    }

    setErrors(nextErrors);

    if (valid) {
      onRegister(email, password, name, username.trim().toLowerCase());
    }
  };

  const showTerms = () => {
    setShowTermsModal(true);
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
              <Text style={[styles.title, isWebWide && styles.titleWide]}>
                {copy.title}
              </Text>
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
                <Text style={styles.label}>{copy.fullName}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === "name" && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={copy.fullNamePlaceholder}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField("name");
                        scrollToField(220);
                      }
                      ensureFieldVisible(220);
                    }}
                    onBlur={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField((value) =>
                          value === "name" ? null : value,
                        );
                      }
                    }}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    autoCapitalize="words"
                  />
                </View>
                {errors.name ? (
                  <Text style={styles.error}>{errors.name}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.username}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === "username" && styles.inputWrapperFocused,
                  ]}
                >
                  <Ionicons
                    name="at-outline"
                    size={18}
                    color="#94A3B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={usernameRef}
                    style={styles.input}
                    placeholder={copy.usernamePlaceholder}
                    value={username}
                    onChangeText={(value) => setUsername(value.toLowerCase())}
                    onFocus={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField("username");
                        scrollToField(290);
                      }
                      ensureFieldVisible(290);
                    }}
                    onBlur={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField((value) =>
                          value === "username" ? null : value,
                        );
                      }
                    }}
                    placeholderTextColor="#6B7A90"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    autoCapitalize="none"
                  />
                </View>
                {errors.username ? (
                  <Text style={styles.error}>{errors.username}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{copy.email}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === "email" && styles.inputWrapperFocused,
                  ]}
                >
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
                    onFocus={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField("email");
                        scrollToField(370);
                      }
                      ensureFieldVisible(370);
                    }}
                    onBlur={() => {
                      if (shouldTrackFocusState) {
                        setFocusedField((value) =>
                          value === "email" ? null : value,
                        );
                      }
                    }}
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
                        scrollToField(480);
                      }
                      ensureFieldVisible(480);
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
                  <Text style={styles.termsText}>{copy.termsLead}</Text>
                  <TouchableOpacity onPress={showTerms} activeOpacity={0.8}>
                    <Text style={styles.termsLink}>{copy.termsLink}</Text>
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
                <Text style={styles.primaryButtonText}>{copy.submit}</Text>
                <Ionicons name="arrow-forward" size={16} color="#020617" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchLink}
                onPress={onLoginPress}
                activeOpacity={0.8}
              >
                <Text style={styles.switchText}>{copy.switchText}</Text>
              </TouchableOpacity>
            </AuthCard>
          </Animated.View>
        </ScrollView>
      </KeyboardShell>

      <Modal
        visible={showTermsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View
          style={[
            styles.termsModalBackdrop,
            {
              paddingTop: Math.max(18, insets.top + 10),
              paddingBottom: Math.max(18, insets.bottom + 10),
            },
          ]}
        >
          <BlurView intensity={30} tint="dark" style={styles.termsModalCard}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>{copy.termsTitle}</Text>
              <TouchableOpacity
                onPress={() => setShowTermsModal(false)}
                style={styles.termsModalClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.termsModalScroll}
              contentContainerStyle={styles.termsModalScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.termsModalBody}>{TERMS_MESSAGE}</Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.termsModalButton}
              onPress={() => setShowTermsModal(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.termsModalButtonText}>{copy.termsButton}</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
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
  termsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  termsModalCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "86%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    backgroundColor: "rgba(8, 15, 30, 0.94)",
    padding: 16,
  },
  termsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  termsModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  termsModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  termsModalScroll: {
    marginTop: 14,
    maxHeight: 380,
  },
  termsModalScrollContent: {
    paddingBottom: 8,
  },
  termsModalBody: {
    fontSize: 14,
    lineHeight: 23,
    color: "#CBD5E1",
  },
  termsModalButton: {
    marginTop: 14,
    borderRadius: 999,
    minHeight: 46,
    backgroundColor: "#7DD3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  termsModalButtonText: {
    color: "#082F49",
    fontSize: 14,
    fontWeight: "900",
  },
});
