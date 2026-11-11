import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from '@/components/ui/icon';
import { colors, spacing } from '@/theme';
import type { ClockTime } from './party-input';
import { clockText } from './party-input';
import { PickerField } from './picker-field';

const CLOCK_ICON = <Icon sfSymbol="clock" ionicon="time-outline" size={20} color={colors.labelSecondary} />;
const DATE_ICON = <Icon sfSymbol="calendar" ionicon="calendar-outline" size={20} color={colors.labelSecondary} />;

type PickedProps = {
  label: string;
  shown: string;
  icon: ReactNode;
  mode: 'date' | 'time';
  value: Date;
  minimumDate?: Date;
  disabled?: boolean;
  onPick: (date: Date) => void;
};

/**
 * A field that opens the system picker. On iOS the picker opens under the field and stays open while it
 * is turned (each turn reports a value); tapping the field again closes it. On Android it is a dialog
 * that closes itself.
 */
function PickedField({ label, shown, icon, mode, value, minimumDate, disabled = false, onPick }: PickedProps) {
  const [open, setOpen] = useState(false);
  const ios = Platform.OS === 'ios';

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (!ios) setOpen(false);
    if (event.type === 'set' && date) onPick(date);
  };

  return (
    <View style={styles.wrap}>
      <PickerField label={label} value={shown} icon={icon} disabled={disabled} onPress={() => setOpen((o) => !o)} />
      {open && !disabled ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={ios ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
          minimumDate={minimumDate}
          is24Hour
          onChange={onChange}
          themeVariant="dark"
          accentColor={colors.tint}
        />
      ) : null}
    </View>
  );
}

type TimeProps = {
  label: string;
  /** Null shows `placeholder`. */
  value: ClockTime | null;
  /** Where the picker starts when there is no value. Default 22:00. */
  fallback?: ClockTime;
  placeholder?: string;
  disabled?: boolean;
  onChange: (time: ClockTime) => void;
};

/** A time of day, 24-hour ("23:00"). */
export function TimeField({ label, value, fallback = { hours: 22, minutes: 0 }, placeholder = 'Set time', disabled, onChange }: TimeProps) {
  const t = value ?? fallback;
  const date = new Date();
  date.setHours(t.hours, t.minutes, 0, 0);
  return (
    <PickedField
      label={label}
      shown={value ? clockText(value) : placeholder}
      icon={CLOCK_ICON}
      mode="time"
      value={date}
      disabled={disabled}
      onPick={(picked) => onChange({ hours: picked.getHours(), minutes: picked.getMinutes() })}
    />
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

type DateProps = {
  label: string;
  value: Date;
  minimumDate?: Date;
  onChange: (day: Date) => void;
};

/** A calendar day ("Fri 13 Nov 2026"). */
export function DateField({ label, value, minimumDate, onChange }: DateProps) {
  const shown = `${WEEKDAYS[value.getDay()]} ${value.getDate()} ${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
  return (
    <PickedField
      label={label}
      shown={shown}
      icon={DATE_ICON}
      mode="date"
      value={value}
      minimumDate={minimumDate}
      onPick={(picked) => onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()))}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
});
