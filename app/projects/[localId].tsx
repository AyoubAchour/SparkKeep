import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, FlatList, Alert, TextInput, Pressable, Modal, StyleSheet, Animated, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import 'react-native-gesture-handler';
import { Swipeable } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { IdeaRecord, IdeaStatus } from '../../src/data/types';
import { listFeaturesByProjectLocal, insertIdeaLocal, enqueueOutbox, updateIdeaLocalStatus, deleteIdeaLocal, db, getServerIdByLocalId } from '../../src/data/localdb';
import { triggerSync } from '../../src/data/syncService';
import { useTheme, fonts } from '../../src/ui/theme';
import { IconButton, Badge, PrimaryButton } from '../../src/ui/components';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProjectDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const [project, setProject] = useState<IdeaRecord | null>(null);
  const [items, setItems] = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const [modalVisible, setModalVisible] = useState(false);

  function openModal() {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function closeModal() {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setContent('');
    });
  }

  const projectLocalId = useMemo(() => String(localId ?? ''), [localId]);

  async function load() {
    if (!projectLocalId) return;
    setLoading(true);
    try {
      // Get project details
      const projectRow = await db.getFirstAsync<IdeaRecord>(
        'SELECT * FROM ideas WHERE localId = ?',
        [projectLocalId]
      );
      setProject(projectRow ?? null);

      // Get features
      const rows = await listFeaturesByProjectLocal(projectLocalId);
      setItems(rows);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projectLocalId]);

  async function addFeature() {
    const text = content.trim();
    if (!text) return;
    try {
      const local = await insertIdeaLocal({ 
        content: text, 
        type: 'FEATURE', 
        parentProjectLocalId: projectLocalId, 
        status: 'BACKLOG' 
      });
      await enqueueOutbox('createFeature', { 
        localId: local.localId, 
        content: text, 
        status: 'BACKLOG', 
        parentProjectLocalId: projectLocalId 
      });
      triggerSync();
      setContent('');
      closeModal();
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add feature');
    }
  }

  async function markDone(item: IdeaRecord) {
    const serverId = item.serverId ?? await getServerIdByLocalId(item.localId);
    await updateIdeaLocalStatus(item.localId, 'DONE');
    await enqueueOutbox('updateStatus', { localId: item.localId, serverId, status: 'DONE' });
    triggerSync();
    load();
  }

  async function deleteItem(item: IdeaRecord) {
    const serverId = item.serverId ?? await getServerIdByLocalId(item.localId);
    await deleteIdeaLocal(item.localId);
    await enqueueOutbox('deleteIdea', { localId: item.localId, serverId });
    triggerSync();
    load();
  }

  function getTimestamp(createdAt: number): string {
    const now = Date.now();
    const ts = Number(createdAt) || now;
    const diff = now - ts;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days === 2) return '2 days ago';
    if (days < 7) return `${days} days ago`;
    if (weeks === 1) return '1 week ago';
    if (weeks === 2) return '2 weeks ago';
    if (weeks < 4) return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    return `${months} months ago`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { backgroundColor: '#F5E6D3', borderColor: theme.colors.black, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <IconButton
            onPress={() => router.back()}
            color={theme.colors.yellow}
          >
            <Feather name="arrow-left" size={24} color={theme.colors.black} />
          </IconButton>
          <Text style={[styles.headerTitle, { color: theme.colors.black }]} numberOfLines={1}>
            {project?.content || 'Project'}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <Pressable
          onPress={openModal}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: theme.colors.pink,
              borderColor: theme.colors.black,
              transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
              borderTopWidth: pressed ? 2 : 3,
              borderLeftWidth: pressed ? 2 : 3,
              borderBottomWidth: pressed ? 4 : 8,
              borderRightWidth: pressed ? 4 : 8,
            }
          ]}
        >
          <Feather name="plus" size={20} color={theme.colors.white} />
          <Text style={[styles.addButtonText, { color: theme.colors.white }]}>Add Feature</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.colors.black }]}>Features</Text>

        <FlatList
          data={items}
          keyExtractor={(i) => i.localId}
          renderItem={({ item }) => (
            <SwipeableFeatureItem
              item={item}
              onDelete={() => deleteItem(item)}
              onDone={() => markDone(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.pink, borderColor: theme.colors.black }]}>
                <Feather name="zap" size={48} color={theme.colors.black} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.black }]}>No Features Yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Tap the + Add Feature button{'\n'}to create your first feature!
              </Text>
            </View>
          }
        />
      </View>

      {/* Add Feature Modal */}
      <Modal visible={modalVisible} transparent statusBarTranslucent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {/* Blurred Backdrop - Fades independently */}
          <Animated.View style={[styles.backdropContainer, { opacity: fadeAnim }]}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          </Animated.View>

          {/* Modal Content - Slides from bottom */}
          <Animated.View 
            style={[
              styles.modalContent, 
              { 
                backgroundColor: theme.colors.white, 
                borderColor: theme.colors.black,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.black }]}>Add Feature</Text>
              <Pressable onPress={closeModal}>
                <Feather name="x" size={24} color={theme.colors.black} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Feature description..."
              placeholderTextColor={theme.colors.muted}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={4}
              style={[
                styles.modalInput,
                {
                  borderColor: theme.colors.black,
                  color: theme.colors.black,
                  backgroundColor: theme.colors.bg,
                }
              ]}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.white,
                    borderColor: theme.colors.black,
                    opacity: pressed ? 0.7 : 1,
                  }
                ]}
              >
                <Text style={{ color: theme.colors.black, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addFeature}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.pink,
                    borderColor: theme.colors.black,
                    transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
                    borderTopWidth: pressed ? 2 : 3,
                    borderLeftWidth: pressed ? 2 : 3,
                    borderBottomWidth: pressed ? 4 : 8,
                    borderRightWidth: pressed ? 4 : 8,
                  }
                ]}
              >
                <Text style={{ color: theme.colors.white, fontWeight: '700' }}>Add</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SwipeableFeatureItem({ 
  item, 
  onDelete, 
  onDone 
}: { 
  item: IdeaRecord; 
  onDelete: () => void; 
  onDone: () => void;
}) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  function getStatusBadge(status: string) {
    switch (status) {
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
    const weeks = Math.floor(days / 7);
    
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days === 2) return '2 days ago';
    if (days < 7) return `${days} days ago`;
    if (weeks === 1) return '1 week ago';
    if (weeks === 2) return '2 weeks ago';
    if (weeks < 4) return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    return `${months} months ago`;
  }

  const handleDelete = () => {
    swipeableRef.current?.close();
    setTimeout(() => onDelete(), 200);
  };

  const handleDone = () => {
    swipeableRef.current?.close();
    setTimeout(() => onDone(), 200);
  };

  const statusBadge = getStatusBadge(item.status);

  return (
    <Swipeable
      ref={swipeableRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View style={styles.swipeActionContainer}>
          <Pressable 
            onPress={handleDone}
            style={[styles.swipeActionLeft, { backgroundColor: '#4CAF50', borderColor: theme.colors.black }]}
          >
            <Feather name="check" size={24} color="#ffffff" />
            <Text style={styles.swipeText}>Done</Text>
          </Pressable>
        </View>
      )}
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
        style={({ pressed }) => [
          styles.featureCard,
          {
            backgroundColor: '#E6E6FA',
            borderColor: theme.colors.black,
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
            FEATURE
          </Badge>
          <Badge color={statusBadge.color}>
            {statusBadge.text}
          </Badge>
        </View>
        <Text style={[styles.featureTitle, { color: theme.colors.black }]}>
          {item.content}
        </Text>
        <Text style={[styles.featureTimestamp, { color: theme.colors.textSecondary }]}>
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
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  addButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  featureCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  featureTimestamp: {
    fontSize: 12,
  },
  swipeActionContainer: {
    justifyContent: 'center',
    marginBottom: 12,
  },
  swipeActionLeft: {
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
    marginLeft: 12,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 3,
    borderRadius: 12,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 3,
  },
});
