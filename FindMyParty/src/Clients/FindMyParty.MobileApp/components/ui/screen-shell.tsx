import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';
import { AmbientBackdrop } from './ambient-backdrop';

type Props = {
  children: React.ReactNode;
  /** Mount the drifting orb backdrop. Pass false for screens with their own visuals (map). */
  backdrop?: boolean;
  /** Backdrop intensity. */
  backdropVariant?: 'subtle' | 'default' | 'intense';
  /** Wrap children in a ScrollView with tab-bar-aware bottom padding. */
  scroll?: boolean;
  /** Account for the floating tab bar (~vs(110)). Set false on screens without tabs. */
  withTabBar?: boolean;
  /** Extra top padding above safe area. */
  topInset?: number;
  /** Horizontal content padding. */
  paddingHorizontal?: number;
};

const TAB_BAR_CLEARANCE = 112;

export function ScreenShell({
  children,
  backdrop = true,
  backdropVariant = 'default',
  scroll = false,
  withTabBar = true,
  topInset = 0,
  paddingHorizontal,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = withTabBar ? TAB_BAR_CLEARANCE + 16 : insets.bottom + 16;

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: topInset,
        paddingBottom: bottom,
        paddingHorizontal,
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <YStack
      flex={1}
      paddingTop={topInset}
      paddingBottom={bottom}
      paddingHorizontal={paddingHorizontal}
    >
      {children}
    </YStack>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {backdrop && <AmbientBackdrop variant={backdropVariant} />}
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05020A' },
  flex: { flex: 1 },
});
