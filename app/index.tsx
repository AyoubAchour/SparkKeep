import { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, Alert, ScrollView, StyleSheet, Pressable } from 'react-native';
import 'react-native-gesture-handler';
import { Swipeable } from 'react-native-gesture-handler';
import { insertIdeaLocal, enqueueOutbox, listRecentIdeas, deleteIdeaLocal, getServerIdByLocalId } from '../src/data/localdb';
import { triggerSync } from '../src/data/syncService';
import { IdeaType, IdeaRecord } from '../src/data/types';
import { router } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useTheme, fonts } from '../src/ui/theme';
import { PrimaryButton, IconButton, NavButton, SegmentedControl, SparkCard } from '../src/ui/components';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<IdeaType>('PROJECT');
  const [recentSparks, setRecentSparks] = useState<IdeaRecord[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    loadRecentSparks();
  }, []);

  async function loadRecentSparks() {
    try {
      const sparks = await listRecentIdeas(3);
      setRecentSparks(sparks);
    } catch (e: any) {
      console.error('Failed to load recent sparks:', e);
    }
  }

  const onSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    
    try {
      const local = await insertIdeaLocal({ 
        content: trimmed, 
        type: mode
      });
      
      if (mode === 'PROJECT') {
        await enqueueOutbox('createProject', { localId: local.localId, content: trimmed });
      } else {
        await enqueueOutbox('createFeature', { 
          localId: local.localId, 
          content: trimmed, 
          status: 'INBOX'
        });
      }
      triggerSync();
      setContent('');
      setIsSaved(true);
      
      // Return to normal state after 1.5s
      setTimeout(() => {
        setIsSaved(false);
      }, 1500);
      
      await loadRecentSparks();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save');
    }
  };

  async function toggleRecord() {
    try {
      if (!audioRecorder.isRecording) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission denied', 'Microphone access is required for voice notes');
          return;
        }
        await audioRecorder.prepareToRecordAsync();
        await audioRecorder.record();
      } else {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (uri) {
          const local = await insertIdeaLocal({ 
            content: `[Voice note] ${uri}`, 
            type: mode, 
            status: mode === 'PROJECT' ? 'BACKLOG' : 'INBOX' 
          });
          const action = mode === 'PROJECT' ? 'createProject' : 'createFeature';
          await enqueueOutbox(action as any, { 
            localId: local.localId, 
            content: `[Voice note] ${uri}`, 
            status: mode === 'PROJECT' ? undefined : 'INBOX' 
          });
          triggerSync();
          await loadRecentSparks();
          Alert.alert('Recorded', 'Voice note captured');
        }
      }
    } catch (e: any) {
      Alert.alert('Recording error', e?.message ?? 'Failed to record');
    }
  }

  function getTimestamp(createdAt: number): string {
    const now = Date.now();
    const ts = Number(createdAt) || now;
    const diff = now - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  }

  function getStatus(item: IdeaRecord): string {
    if (!item.serverId) return 'NEW';
    return item.status;
  }

  async function deleteItem(item: IdeaRecord) {
    const serverId = item.serverId ?? await getServerIdByLocalId(item.localId);
    await deleteIdeaLocal(item.localId);
    await enqueueOutbox('deleteIdea', { localId: item.localId, serverId });
    triggerSync();
    loadRecentSparks();
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.yellow, borderColor: theme.colors.black, paddingTop: insets.top + 20 }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.black }]}>SparkKeep</Text>
        
        <SegmentedControl
          options={['PROJECT', 'FEATURE']}
          selected={mode}
          onSelect={(option) => setMode(option as IdeaType)}
        />
      </View>

      <View style={styles.content}>

        <View style={styles.navButtons}>
          <NavButton
            icon={<Feather name="inbox" size={24} color={theme.colors.black} />}
            label="Inbox"
            color={theme.colors.cyan}
            onPress={() => router.push('/inbox')}
          />
          <View style={{ width: 12 }} />
          <NavButton
            icon={<Feather name="folder" size={24} color={theme.colors.black} />}
            label="Projects"
            color={theme.colors.lime}
            onPress={() => router.push('/projects')}
          />
        </View>

        <View style={styles.captureSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.black }]}>Capture Your Spark</Text>
          
          <TextInput
            autoFocus
            placeholder={mode === 'PROJECT' ? 'New project idea...' : 'New feature idea...'}
            placeholderTextColor={theme.colors.muted}
            value={content}
            onChangeText={setContent}
            multiline
            style={[
              styles.input,
              { 
                borderColor: theme.colors.black,
                borderRadius: 12,
                color: theme.colors.black,
                backgroundColor: theme.colors.white
              }
            ]}
          />

          <View style={styles.actionButtons}>
            <IconButton
              onPress={toggleRecord}
              color={theme.colors.pink}
            >
              <Feather 
                name={audioRecorder.isRecording ? 'mic-off' : 'mic'} 
                size={24} 
                color={theme.colors.white} 
              />
            </IconButton>
            
            <PrimaryButton
              onPress={onSubmit}
              disabled={!content.trim() && !isSaved}
              icon={isSaved ? 
                <Feather name="check" size={18} color={theme.colors.white} /> :
                <Feather name="zap" size={18} color={theme.colors.black} />
              }
              style={{ 
                flex: 1, 
                marginLeft: 12,
                backgroundColor: isSaved ? '#4CAF50' : theme.colors.yellow,
              }}
            >
              {isSaved ? 'Saved!' : 'Save Spark'}
            </PrimaryButton>
          </View>
        </View>

        {recentSparks.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.black }]}>Recent Sparks</Text>
              <Pressable onPress={() => router.push('/sparks')}>
                <Text style={[styles.viewAllLink, { color: theme.colors.textSecondary }]}>
                  View All →
                </Text>
              </Pressable>
            </View>

            {recentSparks.map((spark) => (
              <SwipeableRecentSpark
                key={spark.localId}
                spark={spark}
                onDelete={() => deleteItem(spark)}
                onPress={() => {
                  if (spark.type === 'PROJECT') {
                    router.push(`/projects/${spark.localId}`);
                  } else {
                    router.push('/inbox');
                  }
                }}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SwipeableRecentSpark({ 
  spark, 
  onDelete,
  onPress 
}: { 
  spark: IdeaRecord; 
  onDelete: () => void;
  onPress: () => void;
}) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  function getTimestamp(createdAt: number): string {
    const now = Date.now();
    const ts = Number(createdAt) || now;
    const diff = now - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    return `${weeks} weeks ago`;
  }

  function getStatus(item: IdeaRecord): string {
    if (!item.serverId) return 'NEW';
    return item.status;
  }

  const handleDelete = () => {
    swipeableRef.current?.close();
    setTimeout(() => onDelete(), 200);
  };

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
      <SparkCard
        type={spark.type}
        content={spark.content}
        timestamp={getTimestamp(spark.createdAt)}
        status={getStatus(spark)}
        onPress={onPress}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 5,
    gap: 16,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  navButtons: {
    flexDirection: 'row',
  },
  captureSection: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentSection: {
    gap: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
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
    marginLeft: 12,
  },
  swipeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
