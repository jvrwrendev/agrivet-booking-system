import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/** Neutral placeholder used while a section is loading. */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("rounded-md bg-muted", className)}
      style={style}
    />
  );
}
