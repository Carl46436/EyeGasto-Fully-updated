import React from "react";
import {
  Image,
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
import Svg, {
  Circle,
  Defs,
  Line as SvgLine,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";

interface Props {
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

const featureList = [
  "Track daily spending with receipts and clean categories",
  "Review monthly movement with charts, export tools, and gallery views",
  "One account. Total sync. Access your data on your phone or the web.",
];

const guideSteps = [
  {
    title: "1. Sign in or create an account",
    body: "Use your email to access your personal dashboard and sync your records.",
  },
  {
    title: "2. Add expenses with receipts",
    body: "Save amount, category, notes, and image proof in one workflow.",
  },
  {
    title: "3. Review stats and reports",
    body: "Open analytics, gallery, and summary exports to monitor spending.",
  },
];

const MOBILE_TREND_POINTS = [18, 24, 20, 28, 62, 100];
const MOBILE_TREND_LABELS = ["W1", "W2", "W3", "W4", "W5", "W6"];
const WEB_TREND_POINTS = [18, 24, 20, 28, 62, 100];
const WEB_TREND_LABELS = ["W1", "W2", "W3", "W4", "W5", "W6"];

const createTrendGeometry = (
  points: number[],
  width: number,
  height: number,
  inset = 14,
) => {
  const drawableWidth = Math.max(width - inset * 2, 1);
  const slotWidth = drawableWidth / Math.max(points.length - 1, 1);
  const circles = points.map((value, index) => {
    const x = inset + slotWidth * index;
    const y = height - (value / 100) * height;
    return { x, y };
  });

  const path = circles
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const firstX = circles[0]?.x ?? inset;
  const lastX = circles[circles.length - 1]?.x ?? width - inset;
  const areaPath = `${path} L ${lastX} ${height} L ${firstX} ${height} Z`;

  return { circles, path, areaPath };
};

export default function WelcomeScreen({
  onLoginPress,
  onRegisterPress,
}: Props) {
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const mobileChartWidth = Math.min(Math.max(width - 120, 240), 300);
  const mobileTrend = createTrendGeometry(
    MOBILE_TREND_POINTS,
    mobileChartWidth,
    136,
    12,
  );
  const webTrend = createTrendGeometry(WEB_TREND_POINTS, 520, 170, 16);

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

            <Text style={styles.mobileEyebrow}>Your Budget buddy </Text>
            <Text style={styles.mobileHeadline}>
              Track every Peso, effortlessly.
            </Text>
            <Text style={styles.mobileSubtitle}>
              Track purchases, save receipts, and review the month from one tap
            </Text>
          </View>

          <BlurView intensity={28} tint="dark" style={styles.mobilePreview}>
            <View style={styles.visualHeader}>
              <Text style={styles.visualEyebrow}>Quick Look</Text>
              <Text style={styles.mobilePreviewTitle}>
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

                <View style={styles.mobileMockChart}>
                  <Text style={styles.mockTrendTitle}>Spending Momentum</Text>
                  <Svg width={mobileChartWidth} height={136}>
                    <Defs>
                      <SvgLinearGradient
                        id="mobileTrendFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <Stop
                          offset="0%"
                          stopColor="#38BDF8"
                          stopOpacity="0.34"
                        />
                        <Stop
                          offset="100%"
                          stopColor="#38BDF8"
                          stopOpacity="0.02"
                        />
                      </SvgLinearGradient>
                    </Defs>
                    <SvgLine
                      x1="12"
                      y1="108"
                      x2={Math.max(mobileChartWidth - 12, 12)}
                      y2="108"
                      stroke="rgba(148,163,184,0.28)"
                      strokeWidth="1.3"
                      strokeDasharray="5 5"
                    />
                    <Path
                      d={mobileTrend.areaPath}
                      fill="url(#mobileTrendFill)"
                    />
                    <Path
                      d={mobileTrend.path}
                      stroke="#37D7E6"
                      strokeWidth="3.4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {mobileTrend.circles.map((point, index) => (
                      <Circle
                        key={`mobile-trend-dot-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="4.4"
                        fill="#38BDF8"
                        stroke="#7DD3FC"
                        strokeWidth="2"
                      />
                    ))}
                  </Svg>
                  <View style={styles.mobileTrendLabelsRow}>
                    {MOBILE_TREND_LABELS.map((label) => (
                      <Text
                        key={`mobile-label-${label}`}
                        style={styles.mobileTrendLabel}
                      >
                        {label}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.footerMetaRow}>
              <Text style={styles.footerMetaText}>Cross-device sync ready</Text>
              <Text style={styles.footerMetaDivider}>/</Text>
              <Text style={styles.footerMetaText}>Web and mobile workflow</Text>
            </View>
          </BlurView>

          <BlurView
            intensity={18}
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

          <View style={styles.guidePanel}>
            <Text style={styles.guideHeading}>Quick Guide Before Login</Text>
            <View style={styles.guideGrid}>
              {guideSteps.map((step) => (
                <View key={step.title} style={styles.guideCard}>
                  <Text style={styles.guideCardTitle}>{step.title}</Text>
                  <Text style={styles.guideCardBody}>{step.body}</Text>
                </View>
              ))}
            </View>
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
                <Text style={styles.mockTrendTitle}>Spending Momentum</Text>
                <Svg width={520} height={170}>
                  <Defs>
                    <SvgLinearGradient
                      id="webTrendFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#38BDF8"
                        stopOpacity="0.32"
                      />
                      <Stop
                        offset="100%"
                        stopColor="#38BDF8"
                        stopOpacity="0.03"
                      />
                    </SvgLinearGradient>
                  </Defs>
                  <SvgLine
                    x1="16"
                    y1="146"
                    x2="504"
                    y2="146"
                    stroke="rgba(148,163,184,0.28)"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  <Path d={webTrend.areaPath} fill="url(#webTrendFill)" />
                  <Path
                    d={webTrend.path}
                    stroke="#37D7E6"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {webTrend.circles.map((point, index) => (
                    <Circle
                      key={`web-trend-dot-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="#38BDF8"
                      stroke="#7DD3FC"
                      strokeWidth="2"
                    />
                  ))}
                </Svg>
                <View style={styles.mockTrendLabelRow}>
                  {WEB_TREND_LABELS.map((label) => (
                    <Text
                      key={`web-label-${label}`}
                      style={styles.mockBarLabel}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.footerMetaRow}>
            <Text style={styles.footerMetaText}>View</Text>
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
    paddingTop: Platform.OS === "android" ? 66 : 44,
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
    fontSize: 30,
    lineHeight: 36,
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
  mobileWelcomeOverlay: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(9, 18, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    gap: 14,
  },
  mobileWelcomeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  mobileWelcomeTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileWelcomeSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    maxWidth: 250,
  },
  mobileWelcomeFeatureCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.25)",
    padding: 16,
    alignItems: "center",
  },
  mobileWelcomeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.32)",
  },
  mobileWelcomeFeatureTitle: {
    marginTop: 10,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#F8FAFC",
    textAlign: "center",
  },
  mobileWelcomeFeatureBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
    textAlign: "center",
  },
  mobileTrendCard: {
    marginTop: 14,
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.76)",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  mobileTrendTitle: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: "#E2E8F0",
    marginBottom: 4,
  },
  mobileTrendLabelsRow: {
    width: "100%",
    marginTop: 2,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mobileTrendLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  mobileWelcomeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mobileWelcomeDot: {
    width: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#67E8F9",
  },
  mobileWelcomeNext: {
    minWidth: 76,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#7DD3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileWelcomeNextText: {
    color: "#082F49",
    fontSize: 12,
    fontWeight: "900",
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
  guidePanel: {
    marginTop: 28,
    gap: 12,
  },
  guideGrid: {
    gap: 12,
  },
  guideHeading: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  guideCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    padding: 16,
  },
  guideCardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  guideCardBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
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
    minHeight: 248,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    alignItems: "center",
  },
  mobileMockChart: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 214,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    alignItems: "center",
  },
  mockTrendTitle: {
    alignSelf: "flex-start",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "900",
    color: "#E2E8F0",
  },
  mockTrendLabelRow: {
    width: "100%",
    marginTop: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
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
