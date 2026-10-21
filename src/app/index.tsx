import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';

export default function Home() {
  return (
    <Screen>
      <Text>Balances come in step 3.</Text>
      <Button title="Change token" variant="secondary" onPress={() => router.push('/token')} />
    </Screen>
  );
}
