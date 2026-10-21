import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { createQueryClient } from '@/api/query-client';
import { TokenProvider, useToken } from '@/auth/token-context';
import { ClaimsProvider } from '@/claims/claims-context';

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
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
    <ClaimsProvider key={token ?? ''} token={token}>
      <Stack>
        <Stack.Protected guard={token !== null}>
          <Stack.Screen name="index" options={{ title: 'Payback' }} />
          <Stack.Screen name="claim/[asset]" options={{ title: 'Claim' }} />
          <Stack.Screen name="claims/[key]" options={{ title: 'Claim status' }} />
        </Stack.Protected>
        <Stack.Screen name="token" options={{ title: 'API token' }} />
      </Stack>
    </ClaimsProvider>
  );
}
