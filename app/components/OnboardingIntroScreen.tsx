import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

interface Props {
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

export default function OnboardingIntroScreen({ onGetStarted }: Props) {
  const { width } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const isWeb = Platform.OS === "web";
  const webCardSize = Math.min(500, Math.max(360, width * 0.31));

  const progressLabel = useMemo(
    () => `${stepIndex + 1}/${ONBOARDING_STEPS.length}`,
    [stepIndex],
  );

  return (
    <LinearGradient
      colors={["#020617", "#081225", "#10213F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <View style={[styles.shell, isWeb && styles.shellWeb]}>
        <View style={[styles.logoWrap, isWeb && styles.logoWrapWeb]}>
          <Image
            source={require("../../assets/images/app2.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.eyebrow, isWeb && styles.eyebrowWeb]}>
          Welcome to EyeGasto
        </Text>
        <Text style={[styles.title, isWeb && styles.titleWeb]}>
          Before you sign in
        </Text>

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
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.iconWrap}>
            <Ionicons name={step.icon} size={24} color="#67E8F9" />
          </View>

          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardBody}>{step.body}</Text>

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
                {isLast ? "Get Started" : "Next"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
    flex: 1,
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
