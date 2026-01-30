import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CategoryCard from "@/components/CategoryCard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CachedFolder, searchCachedItems } from "@/services/database";
import { ROOT_CATEGORIES } from "@/utils/constants";
import { getFolderDisplayName } from "@/utils/formatters";

// Debounce delay in milliseconds
const SEARCH_DEBOUNCE_MS = 300;

export default function BrowseScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CachedFolder[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce timer ref
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef<string>("");

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    // Check if this is still the latest query
    if (query !== latestQueryRef.current) return;

    setIsSearching(true);
    try {
      const results = await searchCachedItems(query);
      // Only update if this is still the latest query
      if (query === latestQueryRef.current) {
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (query === latestQueryRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      latestQueryRef.current = query;

      // Clear any pending search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Debounce the search
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, SEARCH_DEBOUNCE_MS);
    },
    [performSearch],
  );

  const handleResultPress = (item: CachedFolder) => {
    if (item.itemType === "folder") {
      router.push(`/browse/folder/${encodeURIComponent(item.itemPath)}` as any);
    } else {
      router.push(
        `/browse/folder/${encodeURIComponent(item.parentPath)}` as any,
      );
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSettingsPress = () => {
    router.push("/settings" as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 40, backgroundColor: theme.surface },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.text }]}>
            Gurmat Veechar
          </Text>
          <TouchableOpacity
            onPress={handleSettingsPress}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search kathavachaks and raagis..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {isSearching ? "Searching..." : `${searchResults.length} results`}
            </Text>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.resultItem,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() => handleResultPress(item)}
              >
                <View
                  style={[
                    styles.resultIcon,
                    { backgroundColor: theme.primary + "20" },
                  ]}
                >
                  <Ionicons
                    name={
                      item.itemType === "folder" ? "folder" : "musical-note"
                    }
                    size={18}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.resultText}>
                  <Text
                    style={[styles.resultName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.itemName}
                  </Text>
                  <Text
                    style={[styles.resultPath, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {getFolderDisplayName(item.parentPath)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Categories */}
        {searchQuery.length < 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Categories
            </Text>
            {ROOT_CATEGORIES.map((category) => (
              <CategoryCard
                key={category.id}
                title={category.title}
                path={category.path}
                icon={category.icon}
              />
            ))}
          </View>
        )}

        {/* Spacer for NowPlayingBar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  settingsButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginLeft: 16,
    marginBottom: 8,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  resultText: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "500",
  },
  resultPath: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 80,
  },
});
