import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

const SIZE = 248;
const ARM = 40;
const LINE = 4;
const CORNER = 14;

/** Four lime corner brackets that say where to hold the pass. Drawn, not interactive. */
export function ScanReticle() {
  return (
    <View style={styles.frame} pointerEvents="none" accessible={false}>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SIZE,
    height: SIZE,
  },
  corner: {
    position: 'absolute',
    width: ARM,
    height: ARM,
    borderColor: colors.earned,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: LINE,
    borderLeftWidth: LINE,
    borderTopLeftRadius: CORNER,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: LINE,
    borderRightWidth: LINE,
    borderTopRightRadius: CORNER,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: LINE,
    borderLeftWidth: LINE,
    borderBottomLeftRadius: CORNER,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: LINE,
    borderRightWidth: LINE,
    borderBottomRightRadius: CORNER,
  },
});
