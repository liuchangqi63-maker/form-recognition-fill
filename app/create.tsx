import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoadingOverlay } from '@/components/loading-overlay';
import { useColors } from '@/hooks/use-colors';
import { useDocuments } from '@/hooks/use-documents';
import { trpc } from '@/lib/trpc';
import type { TableData } from '@/shared/types';

export default function CreateScreen() {
  const colors = useColors();
  const router = useRouter();
  const { createDocument } = useDocuments();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWide = isWeb && width >= 900;
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const recognizeTableMutation = trpc.table.recognizeFromImage.useMutation();

  const handleBack = () => {
    router.back();
  };

  const pickImage = async (useCamera: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      let result;
      
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('权限不足', '需要相机权限才能拍照');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('权限不足', '需要相册权限才能选择图片');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].base64 || null);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('错误', '选择图片时出错');
    }
  };

  const handleCreateFromImage = async () => {
    if (!selectedImage) {
      Alert.alert('提示', '请先选择一张包含表格的图片');
      return;
    }

    setLoading(true);
    try {
      const result = await recognizeTableMutation.mutateAsync({
        imageBase64: selectedImage,
        description: description || undefined,
      });

      const doc = await createDocument(
        result.title || title || '识别的表格',
        result.tableData,
        description || undefined
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      router.replace(`/editor/${doc.id}` as any);
    } catch (error) {
      console.error('Recognition error:', error);
      Alert.alert('识别失败', '无法从图片中识别表格，请尝试其他图片或手动创建');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlank = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const defaultTable: TableData = {
      headers: ['列1', '列2', '列3'],
      rows: [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ],
    };

    const doc = await createDocument(
      title || '新建表格',
      defaultTable,
      description || undefined
    );

    router.replace(`/editor/${doc.id}` as any);
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.webContainer, isWeb && styles.webContainerCentered]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>新建表格</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>表格标题</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="输入表格标题（可选）"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          </View>

          <View style={[styles.section, isWide && styles.sectionRow]}>
            {/* Description Input */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>表格说明</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="描述表格的主题和用途（可选）"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>

            {/* Image Recognition Section */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>从图片识别</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>
                上传包含表格的图片，AI 将自动识别并转换为可编辑表格
              </Text>

              <View style={styles.imageButtons}>
                <TouchableOpacity
                  onPress={() => pickImage(true)}
                  style={[styles.imageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <IconSymbol name="camera.fill" size={28} color={colors.primary} />
                  <Text style={[styles.imageButtonText, { color: colors.foreground }]}>拍照</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => pickImage(false)}
                  style={[styles.imageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <IconSymbol name="photo.fill" size={28} color={colors.primary} />
                  <Text style={[styles.imageButtonText, { color: colors.foreground }]}>相册</Text>
                </TouchableOpacity>
              </View>

              {selectedImage && (
                <View style={[styles.selectedImageBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.selectedImageText, { color: colors.success }]}>
                    ✓ 已选择图片
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedImage(null)}>
                    <Text style={[styles.removeText, { color: colors.error }]}>移除</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCreateFromImage}
                disabled={!selectedImage || loading}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: selectedImage && !loading ? colors.primary : colors.surface,
                    opacity: selectedImage && !loading ? 1 : 0.6,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: selectedImage ? '#fff' : colors.muted }]}>
                    识别并创建表格
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.muted }]}>或者</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          {/* Create Blank */}
          <View style={styles.section}>
            <TouchableOpacity
              onPress={handleCreateBlank}
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
            >
              <IconSymbol name="tablecells.fill" size={20} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                创建空白表格
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Loading Overlay */}
      <LoadingOverlay
        visible={loading}
        message="正在识别表格..."
      />
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
    maxWidth: 1100,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 24,
  },
  sectionBlock: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imageButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedImageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedImageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
