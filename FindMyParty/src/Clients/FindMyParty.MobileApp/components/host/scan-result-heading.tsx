import { StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, spacing, typography } from '@/theme';

const MARK = 56;

type Props = {
  /** Fill of the round mark, and the title's colour unless `titleColor` is given. */
  tone: string;
  iconColor?: string;
  titleColor?: string;
  sfSymbol: SymbolViewProps['name'];
  ionicon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** The big "2 in" after an entry. */
  large?: boolean;
  /** Plain lines under the title. Nulls are skipped. */
  lines: (string | null)[];
};

/** The top of a scan result: a round mark (check, cross), the verdict, and a line or two beneath. */
export function ScanResultHeading({ tone, iconColor = colors.ink, titleColor = tone, sfSymbol, ionicon, title, large = false, lines }: Props) {
  return (
    <View style={styles.heading}>
      <View style={[styles.mark, { backgroundColor: tone }]}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={26} color={iconColor} />
      </View>
      <View style={styles.text}>
        <Display size={large ? 'lg' : 'sm'} color={titleColor} style={styles.figures} accessibilityRole="header">
          {title}
        </Display>
        {lines.map((line) =>
          line ? (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  line: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
});
