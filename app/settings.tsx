import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { ThemeName, themes } from '@/utils/constants';
import { getTotalDownloadsSize, deleteAllDownloads } from '@/services/downloadManager';
import { formatFileSize } from '@/utils/formatters';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

const THEME_OPTIONS: { key: ThemeName; label: string; primaryColor: string }[] = [
  { key: 'default', label: 'Blue', primaryColor: '#3366CC' },
  { key: 'purple', label: 'Purple', primaryColor: '#6B5B95' },
  { key: 'navy', label: 'Navy', primaryColor: '#1A365D' },
  { key: 'forest', label: 'Forest', primaryColor: '#2D5016' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { themeName, setThemeName, autoplay, setAutoplay } = useSettingsStore();
  const [downloadSize, setDownloadSize] = useState(0);

  useEffect(() => {
    loadDownloadSize();
  }, []);

  const loadDownloadSize = async () => {
    const size = await getTotalDownloadsSize();
    setDownloadSize(size);
  };

  const handleClearDownloads = () => {
    if (downloadSize === 0) {
      Alert.alert('No Downloads', 'There are no downloaded tracks to clear.');
      return;
    }

    Alert.alert(
      'Clear All Downloads',
      `This will delete ${formatFileSize(downloadSize)} of downloaded tracks. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllDownloads();
            setDownloadSize(0);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      {/* Theme Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Theme</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {THEME_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.themeOption,
                index < THEME_OPTIONS.length - 1 && [styles.borderBottom, { borderBottomColor: theme.border }],
              ]}
              onPress={() => setThemeName(option.key)}
            >
              <View style={styles.themeInfo}>
                <View style={[styles.colorDot, { backgroundColor: option.primaryColor }]} />
                <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
              </View>
              {themeName === option.key && (
                <Ionicons name="checkmark" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Playback Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Playback</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.switchOption}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionLabel, { color: theme.text }]}>Autoplay</Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Automatically play next track
              </Text>
            </View>
            <Switch
              value={autoplay}
              onValueChange={setAutoplay}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={autoplay ? theme.primary : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* Storage Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Storage</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.storageInfo}>
            <View>
              <Text style={[styles.optionLabel, { color: theme.text }]}>Downloads</Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                {formatFileSize(downloadSize)} used
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: theme.background }]}
              onPress={handleClearDownloads}
            >
              <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.clearButtonText, { color: theme.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.aboutItem}>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Gurmat Veechar</Text>
            <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
              Version 1.0.0
            </Text>
          </View>
          <View style={[styles.borderTop, { borderTopColor: theme.border }]}>
            <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
              Audio content from gurmatveechar.com
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  borderTop: {
    borderTopWidth: 1,
    padding: 14,
  },
  switchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearButtonText: {
    fontSize: 13,
    marginLeft: 4,
  },
  aboutItem: {
    padding: 14,
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
