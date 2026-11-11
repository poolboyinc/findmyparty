import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * Asks the user to pick one of a few labels: the iOS action sheet, an alert elsewhere.
 * Calls `onPick` with the index of the label picked; nothing when cancelled.
 */
export function chooseFrom(title: string, labels: readonly string[], onPick: (index: number) => void) {
  if (labels.length === 0) return;
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, userInterfaceStyle: 'dark' },
      (index) => {
        if (index < labels.length) onPick(index);
      },
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...labels.map((text, index) => ({ text, onPress: () => onPick(index) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
