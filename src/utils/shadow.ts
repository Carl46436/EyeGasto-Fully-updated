import { Platform, type ViewStyle } from "react-native";

type WebShadowStyle = ViewStyle & {
  boxShadow?: string;
};

export const createShadow = (
  boxShadow: string,
  nativeShadow: ViewStyle,
): WebShadowStyle =>
  Platform.select({
    web: { boxShadow },
    default: nativeShadow,
  }) as WebShadowStyle;
