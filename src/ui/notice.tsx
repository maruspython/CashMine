import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

type Tone = 'error' | 'warning' | 'success' | 'info';

const toneColors: Record<Tone, { text: string; background: string }> = {
  error: { text: colors.danger, background: colors.dangerSurface },
  warning: { text: colors.warning, background: colors.warningSurface },
  success: { text: colors.success, background: colors.successSurface },
  info: { text: colors.info, background: colors.infoSurface },
};

export function Notice({ tone, title, children }: { tone: Tone; title?: string; children?: ReactNode }) {
  const { text, background } = toneColors[tone];
  return (
    <View style={[styles.box, { backgroundColor: background }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      {title && <Text style={[styles.title, { color: text }]}>{title}</Text>}
      {children && <Text style={[styles.body, { color: text }]}>{children}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
  },
});
