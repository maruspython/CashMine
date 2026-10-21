import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { TokenProvider, useToken } from '@/auth/token-context';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <TokenProvider>
        <AppStack />
      </TokenProvider>
    </QueryClientProvider>
  );
}

function AppStack() {
  const { token } = useToken();
  return (
    <Stack>
      <Stack.Protected guard={token !== null}>
        <Stack.Screen name="index" options={{ title: 'Payback' }} />
      </Stack.Protected>
      <Stack.Screen name="token" options={{ title: 'API token' }} />
    </Stack>
  );
}
