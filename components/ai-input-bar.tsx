import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

interface AIInputBarProps {
  onSend: (message: string, type: 'search' | 'modify') => void;
  loading?: boolean;
  placeholder?: string;
}

export function AIInputBar({ onSend, loading = false, placeholder }: AIInputBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [activeType, setActiveType] = useState<'search' | 'modify'>('search');

  const handleSend = () => {
    if (!message.trim() || loading) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    onSend(message.trim(), activeType);
    setMessage('');
  };

  const handleTypeChange = (type: 'search' | 'modify') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveType(type);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {/* Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            onPress={() => handleTypeChange('search')}
            style={[
              styles.typeButton,
              {
                backgroundColor: activeType === 'search' ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.typeButtonText,
                { color: activeType === 'search' ? '#fff' : colors.foreground },
              ]}
            >
              🔍 搜索填充
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTypeChange('modify')}
            style={[
              styles.typeButton,
              {
                backgroundColor: activeType === 'modify' ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.typeButtonText,
                { color: activeType === 'modify' ? '#fff' : colors.foreground },
              ]}
            >
              ✏️ 修改内容
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={
                placeholder ||
                (activeType === 'search'
                  ? '输入搜索指令，如"搜索2024年手机销量排行"'
                  : '输入修改指令，如"将第二列按数值排序"')
              }
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.foreground }]}
              multiline
              maxLength={500}
              returnKeyType="done"
              onSubmitEditing={handleSend}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!message.trim() || loading}
            style={[
              styles.sendButton,
              {
                backgroundColor: message.trim() && !loading ? colors.primary : colors.surface,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Text
                style={[
                  styles.sendButtonText,
                  { color: message.trim() ? '#fff' : colors.muted },
                ]}
              >
                发送
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 80,
  },
  sendButton: {
    width: 56,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
