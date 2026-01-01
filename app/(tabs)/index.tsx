import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { DocumentCard } from '@/components/document-card';
import { EmptyState } from '@/components/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useDocuments } from '@/hooks/use-documents';
import type { Document } from '@/shared/types';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { documents, loading, deleteDocument, refreshDocuments } = useDocuments();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const numColumns = isWeb ? (width >= 1200 ? 3 : width >= 900 ? 2 : 1) : 1;

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshDocuments();
    }, [refreshDocuments])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  };

  const handleDocumentPress = (doc: Document) => {
    router.push(`/editor/${doc.id}` as any);
  };

  const handleDocumentLongPress = (doc: Document) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Alert.alert(
      '删除文档',
      `确定要删除"${doc.title || '未命名文档'}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteDocument(doc.id),
        },
      ]
    );
  };

  const handleCreateNew = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/create' as any);
  };

  const renderItem = ({ item }: { item: Document }) => {
    const card = (
      <DocumentCard
        document={item}
        onPress={() => handleDocumentPress(item)}
        onLongPress={() => handleDocumentLongPress(item)}
      />
    );

    if (!isWeb || numColumns === 1) {
      return card;
    }

    return <View style={styles.cardWrapper}>{card}</View>;
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <View style={[styles.webContainer, isWeb && styles.webContainerCentered]}>
        {/* Header */}
        <View style={[styles.header, isWeb && styles.headerWeb]}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>我的表格</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {documents.length > 0 ? `${documents.length} 个文档` : '开始创建您的第一个表格'}
            </Text>
          </View>
          {isWeb && (
            <TouchableOpacity
              onPress={handleCreateNew}
              activeOpacity={0.8}
              style={[styles.headerButton, { backgroundColor: colors.primary }]}
            >
              <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
              <Text style={styles.headerButtonText}>创建表格</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Document List */}
        {documents.length > 0 ? (
          <FlatList
            data={documents}
            key={numColumns}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={numColumns}
            columnWrapperStyle={
              isWeb && numColumns > 1 ? styles.columnWrapper : undefined
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        ) : (
          <EmptyState
            icon="📊"
            title="还没有表格"
            description="从图片识别表格或创建空白表格，开始您的智能表格之旅"
            actionText="创建表格"
            onAction={handleCreateNew}
          />
        )}
      </View>

      {/* Floating Action Button */}
      {!isWeb && documents.length > 0 && (
        <TouchableOpacity
          onPress={handleCreateNew}
          activeOpacity={0.8}
          style={[styles.fab, { backgroundColor: colors.primary }]}
        >
          <IconSymbol name="plus.circle.fill" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
  },
  webContainerCentered: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1200,
    paddingHorizontal: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerWeb: {
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  columnWrapper: {
    marginHorizontal: -6,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 6,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
