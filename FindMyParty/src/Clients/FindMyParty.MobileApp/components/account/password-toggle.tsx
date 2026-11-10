import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '@/theme';
import { PressableScale } from '@/components/afterglow/motion';

type Props = {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

/** The eye at the end of a password field. */
export function PasswordToggle({ visible, onToggle, disabled }: Props) {
  return (
    <PressableScale
      onPress={onToggle}
      disabled={disabled}
      hitSlop={layout.hitSlop}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.labelSecondary} />
    </PressableScale>
  );
}
