import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppLanguage, resolveUiLanguage } from "@/src/i18n/appLanguage";

export default function LoadingScreen({
  language = "English",
  message = "Preparing your expense space...",
}: {
  language?: AppLanguage;
  message?: string;
}) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [messageIndex, setMessageIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  const uiLanguage = resolveUiLanguage(language);
  const loadingMessages = useMemo(
    () =>
      uiLanguage === "Filipino"
        ? [message, "Sine-sync ang iyong records...", "Inihahanda ang dashboard mo..."]
        : [message, "Syncing your records...", "Warming up your dashboard..."],
    [message, uiLanguage],
  );

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );

    pulseLoop.start();
    progressLoop.start();

    const interval = setInterval(() => {
      setMessageIndex((value) => (value + 1) % loadingMessages.length);
      setDotCount((value) => (value % 3) + 1);
    }, 1800);

    return () => {
      clearInterval(interval);
      pulseLoop.stop();
      progressLoop.stop();
    };
  }, [loadingMessages.length, progressAnim, pulseAnim]);

  const pulseStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1],
    }),
    transform: [
      {
        scale: pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.04],
        }),
      },
    ],
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["18%", "100%"],
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

      <Animated.View style={[styles.logoWrap, pulseStyle]}>
        <Image
          source={require("../../assets/images/app2.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Text style={styles.brand}>EyeGasto</Text>
      <Text style={styles.label}>Getting things ready</Text>
      <View style={styles.messageRow}>
        <Text style={styles.text}>{loadingMessages[messageIndex]}</Text>
        <Text style={styles.text}>{".".repeat(dotCount)}</Text>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
    overflow: "hidden",
    paddingHorizontal: 28,
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
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
  },
  logo: {
    width: 82,
    height: 82,
  },
  brand: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 0.5,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  messageRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    color: "#CBD5E1",
  },
  progressTrack: {
    marginTop: 20,
    width: 220,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(71, 85, 105, 0.34)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#67E8F9",
  },
});
