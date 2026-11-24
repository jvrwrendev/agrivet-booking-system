import React, { useState } from "react";
import {
  Image,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Package } from "lucide-react-native";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  source?: string;
  className?: string;
  iconSize?: number;
  accessibilityLabel?: string;
  fallbackIcon?: React.ReactNode;
  style?: StyleProp<ImageStyle | ViewStyle>;
}

export function ProductImage({
  source,
  className,
  iconSize = 22,
  accessibilityLabel = "Product image",
  fallbackIcon,
  style,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(source) && !failed;

  if (showImage) {
    return (
      <Image
        source={{ uri: source }}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={accessibilityLabel}
        className={cn("bg-secondary", className)}
        style={style as StyleProp<ImageStyle>}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${accessibilityLabel} unavailable`}
      className={cn("items-center justify-center bg-secondary", className)}
      style={style as StyleProp<ViewStyle>}
    >
      {fallbackIcon ?? <Package size={iconSize} color="#64748B" />}
    </View>
  );
}
