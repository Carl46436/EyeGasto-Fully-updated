import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

interface Props {
  language?: AppLanguage;
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

const featureList = [
  "Track daily spending with receipts and clean categories",
  "Review monthly movement with charts, export tools, and gallery views",
  "One account. Total sync. Access your data on your phone or the web.",
];

const previewSnapshotConfig = {
  points: [920, 1280, 1180, 1680, 2140, 2420],
};

export default function WelcomeScreen({
  language = "English",
  onLoginPress,
  onRegisterPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === "web" && width >= 960;
  const mobileScrollInsetStyle = {
    paddingTop: Math.max(Platform.OS === "android" ? 66 : 44, insets.top + 14),
    paddingBottom: 30 + (Platform.OS === "web" ? 0 : insets.bottom),
  };
  const uiLanguage = resolveUiLanguage(language);
  const copy =
    uiLanguage === "Filipino"
      ? {
          headline:
            "Tingnan kung saan napupunta ang pera mo. Lahat nasa iisang lugar, walang hassle.",
          subtitle:
            "Ang madaling paraan para subaybayan ang gastos, makita ang habits mo, at maitago ang lahat ng resibo sa ligtas na lugar.",
          visualEyebrow: "Quick Look",
          visualTitle: "Tingnan agad ang spending mo",
          monthLabel: "Ngayong Buwan",
          monthMeta: "Budget usage 73%",
          snapshotTitle: "Monthly Snapshot",
          snapshotSubtitle:
            "Mas malinis na preview kung paano takbo ng buwan na ito",
          spent: "PHP 18,420 spent",
          left: "PHP 6,780 left",
          insight:
            "Nasa tamang takbo ngayong buwan at mas steady kaysa sa nakaraang buwan.",
          footerLeft: "Handa ang cross-device sync",
          footerRight: "Web at mobile workflow",
          login: "Log In",
          register: "Gumawa ng account",
          features: [
            "Subaybayan araw-araw ang gastos gamit ang resibo at malinis na categories",
            "Suriin ang galaw buwan-buwan gamit ang charts, export tools, at gallery views",
            "Iisang account. Full sync. I-access ang data mo sa phone o sa web.",
          ],
        }
      : {
          headline:
            "See where your money goes. All in one place, with zero hassle.",
          subtitle:
            "The easy way to track your spending, see your habits, and keep all your receipts in one safe place.",
          visualEyebrow: "Quick Look",
          visualTitle: "See your spending at a glance",
          monthLabel: "This Month",
          monthMeta: "Budget usage 73%",
          snapshotTitle: "Monthly Snapshot",
          snapshotSubtitle:
            "A cleaner preview of how this month is going",
          spent: "PHP 18,420 spent",
          left: "PHP 6,780 left",
          insight:
            "On track this month with a steadier pace than the previous month.",
          footerLeft: "Cross-device sync ready",
          footerRight: "Web and mobile workflow",
          login: "Log In",
          register: "Create account",
          features: featureList,
        };
  const heroAnim = useRef(new Animated.Value(0)).current;
  const previewAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  const previewSnapshotChart = useMemo(() => {
    const chartWidth = 476;
    const chartHeight = 118;
    const left = isWebWide ? 12 : 10;
    const right = isWebWide ? 4 : 6;
    const top = 12;
    const bottom = 16;
    const plotWidth = chartWidth - left - right;
    const plotHeight = chartHeight - top - bottom;
    const maxValue = Math.max(...previewSnapshotConfig.points, 0);
    const safeMax = maxValue > 0 ? maxValue : 1;
    const xStep =
      previewSnapshotConfig.points.length > 1
        ? plotWidth / (previewSnapshotConfig.points.length - 1)
        : 0;

    const points = previewSnapshotConfig.points.map((value, index) => {
      const x = left + xStep * index;
      const y = top + (1 - value / safeMax) * plotHeight;
      return {
        x,
        y,
        total: value,
        index,
      };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${top + plotHeight} L ${
            points[0].x
          } ${top + plotHeight} Z`
        : "";
    return {
      width: chartWidth,
      height: chartHeight,
      points,
      linePath,
      areaPath,
      baselineY: top + plotHeight,
    };
  }, [isWebWide]);

  const renderMonthlySnapshotCard = (compact: boolean) => (
    <View style={compact ? styles.mobileMockChart : styles.mockChart}>
      <View style={styles.snapshotHeaderRow}>
        <View style={styles.snapshotCopy}>
          <Text style={styles.mockTrendTitle}>{copy.snapshotTitle}</Text>
          <Text style={styles.mockTrendSubtitle}>
            {copy.snapshotSubtitle}
          </Text>
        </View>
        <Text style={styles.snapshotPercent}>73%</Text>
      </View>

      <View style={styles.snapshotProgressTrack}>
        <LinearGradient
          colors={["#38DDF5", "#60A5FA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.snapshotProgressFill}
        />
      </View>

      <View style={styles.snapshotMetaRow}>
        <Text style={styles.snapshotMetaText}>{copy.spent}</Text>
        <Text style={styles.snapshotMetaText}>{copy.left}</Text>
      </View>

      <View style={styles.previewChartFrame}>
        <View
          style={[
            styles.previewChartWrap,
            !compact && styles.previewChartWrapWide,
          ]}
        >
          <Svg
            width="100%"
            height={compact ? 140 : 148}
            viewBox={`0 0 ${previewSnapshotChart.width} ${previewSnapshotChart.height}`}
          >
            <Line
              x1="0"
              x2={String(previewSnapshotChart.width)}
              y1={previewSnapshotChart.baselineY}
              y2={previewSnapshotChart.baselineY}
              stroke="rgba(148,163,184,0.22)"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
            {previewSnapshotChart.areaPath ? (
              <Path
                d={previewSnapshotChart.areaPath}
                fill="rgba(56,189,248,0.14)"
              />
            ) : null}
            {previewSnapshotChart.linePath ? (
              <Path
                d={previewSnapshotChart.linePath}
                stroke="#38DDF5"
                strokeWidth="4"
                fill="none"
              />
            ) : null}
            {previewSnapshotChart.points.map((point) => (
              <Circle
                key={`snapshot-point-${point.index}-${point.x}`}
                cx={point.x}
                cy={point.y}
                r={point.index === previewSnapshotChart.points.length - 1 ? "5.5" : "4.5"}
                fill="#38DDF5"
                stroke="#7DD3FC"
                strokeWidth="2"
              />
            ))}
          </Svg>
        </View>
      </View>

      <Text style={styles.snapshotInsight}>{copy.insight}</Text>
    </View>
  );

  useEffect(() => {
    heroAnim.setValue(0);
    previewAnim.setValue(0);
    actionsAnim.setValue(0);

    Animated.sequence([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(previewAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [actionsAnim, heroAnim, previewAnim]);

  const heroAnimatedStyle = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const previewAnimatedStyle = {
    opacity: previewAnim,
    transform: [
      {
        translateY: previewAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
      {
        scale: previewAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const actionsAnimatedStyle = {
    opacity: actionsAnim,
    transform: [
      {
        translateY: actionsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

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
          contentContainerStyle={[
            styles.mobileScrollContent,
            mobileScrollInsetStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.mobileHero, heroAnimatedStyle]}>
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

            <Text style={styles.mobileHeadline}>{copy.headline}</Text>
            <Text style={styles.mobileSubtitle}>{copy.subtitle}</Text>
          </Animated.View>

          <Animated.View style={previewAnimatedStyle}>
          <BlurView intensity={28} tint="dark" style={styles.mobilePreview}>
            <LinearGradient
              colors={["rgba(34,211,238,0.18)", "rgba(59,130,246,0.08)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.visualGlow}
            />
            <View style={styles.visualHeader}>
              <Text style={styles.visualEyebrow}>{copy.visualEyebrow}</Text>
              <Text style={styles.mobilePreviewTitle}>
                {copy.visualTitle}
              </Text>
            </View>

            <View style={styles.mockFrame}>
              <View style={styles.mockBody}>
                <View style={styles.mockBalanceCard}>
                  <Text style={styles.mockLabel}>{copy.monthLabel}</Text>
                  <Text style={styles.mobileMockValue}>PHP 18,420</Text>
                  <Text style={styles.mockMeta}>{copy.monthMeta}</Text>
                </View>

                {renderMonthlySnapshotCard(true)}
              </View>
            </View>

            <View style={styles.footerMetaRow}>
              <Text style={styles.footerMetaText}>{copy.footerLeft}</Text>
              <Text style={styles.footerMetaDivider}>/</Text>
              <Text style={styles.footerMetaText}>{copy.footerRight}</Text>
            </View>
          </BlurView>
          </Animated.View>

          <Animated.View style={actionsAnimatedStyle}>
          <View style={styles.featureStack}>
            {copy.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={styles.mobileActionStack}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onLoginPress}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>{copy.login}</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRegisterPress}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryButtonText}>{copy.register}</Text>
            </TouchableOpacity>
          </View>
          </Animated.View>
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

      <View style={styles.shellWide}>
        <Animated.View style={[styles.heroColumnWide, heroAnimatedStyle]}>
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

          <Text style={styles.headlineWide}>{copy.headline}</Text>

          <Text style={styles.subtitleWide}>{copy.subtitle}</Text>

          <View style={styles.featureStack}>
            {copy.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onLoginPress}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>{copy.login}</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRegisterPress}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryButtonText}>{copy.register}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={previewAnimatedStyle}>
        <BlurView intensity={30} tint="dark" style={styles.visualPanelWide}>
          <LinearGradient
            colors={["rgba(34,211,238,0.2)", "rgba(59,130,246,0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.visualGlow}
          />

          <View style={styles.visualHeader}>
            <Text style={styles.visualEyebrow}>{copy.visualEyebrow}</Text>
            <Text style={styles.visualTitle}>{copy.visualTitle}</Text>
          </View>

          <View style={styles.mockFrame}>
            <View style={styles.mockBody}>
              <View style={styles.mockBalanceCard}>
                <Text style={styles.mockLabel}>{copy.monthLabel}</Text>
                <Text style={styles.mockValue}>PHP 18,420</Text>
                <Text style={styles.mockMeta}>{copy.monthMeta}</Text>
              </View>

              {renderMonthlySnapshotCard(false)}
            </View>
          </View>

          <View style={styles.footerMetaRow}>
            <Text style={styles.footerMetaText}>{copy.footerLeft}</Text>
            <Text style={styles.footerMetaDivider}>/</Text>
            <Text style={styles.footerMetaText}>{copy.footerRight}</Text>
          </View>
        </BlurView>
        </Animated.View>
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
  mobileHeadline: {
    marginTop: 18,
    fontSize: 34,
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
  mobilePreviewTitle: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileActionStack: {
    marginTop: 26,
    gap: 12,
  },
  mobileMockValue: {
    marginTop: 14,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mobileMockChart: {
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 12,
    minHeight: 314,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  shellWide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 48,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 36,
  },
  heroColumnWide: {
    flex: 1,
    maxWidth: 620,
    justifyContent: "center",
    paddingVertical: 28,
  },
  headlineWide: {
    fontSize: 58,
    lineHeight: 66,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  subtitleWide: {
    marginTop: 20,
    maxWidth: 560,
    fontSize: 17,
    lineHeight: 28,
    color: "#B6C2D3",
  },
  actionRow: {
    marginTop: 34,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  featureStack: {
    marginTop: 28,
    gap: 12,
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
  visualPanelWide: {
    flex: 1,
    maxWidth: 800,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    padding: 24,
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
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mockFrame: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    overflow: "hidden",
  },
  mockBody: {
    padding: 20,
    gap: 18,
  },
  mockBalanceCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  mockLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#67E8F9",
  },
  mockValue: {
    marginTop: 14,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mockMeta: {
    marginTop: 10,
    fontSize: 14,
    color: "#94A3B8",
  },
  mockChart: {
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 12,
    minHeight: 286,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  snapshotHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  snapshotCopy: {
    flex: 1,
  },
  mockTrendTitle: {
    alignSelf: "flex-start",
    fontSize: 16,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  mockTrendSubtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 17,
    color: "#94A3B8",
  },
  snapshotPercent: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  snapshotProgressTrack: {
    marginBottom: 10,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(71, 85, 105, 0.34)",
  },
  snapshotProgressFill: {
    width: "73%",
    height: "100%",
    borderRadius: 999,
  },
  snapshotMetaRow: {
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  snapshotMetaText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
  },
  previewChartFrame: {
    borderRadius: 24,
    overflow: "visible",
    backgroundColor: "rgba(2, 6, 23, 0.22)",
  },
  previewChartWrap: {
    width: "100%",
    marginTop: 0,
    marginHorizontal: 0,
  },
  previewChartWrapWide: {
    marginHorizontal: -10,
  },
  snapshotInsight: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#CBD5E1",
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
