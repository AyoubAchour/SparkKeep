import { Stack } from 'expo-router';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useMemo } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useFonts, SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { initDb } from '../src/data/localdb';
import { useSyncService } from '../src/data/syncService';
import { ThemeProvider } from '../src/ui/theme';


const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // ✅ Hooks must be called unconditionally before any returns
  const convex = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl]
  );

  useEffect(() => {
    initDb();
  }, []);

  // Show loading screen while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFED00' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!convexUrl || !convex) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, textAlign: 'center' }}>
          Set EXPO_PUBLIC_CONVEX_URL in a .env file to connect to Convex.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ConvexProvider client={convex}>
          <OutboxSyncBridge />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="inbox" options={{ headerShown: false }} />
            <Stack.Screen name="sparks" options={{ headerShown: false }} />
            <Stack.Screen name="projects" options={{ headerShown: false }} />
            <Stack.Screen name="projects/[localId]" options={{ headerShown: false }} />
          </Stack>
        </ConvexProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function OutboxSyncBridge() {
  useSyncService();
  return null;
}
