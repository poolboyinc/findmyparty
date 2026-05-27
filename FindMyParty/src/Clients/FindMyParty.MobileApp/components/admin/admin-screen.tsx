import { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthHeader } from '@/components/ui/auth-header';
import { colors, layout, spacing } from '@/theme';

type Props = {
  /** When provided, an `AuthHeader` is rendered with this title. Omit on screens
   *  that supply their own header chrome. */
  title?: string;
  /** Show the circular glass back button in the header. Tab-root screens pass
   *  `false`; pushed screens leave the default `true`. Only meaningful when
   *  `title` is set. */
  showBack?: boolean;
  /** Override the header's default `router.back()` behavior. */
  onBack?: () => void;
  /** Disables the header back button (e.g. during async submission). */
  headerDisabled?: boolean;
  /** When false, children render in a plain `View` (the screen manages its own
   *  list/scroll). Defaults to true. */
  scroll?: boolean;
  /** Pull-to-refresh control forwarded to the `ScrollView` (scroll mode only). */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Extra style merged into the scroll content container / non-scroll body. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Wrap content in a `KeyboardAvoidingView`. Defaults to true. */
  keyboardAvoiding?: boolean;
  children: ReactNode;
};

/**
 * Standard host-portal screen scaffold. Near-black `colors.bg` root (no gradient
 * wallpaper), an optional `AuthHeader`, keyboard avoidance, and a scroll body
 * whose bottom padding clears the floating tab bar. Mirrors the consumer auth
 * scaffold's quality but stays neutral so individual screens own their content.
 *
 * Usage:
 *   // Tab-root screen — header without a back button:
 *   <AdminScreen title="Home" showBack={false}>…</AdminScreen>
 *
 *   // Pushed screen with pull-to-refresh:
 *   <AdminScreen title="My Parties" refreshControl={<RefreshControl … />}>…</AdminScreen>
 *
 *   // Screen managing its own FlatList:
 *   <AdminScreen title="Bookings" scroll={false}><MyList /></AdminScreen>
 */
export function AdminScreen({
  title,
  showBack = true,
  onBack,
  headerDisabled = false,
  scroll = true,
  refreshControl,
  contentContainerStyle,
  keyboardAvoiding = true,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  // Content must clear the floating glass tab bar + home indicator.
  const bottomClearance =
    layout.floatingTabBarHeight +
    insets.bottom +
    layout.floatingTabBarBottomOffset +
    spacing.base;

  const header = title ? (
    <AuthHeader
      title={title}
      showBack={showBack}
      onBack={onBack}
      disabled={headerDisabled}
    />
  ) : null;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomClearance },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.plainBody, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {header}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.lg,
  },
  plainBody: {
    flex: 1,
  },
});
