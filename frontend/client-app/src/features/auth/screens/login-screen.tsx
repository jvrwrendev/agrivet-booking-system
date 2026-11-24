import React, { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInputInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { APP_FULL_NAME, BUSINESS_NAME } from "@/constants";
import { useAuth } from "@/hooks/use-auth";
import { cn, validateEmail } from "@/lib/utils";
import type { RootStackParamList } from "@/app/navigation/types";

const ICON_MUTED = "#6B7280";
const ICON_PRIMARY = "#111827";

const CONTENT_MAX_WIDTH = 440;

export function LoginScreen() {
  const { login, resendVerification } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const passwordRef = useRef<TextInputInstance>(null);

  const emailError = submitted ? validateEmail(email) : undefined;
  const passwordError =
    submitted && !password ? "Password is required." : undefined;

  const resetFeedback = () => {
    setError(null);
    setForgot(false);
    setUnverified(false);
    setResendMessage(null);
  };

  const onEmailChange = (value: string) => {
    setEmail(value);
    resetFeedback();
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
    resetFeedback();
  };

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitted(true);
    setForgot(false);
    setError(null);

    if (validateEmail(email) || !password) {
      Keyboard.dismiss();
      return;
    }

    setSubmitting(true);
    const result = await login({ email: email.trim(), password });
    setSubmitting(false);
    if (!result.success) {
      setUnverified(result.code === "EMAIL_NOT_VERIFIED");
      setError(result.error ?? "Login failed. Please try again.");
    }
  };

  const onResendVerification = async () => {
    if (resending) return;
    setResending(true);
    setResendMessage(null);
    const result = await resendVerification(email.trim());
    setResending(false);
    if (result.success) {
      setResendMessage(
        "A verification code has been sent. Check your inbox, then sign in."
      );
    } else {
      setError(result.error ?? "Could not resend the verification email.");
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 14,
            paddingBottom: 28,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="w-full flex-1 self-center justify-between"
            style={{ maxWidth: CONTENT_MAX_WIDTH }}
          >
            <View className="mb-6 mt-1">
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                className="h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-secondary/35 active:scale-95 active:bg-secondary"
              >
                <ArrowLeft size={20} color={ICON_PRIMARY} strokeWidth={2} />
              </Pressable>
            </View>

            <View className="my-auto py-4">
              <View className="mb-8">
                <View className="mb-5 self-start rounded-2xl border border-border/60 bg-secondary/25 p-2.5 shadow-xs">
                  <BrandLogo size={48} />
                </View>
                <Text
                  className="text-[28px] font-bold leading-9 tracking-tight text-foreground"
                  accessibilityRole="header"
                >
                  Welcome back
                </Text>
                <Text className="mt-1.5 text-[15px] leading-6 text-muted-foreground">
                  Sign in to continue to{" "}
                  <Text className="text-[15px] font-semibold text-foreground">
                    {BUSINESS_NAME}
                  </Text>
                  .
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-muted-foreground/85">
                  {APP_FULL_NAME}
                </Text>
              </View>

              <View className="gap-3.5">
                <View className="gap-2">
                  <Input
                    size="control"
                    label="Email address"
                    accessibilityLabel="Email address"
                    value={email}
                    onChangeText={onEmailChange}
                    error={emailError}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="name@agrivet.ph"
                    leftIcon={
                      <Mail size={18} color={ICON_MUTED} strokeWidth={1.8} />
                    }
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />

                  <Input
                    inputRef={passwordRef}
                    size="control"
                    label="Password"
                    accessibilityLabel="Password"
                    labelAction={
                      <Pressable
                        onPress={() => {
                          setForgot((f) => !f);
                          setError(null);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Forgot password"
                        className="min-h-[36px] justify-center px-1 active:opacity-70"
                      >
                        <Text className="text-[13px] font-semibold text-primary">
                          Forgot password?
                        </Text>
                      </Pressable>
                    }
                    value={password}
                    onChangeText={onPasswordChange}
                    error={passwordError}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    textContentType="password"
                    placeholder="Enter your password"
                    leftIcon={
                      <Lock size={18} color={ICON_MUTED} strokeWidth={1.8} />
                    }
                    rightIcon={
                      <Pressable
                        onPress={() => setShowPassword((s) => !s)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="h-11 w-11 items-center justify-center rounded-md active:bg-secondary/60 active:opacity-80"
                      >
                        {showPassword ? (
                          <EyeOff
                            size={18}
                            color={ICON_MUTED}
                            strokeWidth={1.8}
                          />
                        ) : (
                          <Eye
                            size={18}
                            color={ICON_MUTED}
                            strokeWidth={1.8}
                          />
                        )}
                      </Pressable>
                    }
                    returnKeyType="go"
                    submitBehavior="submit"
                    onSubmitEditing={() => {
                      void onSubmit();
                    }}
                  />
                </View>

                <Pressable
                  onPress={() => setRememberMe((r) => !r)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  accessibilityLabel="Remember me"
                  className="min-h-[40px] flex-row items-center gap-3 self-start pr-2 active:opacity-80"
                >
                  <View
                    className={cn(
                      "h-5 w-5 items-center justify-center rounded-[5px] border",
                      rememberMe
                        ? "border-primary bg-primary"
                        : "border-field bg-background"
                    )}
                  >
                    {rememberMe ? (
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    ) : null}
                  </View>
                  <Text className="text-[14px] font-medium text-foreground/90">
                    Remember me
                  </Text>
                </Pressable>

                {error ? (
                  <View
                    className="rounded-xl border border-danger/25 bg-danger/8 p-4"
                    accessibilityRole="alert"
                  >
                    <View className="flex-row items-start gap-3">
                      <AlertCircle
                        size={18}
                        color="#DC2626"
                        strokeWidth={2}
                        style={{ marginTop: 2 }}
                      />
                      <View className="flex-1 gap-3">
                        <Text className="text-[14px] font-medium leading-5 text-danger">
                          {error}
                        </Text>
                        {unverified ? (
                          <>
                            <Button
                              label="Resend verification email"
                              variant="outline"
                              size="sm"
                              loading={resending}
                              disabled={resending || submitting}
                              onPress={() => {
                                void onResendVerification();
                              }}
                              className="self-start bg-background"
                            />
                            {resendMessage ? (
                              <Text className="text-[13px] font-medium leading-5 text-success">
                                {resendMessage}
                              </Text>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}

                {forgot && !error ? (
                  <View
                    className="rounded-xl border border-border bg-secondary/50 p-4"
                    accessibilityRole="alert"
                  >
                    <View className="flex-row items-start gap-3">
                      <Info
                        size={18}
                        color="#4B5563"
                        strokeWidth={2}
                        style={{ marginTop: 2 }}
                      />
                      <Text className="flex-1 text-[14px] leading-5 text-muted-foreground">
                        Contact your Agrivet administrator to reset your
                        password.
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Button
                  size="control"
                  label="Sign in"
                  onPress={() => {
                    void onSubmit();
                  }}
                  loading={submitting}
                  disabled={submitting}
                  fullWidth
                  className="mt-1 shadow-xs"
                />
              </View>
            </View>

            <View className="items-center pt-4">
              <Pressable
                onPress={() => navigation.navigate("Register")}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Create an account"
                className="min-h-[44px] justify-center px-2 active:opacity-70"
              >
                <Text className="text-center text-[14px] text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <Text className="text-[14px] font-semibold text-primary">
                    Create an account
                  </Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}