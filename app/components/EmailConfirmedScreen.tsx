import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onLoginPress: () => void;
  onBackPress: () => void;
}

export default function EmailConfirmedScreen({
  onLoginPress,
  onBackPress,
}: Props) {
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entranceAnim]);

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

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isWebWide && styles.scrollContentMobile,
          isWebWide && styles.scrollContentWide,
        ]}
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
          <View style={[styles.copyColumn, isWebWide && styles.copyColumnWide]}>
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

            <Text style={styles.eyebrow}>Account ready</Text>
            <Text style={[styles.title, isWebWide && styles.titleWide]}>
              Email confirmed successfully.
            </Text>
            <Text style={styles.subtitle}>
              Your account is now verified. Continue to the login screen and
              sign in to open your dashboard.
            </Text>
          </View>

          <BlurView intensity={30} tint="dark" style={styles.card}>
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={["#A7F3D0", "#67E8F9", "#38BDF8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconFill}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={36}
                  color="#082F49"
                />
              </LinearGradient>
            </View>

            <Text style={styles.cardTitle}>You&apos;re all set</Text>
            <Text style={styles.cardSubtitle}>
              Verification is complete. Use your email and password to log in.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onLoginPress}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>Go to login</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
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
  card: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.74)",
    padding: 22,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
  },
  iconWrap: {
    marginTop: 6,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#67E8F9",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  iconFill: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    marginTop: 22,
    fontSize: 26,
    fontWeight: "900",
    color: "#F8FAFC",
    textAlign: "center",
  },
  cardSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "#94A3B8",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 24,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#7DD3FC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#020617",
  },
});
