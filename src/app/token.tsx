import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { getBalances } from '@/api/endpoints';
import { useToken } from '@/auth/token-context';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { colors, inputFontSize } from '@/ui/theme';

export default function TokenScreen() {
  const { token, notice, setToken } = useToken();
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const candidate = input.trim();
    if (!candidate) {
      setError('Paste your API token');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await getBalances(candidate); // check the token before keeping it
      setToken(candidate);
      router.replace('/');
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'UNAUTHORIZED'
          ? 'This token is invalid or expired.'
          : `Could not check the token: ${errorMessage(e)}`,
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <Text style={styles.text}>Paste the API token from your task email. It is kept only in this browser.</Text>
      {token && <Text style={styles.muted}>Current token ends in …{token.slice(-4)}</Text>}
      <TextInput
        value={input}
        onChangeText={setInput}
        onSubmitEditing={save}
        placeholder="API token"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        editable={!checking}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={token ? 'Change token' : 'Save token'} onPress={save} loading={checking} />
      {token && <Button title="Cancel" variant="secondary" onPress={() => router.replace('/')} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
  },
  notice: {
    fontSize: 15,
    color: colors.danger,
    backgroundColor: colors.dangerSurface,
    padding: 12,
    borderRadius: 12,
  },
  input: {
    fontSize: inputFontSize,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
});
