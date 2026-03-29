import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";

interface Props {
  onLogin: (email: string, password: string) => void;
  onBackPress: () => void;
  onRegisterPress: () => void;
}

export default function LoginScreen({
  onLogin,
  onBackPress,
  onRegisterPress,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleLogin = () => {
    if (email.trim() && password.trim()) {
      onLogin(email, password);
    } else {
      alert("Please enter both email and password.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    alert(error ? error.message : "Password reset email sent!");
  };

  return (
    <LinearGradient
      colors={["#020617", "#0F172A", "#1E293B"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
            <BlurView intensity={40} tint="dark" style={styles.card}>
              <Text style={styles.title}>Login</Text>
              <Text style={styles.subtitle}>
                Sign in to continue tracking your expenses.
              </Text>

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
                    style={styles.input}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    autoCapitalize="none"
                  />
                </View>
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
                    placeholder="********"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeButton}
                    activeOpacity={0.8}
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
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.loginButtonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerLink}
                onPress={onRegisterPress}
              >
                <Text style={styles.registerText}>
                  Don&apos;t have an account? Register
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  forgotText: {
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: "500",
  },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    justifyContent: "center",
  },
  backButton: { marginBottom: 20 },
  backText: { color: "#A5B4FC", fontWeight: "600" },
  card: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#E5E7EB" },
  subtitle: { fontSize: 14, color: "#CBD5F5", marginBottom: 24 },
  inputGroup: { marginBottom: 18 },
  label: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, color: "#E5E7EB" },
  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  loginButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 16,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  registerLink: {
    alignItems: "center",
    marginTop: 18,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  registerText: { color: "#A5B4FC", fontSize: 14 },
});
