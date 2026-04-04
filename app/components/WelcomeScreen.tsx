import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

const featureList = [
  "Track daily spending with receipts and clean categories",
  "Review monthly movement with charts, export tools, and gallery views",
  "One account. Total sync. Access your data on your phone or the web.",
];

const insightRows = [
  { label: "Receipt-backed entries", value: "Visual proof" },
  { label: "Recurring planning", value: "Monthly flow" },
  { label: "Smart exports", value: "CSV, JSON, Summary Reports" },
];

export default function WelcomeScreen({
  onLoginPress,
  onRegisterPress,
}: Props) {
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;

  if (!isWebWide) {
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
          contentContainerStyle={styles.mobileScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mobileHero}>
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

            <Text style={styles.mobileEyebrow}>Your Budget buddy </Text>
            <Text style={styles.mobileHeadline}>
              Track every Peso, effortlessly.
            </Text>
            <Text style={styles.mobileSubtitle}>
              Track purchases, save receipts, and review the month from one tap
            </Text>
          </View>

          <BlurView intensity={28} tint="dark" style={styles.mobilePreview}>
            <View style={styles.mobilePreviewHeader}>
              <Text style={styles.visualEyebrow}>Quick Look</Text>
              <Text style={styles.mobilePreviewTitle}>
                See where your money goes.
              </Text>
            </View>

            <View style={styles.mobileBalanceCard}>
              <Text style={styles.mockLabel}>This month</Text>
              <Text style={styles.mobileBalanceValue}>PHP 18,420</Text>
              <Text style={styles.mockMeta}>Budget usage 73%</Text>
            </View>

            <View style={styles.mobileChart}>
              {[52, 88, 70, 116].map((height, index) => (
                <View key={`mobile-bar-${index}`} style={styles.mobileChartCol}>
                  <View style={[styles.mobileChartBar, { height }]} />
                  <Text style={styles.mockBarLabel}>W{index + 1}</Text>
                </View>
              ))}
            </View>
          </BlurView>

          <BlurView
            intensity={22}
            tint="dark"
            style={styles.mobileFeaturePanel}
          >
            {featureList.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </BlurView>

          <View style={styles.mobileActionStack}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onLoginPress}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>Log In</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRegisterPress}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

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

      <View style={[styles.shell, isWebWide && styles.shellWide]}>
        <View style={[styles.heroColumn, isWebWide && styles.heroColumnWide]}>
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

          <Text style={[styles.headline, isWebWide && styles.headlineWide]}>
            See where your money goes. All in one place, with zero hassle.
          </Text>

          <Text style={[styles.subtitle, isWebWide && styles.subtitleWide]}>
            The easy way to track your spending, see your habits, and keep all
            your receipts in one safe place.
          </Text>

          <View style={[styles.actionRow, !isWebWide && styles.actionRowStack]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onLoginPress}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>Log In</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRegisterPress}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.featureStack}>
            {featureList.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <BlurView
          intensity={30}
          tint="dark"
          style={[styles.visualPanel, isWebWide && styles.visualPanelWide]}
        >
          <LinearGradient
            colors={["rgba(34,211,238,0.2)", "rgba(59,130,246,0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.visualGlow}
          />

          <View style={styles.visualHeader}>
            <Text style={styles.visualEyebrow}>Quick Look</Text>
            <Text style={styles.visualTitle}>
              Built for optimized oversight
            </Text>
          </View>

          <View style={styles.mockFrame}>
            <View style={styles.mockTopBar}>
              <View style={styles.mockDots}>
                <View
                  style={[styles.mockDot, { backgroundColor: "#F97316" }]}
                />
                <View
                  style={[styles.mockDot, { backgroundColor: "#22C55E" }]}
                />
                <View
                  style={[styles.mockDot, { backgroundColor: "#38BDF8" }]}
                />
              </View>
            </View>

            <View style={styles.mockBody}>
              <View style={styles.mockBalanceCard}>
                <Text style={styles.mockLabel}>This month</Text>
                <Text style={styles.mockValue}>PHP 18,420</Text>
                <Text style={styles.mockMeta}>Budget usage 73%</Text>
              </View>

              <View style={styles.mockChart}>
                {[58, 96, 74, 128].map((height, index) => (
                  <View key={`bar-${index}`} style={styles.mockBarCol}>
                    <View style={[styles.mockBar, { height }]} />
                    <Text style={styles.mockBarLabel}>W{index + 1}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.mockList}>
                {insightRows.map((row) => (
                  <View key={row.label} style={styles.mockListRow}>
                    <Text style={styles.mockListLabel}>{row.label}</Text>
                    <Text style={styles.mockListValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.footerMetaRow}>
            <Text style={styles.footerMetaText}>Cross-device sync ready</Text>
            <Text style={styles.footerMetaDivider}>/</Text>
            <Text style={styles.footerMetaText}>Web and mobile workflow</Text>
          </View>
        </BlurView>
      </View>
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
  mobileScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 30,
    gap: 18,
  },
  mobileHero: {
    paddingTop: 6,
  },
  mobileEyebrow: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  mobileHeadline: {
    marginTop: 12,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileSubtitle: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    color: "#B6C2D3",
  },
  mobilePreview: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.74)",
    padding: 18,
  },
  mobilePreviewHeader: {
    marginBottom: 14,
  },
  mobilePreviewTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileBalanceCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  mobileBalanceValue: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileChart: {
    marginTop: 16,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    minHeight: 210,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  mobileChartCol: {
    flex: 1,
    alignItems: "center",
    gap: 10,
  },
  mobileChartBar: {
    width: "100%",
    maxWidth: 56,
    borderRadius: 16,
    backgroundColor: "#38BDF8",
  },
  mobileFeaturePanel: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    padding: 18,
    gap: 12,
  },
  mobileActionStack: {
    gap: 12,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 30,
    justifyContent: "space-between",
    gap: 22,
  },
  shellWide: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 48,
    paddingTop: 42,
    paddingBottom: 42,
    gap: 32,
  },
  heroColumn: {
    flex: 1,
    justifyContent: "center",
  },
  heroColumnWide: {
    maxWidth: 540,
    paddingVertical: 24,
  },
  brandRow: {
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
  headline: {
    marginTop: 22,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  headlineWide: {
    fontSize: 58,
    lineHeight: 64,
  },
  subtitle: {
    marginTop: 16,
    maxWidth: 540,
    fontSize: 15,
    lineHeight: 24,
    color: "#B6C2D3",
  },
  subtitleWide: {
    fontSize: 17,
    lineHeight: 28,
  },
  actionRow: {
    marginTop: 26,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  actionRowStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  primaryButton: {
    minHeight: 54,
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
  featureStack: {
    marginTop: 28,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: "#67E8F9",
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#CBD5E1",
  },
  visualPanel: {
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    padding: 20,
  },
  visualPanelWide: {
    flex: 1,
    maxWidth: 640,
    justifyContent: "space-between",
  },
  visualGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  visualHeader: {
    marginBottom: 18,
  },
  visualEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  visualTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mockFrame: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(2, 6, 23, 0.76)",
    overflow: "hidden",
  },
  mockTopBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mockDots: {
    flexDirection: "row",
    gap: 8,
  },
  mockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mockTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  mockBody: {
    padding: 18,
    gap: 18,
  },
  mockBalanceCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  mockLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#67E8F9",
  },
  mockValue: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mockMeta: {
    marginTop: 8,
    fontSize: 13,
    color: "#94A3B8",
  },
  mockChart: {
    borderRadius: 22,
    padding: 18,
    minHeight: 220,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  mockBarCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  mockBar: {
    width: "100%",
    maxWidth: 72,
    borderRadius: 18,
    backgroundColor: "#38BDF8",
  },
  mockBarLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#CBD5E1",
  },
  mockList: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    gap: 12,
  },
  mockListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mockListLabel: {
    flex: 1,
    fontSize: 13,
    color: "#94A3B8",
  },
  mockListValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E2E8F0",
  },
  footerMetaRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  footerMetaText: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footerMetaDivider: {
    fontSize: 12,
    color: "#475569",
  },
});
