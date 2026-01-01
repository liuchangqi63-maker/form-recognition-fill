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

  const renderItem = ({ item }: { item: Document }) => (
    <DocumentCard
      document={item}
      onPress={() => handleDocumentPress(item)}
      onLongPress={() => handleDocumentLongPress(item)}
    />
  );

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>我的表格</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {documents.length > 0 ? `${documents.length} 个文档` : '开始创建您的第一个表格'}
        </Text>
      </View>

      {/* Document List */}
      {documents.length > 0 ? (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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

      {/* Floating Action Button */}
      {documents.length > 0 && (
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
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
