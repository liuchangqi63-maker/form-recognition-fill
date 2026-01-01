import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { Document } from '@/shared/types';

interface DocumentCardProps {
  document: Document;
  onPress: () => void;
  onLongPress?: () => void;
}

export function DocumentCard({ document, onPress, onLongPress }: DocumentCardProps) {
  const colors = useColors();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  const getTableInfo = () => {
    const { tableData } = document;
    const rows = tableData.rows.length;
    const cols = tableData.headers.length;
    return `${rows} 行 × ${cols} 列`;
  };

  const getPreviewText = () => {
    const { tableData } = document;
    if (tableData.headers.length === 0) return '';
    return tableData.headers.slice(0, 3).join(' | ') + (tableData.headers.length > 3 ? ' ...' : '');
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {document.title || '未命名文档'}
        </Text>
        <Text style={[styles.date, { color: colors.muted }]}>
          {formatDate(document.updatedAt)}
        </Text>
      </View>

      {document.description && (
        <Text
          style={[styles.description, { color: colors.muted }]}
          numberOfLines={1}
        >
          {document.description}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {getTableInfo()}
          </Text>
        </View>
        <Text
          style={[styles.preview, { color: colors.muted }]}
          numberOfLines={1}
        >
          {getPreviewText()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  preview: {
    fontSize: 13,
    flex: 1,
  },
});
