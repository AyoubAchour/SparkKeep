import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Alert, StyleSheet, Pressable } from 'react-native';
import 'react-native-gesture-handler';
import { Swipeable } from 'react-native-gesture-handler';
import { IdeaRecord } from '../src/data/types';
import { listAllIdeas, deleteIdeaLocal, enqueueOutbox, getServerIdByLocalId } from '../src/data/localdb';
import { triggerSync } from '../src/data/syncService';
import { useTheme, fonts } from '../src/ui/theme';
import { IconButton, Badge } from '../src/ui/components';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterType = 'All' | 'Projects' | 'Features';

export default function AllSparks() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('All');

  async function load() {
    setLoading(true);
    try {
      const rows = await listAllIdeas();
      setItems(rows);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load sparks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function getTimestamp(createdAt: number): string {
    const now = Date.now();
    const ts = Number(createdAt) || now;
    const diff = now - ts;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks ago`;
  }

  function getStatusBadge(status: string, serverId: string | null | undefined) {
    if (!serverId) {
      return { color: theme.colors.pink, text: 'NEW' };
    }
    
    switch (status) {
      case 'INBOX':
        return { color: theme.colors.cyan, text: 'INBOX' };
      case 'BACKLOG':
        return { color: theme.colors.yellow, text: 'TODO' };
      case 'IN_PROGRESS':
        return { color: '#FF8C42', text: 'DOING' };
      case 'DONE':
        return { color: theme.colors.cyan, text: 'DONE' };
      default:
        return { color: theme.colors.muted, text: status };
    }
  }

  const filteredItems = items.filter(item => {
    if (filter === 'All') return true;
    if (filter === 'Projects') return item.type === 'PROJECT';
    if (filter === 'Features') return item.type === 'FEATURE';
    return false;
  });

  const allCount = items.length;
  const projectsCount = items.filter(i => i.type === 'PROJECT').length;
  const featuresCount = items.filter(i => i.type === 'FEATURE').length;

  function handleCardPress(item: IdeaRecord) {
    if (item.type === 'PROJECT') {
      router.push(`/projects/${item.localId}`);
    } else if (item.type === 'FEATURE' && item.parentProjectLocalId) {
      router.push(`/projects/${item.parentProjectLocalId}`);
    }
  }

  async function deleteItem(item: IdeaRecord) {
    const serverId = item.serverId ?? await getServerIdByLocalId(item.localId);
    await deleteIdeaLocal(item.localId);
    await enqueueOutbox('deleteIdea', { localId: item.localId, serverId });
    triggerSync();
    load();
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.cyan, borderColor: theme.colors.black, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <IconButton
            onPress={() => router.back()}
            color={theme.colors.white}
          >
            <Feather name="arrow-left" size={24} color={theme.colors.black} />
          </IconButton>
          <Text style={[styles.headerTitle, { color: theme.colors.black }]}>All Sparks</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.filterRow}>
          <FilterPill
            label={`All (${allCount})`}
            selected={filter === 'All'}
            onPress={() => setFilter('All')}
          />
          <FilterPill
            label={`Projects (${projectsCount})`}
            selected={filter === 'Projects'}
            onPress={() => setFilter('Projects')}
          />
          <FilterPill
            label={`Features (${featuresCount})`}
            selected={filter === 'Features'}
            onPress={() => setFilter('Features')}
          />
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.localId}
          renderItem={({ item }) => (
            <SwipeableSparkItem
              item={item}
              onDelete={() => deleteItem(item)}
              onPress={() => handleCardPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.cyan, borderColor: theme.colors.black }]}>
                <Feather name="zap" size={48} color={theme.colors.black} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.black }]}>No Sparks Yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Start capturing your ideas{'\n'}on the home screen!
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterPill,
        {
          backgroundColor: selected ? theme.colors.black : theme.colors.white,
          borderColor: theme.colors.black,
          transform: pressed ? [{ scale: 0.97 }] : [],
        }
      ]}
    >
      <Text style={[styles.filterText, { color: selected ? theme.colors.white : theme.colors.black }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SwipeableSparkItem({ 
  item, 
  onDelete, 
  onPress 
}: { 
  item: IdeaRecord; 
  onDelete: () => void; 
  onPress: () => void;
}) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  function getStatusBadge(status: string, serverId: string | null | undefined) {
    if (!serverId) {
      return { color: theme.colors.pink, text: 'NEW' };
    }
    switch (status) {
      case 'INBOX':
        return { color: theme.colors.cyan, text: 'INBOX' };
      case 'BACKLOG':
        return { color: theme.colors.yellow, text: 'TODO' };
      case 'IN_PROGRESS':
        return { color: theme.colors.pink, text: 'DOING' };
      case 'DONE':
        return { color: '#4CAF50', text: 'DONE' };
      default:
        return { color: theme.colors.muted, text: status };
    }
  }

  function getTimestamp(createdAt: number): string {
    const now = Date.now();
    const ts = Number(createdAt) || now;
    const diff = now - ts;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks ago`;
  }

  const handleDelete = () => {
    swipeableRef.current?.close();
    setTimeout(() => onDelete(), 200);
  };

  const statusBadge = getStatusBadge(item.status, item.serverId);

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.swipeActionContainer}>
          <Pressable 
            onPress={handleDelete}
            style={[styles.swipeAction, { backgroundColor: '#F44336', borderColor: theme.colors.black }]}
          >
            <Feather name="trash-2" size={24} color="#ffffff" />
            <Text style={styles.swipeText}>Delete</Text>
          </Pressable>
        </View>
      )}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: theme.colors.black,
            backgroundColor: '#E6E6FA',
            transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
            borderTopWidth: pressed ? 2 : 3,
            borderLeftWidth: pressed ? 2 : 3,
            borderBottomWidth: pressed ? 5 : 8,
            borderRightWidth: pressed ? 5 : 8,
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <Badge color={theme.colors.white} textColor={theme.colors.black}>
            {item.type}
          </Badge>
          <Badge color={statusBadge.color}>
            {statusBadge.text}
          </Badge>
        </View>
        <Text style={[styles.cardContent, { color: theme.colors.black }]}>
          {item.content}
        </Text>
        <Text style={[styles.cardTimestamp, { color: theme.colors.textSecondary }]}>
          {getTimestamp(item.createdAt)}
        </Text>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 3,
  },
  filterText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  cardTimestamp: {
    fontSize: 12,
  },
  swipeActionContainer: {
    justifyContent: 'center',
    marginBottom: 12,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 4,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderRadius: 12,
    marginRight: 12,
  },
  swipeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
