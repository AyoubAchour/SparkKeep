import { useEffect, useState } from 'react';
import { View, Text, FlatList, Alert, Pressable, StyleSheet, Modal } from 'react-native';
import { IdeaRecord } from '../src/data/types';
import { listProjectsLocal, db, deleteIdeaLocal, archiveIdeaLocal, enqueueOutbox, getServerIdByLocalId } from '../src/data/localdb';
import { triggerSync } from '../src/data/syncService';
import { router } from 'expo-router';
import { useTheme, fonts } from '../src/ui/theme';
import { IconButton, Badge } from '../src/ui/components';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProjectWithCount extends IdeaRecord {
  ideasCount: number;
}

export default function Projects() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithCount | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const rows = await listProjectsLocal();
      
      // Get ideas count for each project
      const projectsWithCounts: ProjectWithCount[] = await Promise.all(
        rows.map(async (project) => {
          const result = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM ideas WHERE parentProjectLocalId = ? AND archived = 0',
            [project.localId]
          );
          return {
            ...project,
            ideasCount: result?.count ?? 0,
          };
        })
      );
      
      setItems(projectsWithCounts);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load projects');
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
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    if (days < 1) return 'Started today';
    if (days === 1) return 'Started 1 day ago';
    if (days < 7) return `Started ${days} days ago`;
    if (weeks === 1) return 'Started 1 week ago';
    if (weeks < 4) return `Started ${weeks} weeks ago`;
    if (months === 1) return 'Started 1 month ago';
    return `Started ${months} months ago`;
  }

  function getBadgeColor(count: number): string {
    // Alternate colors based on count for visual variety
    const colors = [theme.colors.yellow, theme.colors.pink, theme.colors.cyan];
    return colors[count % colors.length];
  }

  async function deleteProject(project: ProjectWithCount) {
    setShowMenu(false);
    setSelectedProject(null);
    
    Alert.alert(
      'Delete Project?',
      `This will permanently delete "${project.content}" and all ${project.ideasCount} associated ideas.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const serverId = project.serverId ?? await getServerIdByLocalId(project.localId);
            await deleteIdeaLocal(project.localId);
            await enqueueOutbox('deleteIdea', { localId: project.localId, serverId });
            triggerSync();
            load();
          },
        },
      ]
    );
  }

  async function archiveProject(project: ProjectWithCount) {
    setShowMenu(false);
    setSelectedProject(null);
    const serverId = project.serverId ?? await getServerIdByLocalId(project.localId);
    await archiveIdeaLocal(project.localId);
    await enqueueOutbox('archiveIdea', { localId: project.localId, serverId });
    triggerSync();
    load();
  }

  const activeProjects = items.filter(i => i.status !== 'DONE' && !i.archived);
  const doneProjects = items.filter(i => i.status === 'DONE' && !i.archived);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.yellow, borderColor: theme.colors.black, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <IconButton
            onPress={() => router.back()}
            color={theme.colors.white}
          >
            <Feather name="arrow-left" size={24} color={theme.colors.black} />
          </IconButton>
          <Text style={[styles.headerTitle, { color: theme.colors.black }]}>Projects</Text>
          <IconButton
            onPress={() => router.push('/')}
            color={theme.colors.pink}
          >
            <Feather name="plus" size={24} color={theme.colors.black} />
          </IconButton>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <Pressable 
            style={({ pressed }) => [
              styles.statCard,
              {
                backgroundColor: theme.colors.yellow,
                borderColor: theme.colors.black,
                transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
                borderTopWidth: pressed ? 2 : 3,
                borderLeftWidth: pressed ? 2 : 3,
                borderBottomWidth: pressed ? 5 : 8,
                borderRightWidth: pressed ? 5 : 8,
              }
            ]}
          >
            <Text style={[styles.statNumber, { color: theme.colors.black }]}>{activeProjects.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.black }]}>Active</Text>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [
              styles.statCard,
              {
                backgroundColor: theme.colors.cyan,
                borderColor: theme.colors.black,
                transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
                borderTopWidth: pressed ? 2 : 3,
                borderLeftWidth: pressed ? 2 : 3,
                borderBottomWidth: pressed ? 5 : 8,
                borderRightWidth: pressed ? 5 : 8,
              }
            ]}
          >
            <Text style={[styles.statNumber, { color: theme.colors.black }]}>{doneProjects.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.black }]}>Done</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.black }]}>Active Projects</Text>

        <FlatList
          data={activeProjects}
          keyExtractor={(i) => i.localId}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/projects/${item.localId}`)}
              onLongPress={() => {
                setSelectedProject(item);
                setShowMenu(true);
              }}
              style={({ pressed }) => [
                styles.projectCard,
                {
                  borderColor: theme.colors.black,
                  backgroundColor: theme.colors.white,
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
                  PROJECT
                </Badge>
                <Badge color={getBadgeColor(item.ideasCount)}>
                  {item.ideasCount} {item.ideasCount === 1 ? 'IDEA' : 'IDEAS'}
                </Badge>
              </View>
              <Text style={[styles.projectTitle, { color: theme.colors.black }]}>
                {item.content}
              </Text>
              <Text style={[styles.projectTimestamp, { color: theme.colors.textSecondary }]}>
                {getTimestamp(item.createdAt)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.yellow, borderColor: theme.colors.black }]}>
                <Feather name="folder" size={48} color={theme.colors.black} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.black }]}>No Active Projects</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Tap the + button to create{'\n'}your first project!
              </Text>
            </View>
          }
        />
      </View>

      {/* Project Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowMenu(false);
            setSelectedProject(null);
          }}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.colors.white, borderColor: theme.colors.black }]}>
            <Text style={[styles.menuTitle, { color: theme.colors.black }]}>
              {selectedProject?.content}
            </Text>
            
            <Pressable
              onPress={() => selectedProject && archiveProject(selectedProject)}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.colors.cyan,
                  borderColor: theme.colors.black,
                  transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
                  borderTopWidth: pressed ? 2 : 3,
                  borderLeftWidth: pressed ? 2 : 3,
                  borderBottomWidth: pressed ? 4 : 8,
                  borderRightWidth: pressed ? 4 : 8,
                }
              ]}
            >
              <Feather name="archive" size={20} color={theme.colors.black} />
              <Text style={[styles.menuButtonText, { color: theme.colors.black }]}>Archive Project</Text>
            </Pressable>

            <Pressable
              onPress={() => selectedProject && deleteProject(selectedProject)}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: '#F44336',
                  borderColor: theme.colors.black,
                  transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
                  borderTopWidth: pressed ? 2 : 3,
                  borderLeftWidth: pressed ? 2 : 3,
                  borderBottomWidth: pressed ? 4 : 8,
                  borderRightWidth: pressed ? 4 : 8,
                }
              ]}
            >
              <Feather name="trash-2" size={20} color={theme.colors.white} />
              <Text style={[styles.menuButtonText, { color: theme.colors.white }]}>Delete Project</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowMenu(false);
                setSelectedProject(null);
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.colors.white,
                  borderColor: theme.colors.black,
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
            >
              <Text style={[styles.menuButtonText, { color: theme.colors.black }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
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
    justifyContent: 'space-between',
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 24,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
  statLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  projectCard: {
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
  projectTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 24,
  },
  projectTimestamp: {
    fontSize: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuContainer: {
    borderRadius: 16,
    borderWidth: 4,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 3,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
