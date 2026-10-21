import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export function DetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  label: {
    fontSize: 15,
    color: colors.muted,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  strong: {
    fontWeight: '600',
  },
});
