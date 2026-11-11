import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * One choice from a short list: the iOS action sheet, an alert with buttons elsewhere.
 * `onSelect` gets the index into `options`; cancelling calls nothing.
 */
export function chooseOption(title: string | undefined, options: readonly string[], onSelect: (index: number) => void): void {
  Haptics.selectionAsync();
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options, 'Cancel'], cancelButtonIndex: options.length, userInterfaceStyle: 'dark' },
      (index) => {
        if (index < options.length) onSelect(index);
      },
    );
    return;
  }
  Alert.alert(title ?? 'Choose', undefined, [
    ...options.map((text, index) => ({ text, onPress: () => onSelect(index) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
