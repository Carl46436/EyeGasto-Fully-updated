import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";

interface ErrorAlertProps {
  message: string;
  type?: "error" | "warning" | "success";
  duration?: number;
  onDismiss?: () => void;
}

export default function ErrorAlert({
  message,
  type = "error",
  duration = 3000,
  onDismiss,
}: ErrorAlertProps) {
  const [visible, setVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  }, [fadeAnim, onDismiss]);

  useEffect(() => {
    if (!duration) {
      return;
    }

    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [dismiss, duration]);

  if (!visible) return null;

  const backgroundColor =
    type === "error" ? "#FF6B6B" : type === "warning" ? "#FFA500" : "#4CAF50";

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.alert, { backgroundColor }]}>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
          <Text style={styles.closeText}>X</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    paddingTop: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
});
