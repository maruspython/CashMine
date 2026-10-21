import { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { colors } from './theme';

/** Scrollable page, phone width; on a wide screen it stays a centred column. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 16,
    gap: 12,
  },
});
