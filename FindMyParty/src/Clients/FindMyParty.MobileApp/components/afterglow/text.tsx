import { Text, type TextProps } from 'react-native';
import { colors, display } from '@/theme';

type Props = TextProps & {
  /** xl 52 · lg 36 · md 28 · sm 22 · xs 17. Default md. */
  size?: keyof typeof display;
  color?: string;
};

/** Coolvetica, for names and big moments only: venue, party, screen title, "You're in." */
export function Display({ size = 'md', color = colors.label, style, ...rest }: Props) {
  return <Text {...rest} style={[display[size], { color }, style]} />;
}
