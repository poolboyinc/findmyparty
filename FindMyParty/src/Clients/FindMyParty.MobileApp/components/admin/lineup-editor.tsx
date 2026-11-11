import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PressableScale, useReducedMotion } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { PERFORMER_TYPES } from '@/constants/parties';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';
import { FormField } from './form-field';
import { chooseOption } from './option-sheet';
import { MAX_ACTS, type ActDraft, type ClockTime } from './party-input';
import { PickerField } from './picker-field';
import { TimeField } from './time-field';

const NO_ROLE = 'No role';

type Props = {
  acts: ActDraft[];
  /** The party's start on the clock: the first act's set time starts there. */
  partyStart: ClockTime;
  error?: string;
  onChange: (acts: ActDraft[]) => void;
  newKey: () => string;
};

function anHourAfter(t: ClockTime): ClockTime {
  return { hours: (t.hours + 1) % 24, minutes: t.minutes };
}

/** The line-up: up to eight acts, each with a name, a role and a set time. Rows glide when one goes. */
export function LineupEditor({ acts, partyStart, error, onChange, newKey }: Props) {
  const reduceMotion = useReducedMotion();
  const layoutAnimation = reduceMotion ? undefined : LinearTransition.springify();

  const update = (key: string, change: Partial<ActDraft>) =>
    onChange(acts.map((act) => (act.key === key ? { ...act, ...change } : act)));

  const add = () => {
    if (acts.length >= MAX_ACTS) return;
    Haptics.selectionAsync();
    const last = acts[acts.length - 1];
    onChange([...acts, { key: newKey(), name: '', role: null, time: last ? anHourAfter(last.time) : partyStart }]);
  };

  const remove = (key: string) => {
    Haptics.selectionAsync();
    onChange(acts.filter((act) => act.key !== key));
  };

  const pickRole = (act: ActDraft) =>
    chooseOption('Role', [...PERFORMER_TYPES, NO_ROLE], (index) =>
      update(act.key, { role: index < PERFORMER_TYPES.length ? PERFORMER_TYPES[index] : null }),
    );

  return (
    <View style={styles.wrap}>
      {acts.length === 0 ? <Text style={styles.hint}>Add the acts in the order they play. The first one leads the poster.</Text> : null}

      {acts.map((act, index) => (
        <Animated.View key={act.key} layout={layoutAnimation} style={styles.act}>
          <View style={styles.actTop}>
            <Text style={styles.actNumber}>Act {index + 1}</Text>
            <PressableScale
              onPress={() => remove(act.key)}
              hitSlop={layout.hitSlop}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Remove act ${index + 1}${act.name ? `, ${act.name}` : ''}`}
            >
              <Icon sfSymbol="xmark" ionicon="close" size={14} color={colors.labelSecondary} />
            </PressableScale>
          </View>
          <FormField
            label="Name"
            placeholder="e.g. Lena K"
            value={act.name}
            onChangeText={(name) => update(act.key, { name })}
            maxLength={80}
            autoCapitalize="words"
          />
          <View style={styles.pair}>
            <View style={styles.half}>
              <PickerField label="Role" value={act.role ?? NO_ROLE} onPress={() => pickRole(act)} />
            </View>
            <View style={styles.half}>
              <TimeField label="Set time" value={act.time} onChange={(time) => update(act.key, { time })} />
            </View>
          </View>
        </Animated.View>
      ))}

      {error ? (
        <Animated.Text entering={FadeIn.duration(200)} style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Animated.Text>
      ) : null}

      {acts.length < MAX_ACTS ? (
        <PressableScale onPress={add} haptic={false} style={styles.add} accessibilityRole="button" accessibilityLabel="Add an act">
          <Icon sfSymbol="plus" ionicon="add" size={16} color={colors.label} />
          <Text style={styles.addLabel}>Add an act</Text>
        </PressableScale>
      ) : (
        <Text style={styles.hint}>A line-up has up to eight acts.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  hint: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  // The fields are already solid surfaces, so an act is a group on the screen's own background.
  act: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  actTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actNumber: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.label,
  },
  remove: {
    width: 32,
    height: 32,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  error: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
  },
  addLabel: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
});
