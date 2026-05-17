import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

interface Props {
  language?: AppLanguage;
  onGetStarted: () => void;
}

const ONBOARDING_STEPS: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    title: "Add expense with receipt capture",
    body: "Log expenses quickly, attach an image receipt, and keep proof in one place.",
    icon: "camera-outline",
  },
  {
    title: "Track Spending trends and budget health",
    body: "Review spending momentum, category breakdown, and budget status from one dashboard.",
    icon: "stats-chart-outline",
  },
  {
    title: "Use EyeGasto even offline",
    body: "Record spending without internet and sync once you're online again.",
    icon: "cloud-offline-outline",
  },
];

export default function OnboardingIntroScreen({
  language = "English",
  onGetStarted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const uiLanguage = resolveUiLanguage(language);
  const steps =
    uiLanguage === "Filipino"
      ? [
          {
            title: "Magdagdag ng gastos na may resibo",
            body: "Mag-log ng gastos nang mabilis, mag-attach ng image receipt, at itago ang patunay sa iisang lugar.",
            icon: "camera-outline" as const,
          },
          {
            title: "Subaybayan ang trends at budget health",
            body: "Suriin ang spending momentum, category breakdown, at budget status mula sa iisang dashboard.",
            icon: "stats-chart-outline" as const,
          },
          {
            title: "Gamitin ang EyeGasto kahit offline",
            body: "Mag-record ng gastos kahit walang internet at mag-sync kapag online ka na ulit.",
            icon: "cloud-offline-outline" as const,
          },
        ]
      : ONBOARDING_STEPS;
  const copy =
    uiLanguage === "Filipino"
      ? {
          eyebrow: "Quick Look",
          title: "Ginawa para sa mas malinaw na pagtingin",
          skip: "Laktawan",
          next: "Susunod",
          getStarted: "Magsimula",
        }
      : {
          eyebrow: "Quick Look",
          title: "Built for optimized oversight",
          skip: "Skip",
          next: "Next",
          getStarted: "Get Started",
        };
  const [stepIndex, setStepIndex] = useState(0);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / ONBOARDING_STEPS.length)).current;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isWeb = Platform.OS === "web";
  const webCardSize = Math.min(500, Math.max(360, width * 0.31));
  const shellInsetStyle = {
    paddingTop: Math.max(isWeb ? 42 : 68, insets.top + 16),
    paddingBottom: Math.max(isWeb ? 36 : 28, insets.bottom + 18),
  };

  const progressLabel = useMemo(
    () => `${stepIndex + 1}/${steps.length}`,
    [stepIndex, steps.length],
  );

  useEffect(() => {
    cardAnim.setValue(0);
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();

    Animated.timing(progressAnim, {
      toValue: (stepIndex + 1) / steps.length,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [cardAnim, progressAnim, stepIndex, steps.length]);

  const cardAnimatedStyle = {
    opacity: cardAnim,
    transform: [
      {
        translateX: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        }),
      },
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <LinearGradient
      colors={["#020617", "#081225", "#10213F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <ScrollView
        contentContainerStyle={[
          styles.shell,
          isWeb && styles.shellWeb,
          shellInsetStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.logoWrap, isWeb && styles.logoWrapWeb]}>
          <Image
            source={require("../../assets/images/app2.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.eyebrow, isWeb && styles.eyebrowWeb]}>
          {copy.eyebrow}
        </Text>
        <Text style={[styles.title, isWeb && styles.titleWeb]}>
          {copy.title}
        </Text>

        <Animated.View style={cardAnimatedStyle}>
        <BlurView
          intensity={28}
          tint="dark"
          style={[
            styles.card,
            isWeb && styles.cardWeb,
            isWeb && { width: webCardSize, minHeight: webCardSize * 0.72 },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={styles.progress}>{progressLabel}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onGetStarted}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>{copy.skip}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.iconWrap}>
            <Ionicons name={step.icon} size={24} color="#67E8F9" />
          </View>

          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardBody}>{step.body}</Text>

          <View style={styles.progressRail}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>

          <View style={styles.dotRow}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[styles.dot, index === stepIndex && styles.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.nextButtonWrap}
            activeOpacity={0.9}
            onPress={() => {
              if (isLast) {
                onGetStarted();
              } else {
                setStepIndex((value) => value + 1);
              }
            }}
          >
            <LinearGradient
              colors={["#67E8F9", "#38BDF8", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? copy.getStarted : copy.next}
              </Text>
            </LinearGradient>
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
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    bottom: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  shell: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 68,
    paddingBottom: 28,
    justifyContent: "center",
  },
  shellWeb: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 42,
    paddingBottom: 36,
  },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
    marginBottom: 12,
  },
  logoWrapWeb: {
    marginBottom: 10,
  },
  logo: {
    width: 68,
    height: 68,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#67E8F9",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  eyebrowWeb: {
    textAlign: "center",
  },
  title: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  titleWeb: {
    textAlign: "center",
  },
  card: {
    marginTop: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(8, 15, 30, 0.78)",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
  },
  cardWeb: {
    alignSelf: "center",
    maxWidth: 520,
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progress: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#CBD5E1",
  },
  iconWrap: {
    marginTop: 14,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 15, 30, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(103, 232, 249, 0.28)",
    alignSelf: "center",
  },
  cardTitle: {
    marginTop: 10,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#F8FAFC",
    textAlign: "center",
  },
  cardBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: "#CBD5E1",
    textAlign: "center",
  },
  dotRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  progressRail: {
    marginTop: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(71, 85, 105, 0.34)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#67E8F9",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.45)",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#67E8F9",
  },
  nextButtonWrap: {
    marginTop: 16,
    borderRadius: 999,
    overflow: "hidden",
  },
  nextButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: {
    color: "#082F49",
    fontSize: 16,
    fontWeight: "900",
  },
});
