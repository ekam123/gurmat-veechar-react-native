import { Stack } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppTheme } from '@/hooks/useAppTheme';

function BackButton() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <BlurView
        intensity={80}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.backButtonBlur}
      >
        <Ionicons name="chevron-back" size={22} color={colorScheme === 'dark' ? '#fff' : '#000'} />
      </BlurView>
    </TouchableOpacity>
  );
}

export default function BrowseLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="folder/[path]"
        options={{
          headerShown: true,
          title: 'Browse',
          headerBackTitle: '',
          headerBackVisible: false,
          headerLeft: () => <BackButton />,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: 8,
  },
  backButtonBlur: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
  },
});
