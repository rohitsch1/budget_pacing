/**
 * Shared UI primitives for Pace. Every screen should build from these so the look stays consistent
 * with the approved design (paper background, harbor ink, mint accent, Space Grotesk numbers).
 */
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { C, F, R, S } from "@/theme/tokens";

// ---------- Text ----------
type TVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "bodySemi"
  | "small"
  | "label"
  | "caption"
  | "number";
const tStyles: Record<TVariant, TextStyle> = {
  display: {
    fontFamily: F.display,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
  number: {
    fontFamily: F.display,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.5,
  },
  h1: {
    fontFamily: F.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: F.display,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  h3: { fontFamily: F.bodySemi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  bodySemi: { fontFamily: F.bodySemi, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: F.body, fontSize: 13, lineHeight: 19 },
  label: {
    fontFamily: F.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  caption: { fontFamily: F.body, fontSize: 12, lineHeight: 16 },
};

export function T({
  v = "body",
  color = C.ink,
  style,
  ...rest
}: TextProps & { v?: TVariant; color?: string }) {
  return <Text {...rest} style={[tStyles[v], { color }, style]} />;
}

// ---------- Screen ----------
export function Screen({
  children,
  scroll = false,
  dark = false,
  padded = true,
  footer,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  dark?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const bg = dark ? C.harbor : C.paper;
  const inner: ViewStyle = {
    paddingHorizontal: padded ? S.gutter : 0,
    paddingTop: insets.top + 8,
    gap: 14,
  };
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingBottom: 24 }, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, style]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: S.gutter,
            paddingTop: 8,
            paddingBottom: insets.bottom + 16,
            gap: 8,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

// ---------- Header ----------
export function Header({
  title,
  onBack,
  close = false,
  right,
  dark = false,
}: {
  title?: string;
  onBack?: () => void;
  close?: boolean;
  right?: ReactNode;
  dark?: boolean;
}) {
  const ink = dark ? C.onDark : C.ink;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 44,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={close ? "Close" : "Back"}
        hitSlop={8}
        onPress={
          onBack ??
          (() => (router.canGoBack() ? router.back() : router.replace("/")))
        }
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: -10,
        }}
      >
        <Icon name={close ? "close" : "back"} color={ink} />
      </Pressable>
      <T v="h3" color={ink} style={{ flex: 1 }} numberOfLines={1}>
        {title ?? ""}
      </T>
      {right}
    </View>
  );
}

// ---------- Buttons ----------
type BtnKind = "primary" | "secondary" | "ghost" | "mint" | "onDark";
export function Button({
  label,
  onPress,
  kind = "primary",
  disabled = false,
  loading = false,
  style,
  small = false,
}: {
  label: string;
  onPress?: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const k = {
    primary: { bg: C.harbor, fg: C.white, bd: C.harbor },
    mint: { bg: C.mint, fg: C.harbor, bd: C.mint },
    secondary: { bg: "transparent", fg: C.ink, bd: C.btnLine },
    ghost: { bg: "transparent", fg: C.link, bd: "transparent" },
    onDark: { bg: "transparent", fg: C.onDark, bd: C.harborSoft },
  }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: small ? 44 : 56,
          borderRadius: R.pill,
          backgroundColor: off && kind === "primary" ? C.chipLine : k.bg,
          borderWidth: 1,
          borderColor: off && kind === "primary" ? C.chipLine : k.bd,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <T
          v="bodySemi"
          color={off && kind === "primary" ? C.inkMuted : k.fg}
          style={{ fontSize: small ? 14 : 16 }}
        >
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 38,
          paddingHorizontal: 14,
          borderRadius: R.pill,
          borderWidth: 1,
          borderColor: selected ? C.harbor : C.chipLine,
          backgroundColor: selected ? C.harbor : C.white,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      <T
        v="small"
        color={selected ? C.white : C.ink}
        style={{ fontFamily: F.bodySemi }}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function Pill({
  label,
  bg,
  fg,
  style,
}: {
  label: string;
  bg: string;
  fg: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: R.pill,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <T v="caption" color={fg} style={{ fontFamily: F.bodyBold }}>
        {label}
      </T>
    </View>
  );
}

export function Card({
  children,
  style,
  dark = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? C.harbor : C.white,
          borderRadius: R.lg,
          borderWidth: dark ? 0 : 1,
          borderColor: C.line,
          padding: 16,
          gap: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Pace speaking — chat-style bubble used in onboarding. */
export function PaceBubble({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", gap: 10, alignItems: "flex-start" },
        style,
      ]}
    >
      <PaceMark size={30} />
      <View
        style={{
          flex: 1,
          backgroundColor: C.white,
          borderRadius: 18,
          borderTopLeftRadius: 6,
          borderWidth: 1,
          borderColor: C.line,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        {typeof children === "string" ? <T v="body">{children}</T> : children}
      </View>
    </View>
  );
}

/** User's reply bubble (right aligned, harbor) */
export function ReplyBubble({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-end",
        maxWidth: "80%",
        backgroundColor: C.harbor,
        borderRadius: 18,
        borderTopRightRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <T v="body" color={C.white}>
        {text}
      </T>
    </View>
  );
}

export function PaceMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={24} fill={C.harbor} />
      <Circle
        cx={24}
        cy={24}
        r={13}
        fill="none"
        stroke={C.harborLine}
        strokeWidth={5}
      />
      <Path
        d="M24 11 A13 13 0 0 1 36.4 28"
        fill="none"
        stroke={C.mint}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Progress ring: value 0..1 of remaining. */
export function Ring({
  size = 240,
  stroke = 18,
  value,
  color = C.mint,
  track = C.lineSoft,
  children,
}: {
  size?: number;
  stroke?: number;
  value: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * v} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", paddingHorizontal: stroke + 14 }}>
        {children}
      </View>
    </View>
  );
}

export function Bar({
  value,
  color = C.mint,
  track = C.line,
  height = 8,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${v * 100}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

// ---------- Icons (stroke, 24 grid) ----------
const ICONS: Record<string, string> = {
  back: "M15 18l-6-6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5 9-10",
  chevron: "M9 6l6 6-6 6",
  today: "M12 4a8 8 0 1 0 0.01 0M12 4a8 8 0 0 1 8 8",
  list: "M4 6h16M4 12h16M4 18h10",
  calendar: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  chart: "M5 20V10M12 20V4M19 20v-7",
  search: "M11 4a7 7 0 1 0 0.01 0M20 20l-3.5-3.5",
  image: "M4 4h16v16H4zM4 15l4-4 5 5M14 13l2-2 4 4",
  lock: "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3",
  info: "M12 3a9 9 0 1 0 0.01 0M12 8v5M12 16v.5",
  edit: "M4 20h4L19 9l-4-4L4 16v4z",
  down: "M12 5v14M6 13l6 6 6-6",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  card: "M3 6h18v13H3zM3 10h18",
  pin: "M12 17v5M8 3h8l-1 7 3 3H6l3-3z",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  settings: "M12 9a3 3 0 1 0 0.01 0M4 12h2M18 12h2M12 4v2M12 18v2",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
};
export function Icon({
  name,
  size = 22,
  color = C.ink,
  strokeWidth = 2,
}: {
  name: keyof typeof ICONS | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={ICONS[name] ?? ICONS.info} />
    </Svg>
  );
}

/** Numeric keypad used by Add expense and the "type the amount" fallback. */
export function Keypad({
  value,
  onChange,
  maxLen = 8,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLen?: number;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
  const press = (k: string) => {
    let a = value;
    if (k === "del") a = a.slice(0, -1);
    else if (k === ".") {
      if (!a.includes(".")) a = (a || "0") + ".";
    } else if (a.includes(".") && a.split(".")[1].length >= 2) return;
    else if (a.length < maxLen) a = a === "0" ? k : a + k;
    onChange(a);
  };
  const rows = [
    keys.slice(0, 3),
    keys.slice(3, 6),
    keys.slice(6, 9),
    keys.slice(9, 12),
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View key={row.join("")} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === "del" ? "Delete" : k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                flex: 1,
                height: 54,
                borderRadius: 16,
                backgroundColor: pressed ? C.lineSoft : C.white,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <T v="h2" style={{ fontSize: 22 }}>
                {k === "del" ? "⌫" : k}
              </T>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
