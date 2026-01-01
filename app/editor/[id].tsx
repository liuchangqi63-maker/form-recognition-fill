import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenContainer } from '@/components/screen-container';
import { TableEditor } from '@/components/table-editor';
import { AIInputBar } from '@/components/ai-input-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoadingOverlay } from '@/components/loading-overlay';
import { useColors } from '@/hooks/use-colors';
import { useDocuments } from '@/hooks/use-documents';
import { trpc } from '@/lib/trpc';
import type { TableData, Document } from '@/shared/types';

export default function EditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDocument, updateDocument, deleteDocument } = useDocuments();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const searchAndFillMutation = trpc.table.searchAndFill.useMutation();
  const modifyTableMutation = trpc.table.modifyTable.useMutation();

  // Load document
  useEffect(() => {
    if (id) {
      const doc = getDocument(id);
      if (doc) {
        setDocument(doc);
        setTableData(doc.tableData);
      }
      setLoading(false);
    }
  }, [id, getDocument]);

  // Handle table changes
  const handleTableChange = useCallback((newTableData: TableData) => {
    setTableData(newTableData);
    setHasChanges(true);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!document || !tableData) return;
    
    await updateDocument(document.id, { tableData });
    setHasChanges(false);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [document, tableData, updateDocument]);

  // Handle AI commands
  const handleAICommand = useCallback(async (message: string, type: 'search' | 'modify') => {
    if (!tableData) return;

    setAiLoading(true);
    try {
      if (type === 'search') {
        const result = await searchAndFillMutation.mutateAsync({
          tableData,
          instruction: message,
        });
        setTableData(result.tableData);
        setHasChanges(true);
        
        if (result.searchSummary) {
          Alert.alert('搜索完成', result.searchSummary);
        }
      } else {
        const result = await modifyTableMutation.mutateAsync({
          tableData,
          instruction: message,
        });
        setTableData(result.tableData);
        setHasChanges(true);
        
        if (result.explanation) {
          Alert.alert('修改完成', result.explanation);
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AI command error:', error);
      Alert.alert('操作失败', '无法完成操作，请稍后重试');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAiLoading(false);
    }
  }, [tableData, searchAndFillMutation, modifyTableMutation]);

  // Handle back
  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        '未保存的更改',
        '您有未保存的更改，是否保存？',
        [
          { text: '不保存', style: 'destructive', onPress: () => router.back() },
          { text: '取消', style: 'cancel' },
          { text: '保存', onPress: async () => { await handleSave(); router.back(); } },
        ]
      );
    } else {
      router.back();
    }
  }, [hasChanges, handleSave, router]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!document || !tableData) return;

    try {
      // Convert table to text format
      const headerRow = tableData.headers.join('\t');
      const dataRows = tableData.rows.map(row => row.join('\t')).join('\n');
      const content = `${document.title}\n\n${headerRow}\n${dataRows}`;

      await Share.share({
        message: content,
        title: document.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [document, tableData]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!document) return;

    Alert.alert(
      '删除文档',
      `确定要删除"${document.title || '未命名文档'}"吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteDocument(document.id);
            router.back();
          },
        },
      ]
    );
  }, [document, deleteDocument, router]);

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!document || !tableData) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ color: colors.foreground }}>文档不存在</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>返回</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {document.title || '未命名文档'}
          </Text>
          {hasChanges && (
            <View style={[styles.unsavedBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.unsavedText}>未保存</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
            <Text style={[styles.saveText, { color: hasChanges ? colors.primary : colors.muted }]}>
              保存
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <IconSymbol name="square.and.arrow.up" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
            <IconSymbol name="trash.fill" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Table Editor */}
      <View style={styles.editorContainer}>
        <TableEditor
          tableData={tableData}
          onTableChange={handleTableChange}
          editable={!aiLoading}
        />
      </View>

      {/* AI Input Bar */}
      <AIInputBar
        onSend={handleAICommand}
        loading={aiLoading}
      />

      {/* Loading Overlay */}
      <LoadingOverlay
        visible={aiLoading}
        message="AI 正在处理..."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  unsavedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unsavedText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
  },
  editorContainer: {
    flex: 1,
    padding: 16,
  },
});
