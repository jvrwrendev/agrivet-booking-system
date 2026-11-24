import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/hooks/use-auth";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { LocationTrackingProvider } from "@/hooks/use-location-tracking";

export function AppProviders({ children }: { children?: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <SafeAreaProvider>
        <AuthProvider>
          <FavoritesProvider>
            <LocationTrackingProvider>{children}</LocationTrackingProvider>
          </FavoritesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}