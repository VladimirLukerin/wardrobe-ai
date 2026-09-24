import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import PhotoRetakeSheet from '@/components/photo-retake-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ImageProcessingStatus } from '@/constants/wardrobe-item';
import {
  MOCK_WARDROBE_DEFAULTS,
  WARDROBE_CATEGORIES,
  WARDROBE_COLORS,
  WARDROBE_PATTERNS,
  WARDROBE_STYLES,
} from '@/constants/wardrobe-options';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';
import { NETWORK_ERROR_HINT, NETWORK_ERROR_TITLE } from '@/utils/network-error';
import {
  ClothingImageProcessingError,
  clearClothingImageProcessingCache,
  processClothingImage,
} from '@/services/clothing-image-processing';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

const BACKGROUND_REMOVAL_SHEET_TITLE = 'Не удалось обработать фон';
const BACKGROUND_REMOVAL_SHEET_MESSAGE =
  'Попробуйте ещё раз или выберите другую фотографию.';

type RetakeSheetMode = 'photo_guard' | 'background_removal';

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

const PREVIEW_HEIGHT = Math.min(Math.round(Dimensions.get('window').width * 0.76), 300);
const SUCCESS_ACCENT = '#3A7D5C';

function getPrintDisplayValue(pattern: string, printDescription: string | null): string {
  if (pattern === 'Без принта') {
    return 'Без принта';
  }

  if (pattern === 'Принт' && printDescription) {
    return printDescription;
  }

  return pattern;
}

function ProgressIndicator() {
  return (
    <View style={styles.progressRow}>
      <View style={[styles.progressDot, styles.progressDotFilled]} />
      <View style={styles.progressLine} />
      <View style={[styles.progressDot, styles.progressDotFilled]} />
      <View style={styles.progressLine} />
      <View style={[styles.progressDot, styles.progressDotOutline]} />
    </View>
  );
}

type ParameterRowProps = {
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
};

function ParameterRow({ label, value, onPress, isLast }: ParameterRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.parameterRow,
        !isLast && styles.parameterRowBorder,
        pressed && styles.buttonPressed,
      ]}>
      <ThemedText style={styles.parameterLabel}>{label}</ThemedText>
      <View style={styles.parameterValueGroup}>
        <ThemedText style={styles.parameterValue} numberOfLines={1}>
          {value}
        </ThemedText>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={12}
          tintColor={Colors.light.textSecondary}
        />
      </View>
    </Pressable>
  );
}

type PickerModalProps = {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, options, value, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
          <ThemedText style={styles.pickerTitle}>{title}</ThemedText>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  item === value && styles.pickerOptionSelected,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText
                  style={[styles.pickerOptionText, item === value && styles.pickerOptionTextSelected]}>
                  {item}
                </ThemedText>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type TextEditModalProps = {
  visible: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

function TextEditModal({ visible, title, value, onChange, onClose }: TextEditModalProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  const handleSave = () => {
    onChange(draft.trim() || value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.textEditOverlay} onPress={onClose}>
        <Pressable style={styles.textEditSheet} onPress={(event) => event.stopPropagation()}>
          <ThemedText style={styles.pickerTitle}>{title}</ThemedText>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={styles.textEditInput}
            placeholder={title}
            placeholderTextColor={Colors.light.textSecondary}
            autoFocus
          />
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.textEditSaveButton, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.textEditSaveButtonText}>Готово</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function AddItemScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { addItem } = useWardrobe();
  const { capturePhotoUri, pickGalleryPhotoUri } = useAddWardrobeItem();
  const insets = useSafeAreaInsets();

  const originalImageUri = uri ?? '';

  const [name, setName] = useState<string>(MOCK_WARDROBE_DEFAULTS.name);
  const [baseName, setBaseName] = useState<string>(MOCK_WARDROBE_DEFAULTS.baseName);
  const [category, setCategory] = useState<string>(MOCK_WARDROBE_DEFAULTS.category);
  const [color, setColor] = useState<string>(MOCK_WARDROBE_DEFAULTS.color);
  const [pattern, setPattern] = useState<string>(MOCK_WARDROBE_DEFAULTS.pattern);
  const [printDescription, setPrintDescription] = useState<string | null>(
    MOCK_WARDROBE_DEFAULTS.printDescription,
  );
  const [style, setStyle] = useState<string>(MOCK_WARDROBE_DEFAULTS.style);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [imageProcessingStatus, setImageProcessingStatus] = useState<ImageProcessingStatus>('idle');
  const [processedImageUri, setProcessedImageUri] = useState<string | undefined>();
  const [imageProcessingMessage, setImageProcessingMessage] = useState<string | null>(null);
  const [retakeSheetMode, setRetakeSheetMode] = useState<RetakeSheetMode | null>(null);
  const [photoRejectMessage, setPhotoRejectMessage] = useState<string | null>(null);

  const [activePicker, setActivePicker] = useState<
    'category' | 'color' | 'print' | 'style' | null
  >(null);
  const [isNameEditorOpen, setIsNameEditorOpen] = useState(false);

  const analysisRequestRef = useRef(0);

  const displayImageUri = processedImageUri ?? originalImageUri;
  const isProcessingPhoto =
    analysisStatus === 'loading' || imageProcessingStatus === 'processing';
  const isSaveDisabled = isProcessingPhoto;
  const printDisplayValue = getPrintDisplayValue(pattern, printDescription);

  const applyProcessingResult = useCallback(
    (result: Awaited<ReturnType<typeof processClothingImage>>) => {
      setName(result.name);
      setBaseName(result.baseName);
      setCategory(result.category);
      setColor(result.color);
      setPattern(result.pattern);
      setPrintDescription(result.printDescription);
      setStyle(result.style);
      setConfidence(result.confidence);
      setProcessedImageUri(result.processedImageUri);
    },
    [],
  );

  const replacePhotoUri = useCallback((nextUri: string) => {
    clearClothingImageProcessingCache(originalImageUri);
    analysisRequestRef.current += 1;
    setRetakeSheetMode(null);
    setPhotoRejectMessage(null);
    setAnalysisStatus('idle');
    setAnalysisMessage(null);
    setConfidence(null);
    setImageProcessingStatus('idle');
    setProcessedImageUri(undefined);
    setImageProcessingMessage(null);
    router.setParams({ uri: nextUri });
  }, [originalImageUri]);

  const runPhotoProcessing = useCallback(async () => {
    if (!originalImageUri) {
      return;
    }

    const requestId = ++analysisRequestRef.current;
    setAnalysisStatus('loading');
    setAnalysisMessage(null);
    setConfidence(null);
    setImageProcessingStatus('processing');
    setProcessedImageUri(undefined);
    setImageProcessingMessage(null);
    setRetakeSheetMode(null);
    setPhotoRejectMessage(null);

    try {
      const result = await processClothingImage(originalImageUri);

      if (requestId !== analysisRequestRef.current) {
        return;
      }

      applyProcessingResult(result);
      setAnalysisStatus('success');
      setAnalysisMessage(null);
      setImageProcessingStatus('completed');
    } catch (error) {
      if (requestId !== analysisRequestRef.current) {
        return;
      }

      setProcessedImageUri(undefined);
      setConfidence(null);

      if (ClothingImageProcessingError.isPhotoGuardReject(error)) {
        setAnalysisStatus('error');
        setAnalysisMessage(null);
        setImageProcessingStatus('failed');
        setImageProcessingMessage(null);
        setPhotoRejectMessage(error.message || null);
        setRetakeSheetMode('photo_guard');
        return;
      }

      if (ClothingImageProcessingError.isBackgroundRemoval(error)) {
        setAnalysisStatus('error');
        setAnalysisMessage(null);
        setImageProcessingStatus('failed');
        setImageProcessingMessage(null);
        setRetakeSheetMode('background_removal');
        return;
      }

      setAnalysisStatus('error');
      setImageProcessingStatus('failed');
      setRetakeSheetMode(null);

      if (error instanceof ClothingImageProcessingError && error.code === 'network') {
        setAnalysisMessage(NETWORK_ERROR_HINT);
        setImageProcessingMessage(NETWORK_ERROR_TITLE);
        return;
      }

      if (error instanceof ClothingImageProcessingError && error.code === 'rate_limited') {
        setAnalysisMessage(error.message);
        setImageProcessingMessage(error.message);
        return;
      }

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Не удалось обработать фото.';

      setAnalysisMessage('Не удалось распознать вещь. Заполните данные вручную.');
      setImageProcessingMessage(message);
    }
  }, [originalImageUri, applyProcessingResult]);

  const handleRetakePhoto = useCallback(async () => {
    setRetakeSheetMode(null);
    const nextUri = await capturePhotoUri();

    if (nextUri) {
      replacePhotoUri(nextUri);
    }
  }, [capturePhotoUri, replacePhotoUri]);

  const handlePickAnotherPhoto = useCallback(async () => {
    setRetakeSheetMode(null);
    const nextUri = await pickGalleryPhotoUri();

    if (nextUri) {
      replacePhotoUri(nextUri);
    }
  }, [pickGalleryPhotoUri, replacePhotoUri]);

  const runAnalysis = useCallback(async () => {
    clearClothingImageProcessingCache(originalImageUri);
    await runPhotoProcessing();
  }, [originalImageUri, runPhotoProcessing]);

  useEffect(() => {
    void runPhotoProcessing();

    return () => {
      analysisRequestRef.current += 1;
    };
  }, [runPhotoProcessing]);

  const handlePatternChange = (nextPattern: string) => {
    setPattern(nextPattern);

    if (nextPattern !== 'Принт') {
      setPrintDescription(null);
    }
  };

  if (!uri) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.errorText}>Фотография не найдена.</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.cancelLink}>
            <ThemedText style={styles.cancelLinkText}>Назад</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const handleCancel = () => {
    router.back();
  };

  const handleSave = () => {
    addItem({
      originalImageUri,
      processedImageUri: imageProcessingStatus === 'completed' ? processedImageUri : undefined,
      imageProcessingStatus:
        imageProcessingStatus === 'idle' && analysisStatus !== 'success'
          ? 'idle'
          : imageProcessingStatus,
      name: name.trim() || MOCK_WARDROBE_DEFAULTS.name,
      baseName: baseName.trim() || MOCK_WARDROBE_DEFAULTS.baseName,
      category,
      color,
      pattern,
      printDescription,
      style,
    });
    router.back();
  };

  const pickerConfig =
    activePicker === 'category'
      ? { title: 'Категория', options: WARDROBE_CATEGORIES, value: category, onSelect: setCategory }
      : activePicker === 'color'
        ? { title: 'Цвет', options: WARDROBE_COLORS, value: color, onSelect: setColor }
        : activePicker === 'print'
          ? {
              title: 'Принт',
              options: WARDROBE_PATTERNS,
              value: pattern,
              onSelect: handlePatternChange,
            }
          : activePicker === 'style'
            ? { title: 'Стиль', options: WARDROBE_STYLES, value: style, onSelect: setStyle }
            : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={handleCancel} style={({ pressed }) => pressed && styles.buttonPressed}>
              <ThemedText style={styles.cancelLinkText}>Отмена</ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>Проверка вещи</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.topSection}>
            <ProgressIndicator />

            <View style={styles.previewContainer}>
            <View style={styles.previewInner}>
              <Image
                source={{ uri: displayImageUri }}
                style={styles.preview}
                contentFit="contain"
              />
            </View>

            {isProcessingPhoto && (
              <View style={styles.processingBadge}>
                <ActivityIndicator size="small" color={Colors.light.textSecondary} />
                <ThemedText style={styles.processingBadgeText}>Обрабатываем фото…</ThemedText>
              </View>
            )}

            {imageProcessingStatus === 'completed' && (
              <View style={styles.successBadge}>
                <ThemedText style={styles.successBadgeText}>✓ Фон удалён</ThemedText>
              </View>
            )}
            </View>

            {imageProcessingStatus === 'failed' && retakeSheetMode === null && (
              <View style={styles.processingFailedRow}>
                <ThemedText themeColor="textSecondary" style={styles.processingFailedText}>
                  {imageProcessingMessage ?? 'Не удалось обработать фото'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.processingFailedDot}>
                  ·
                </ThemedText>
                <Pressable
                  onPress={() => {
                    void runAnalysis();
                  }}
                  style={({ pressed }) => [styles.processingRetryButton, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.processingRetryButtonText}>Повторить</ThemedText>
                </Pressable>
              </View>
            )}

            {analysisStatus === 'success' && confidence !== null && (
              <ThemedText themeColor="textSecondary" style={styles.confidenceText}>
                {confidence >= LOW_CONFIDENCE_THRESHOLD
                  ? `Уверенность · ${Math.round(confidence * 100)}%`
                  : 'Уверенность · проверьте данные'}
              </ThemedText>
            )}

            {analysisStatus === 'error' && analysisMessage && (
              <ThemedText themeColor="textSecondary" style={styles.confidenceText}>
                {analysisMessage}
              </ThemedText>
            )}
          </View>

          <View style={styles.aiSection}>
            <ThemedText style={styles.aiSectionTitle}>Распознано AI</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.aiSectionSubtitle}>
              Проверьте данные и при необходимости отредактируйте
            </ThemedText>
          </View>

          <View style={styles.parametersCard}>
            <ParameterRow
              label="Название"
              value={name}
              onPress={() => setIsNameEditorOpen(true)}
            />
            <ParameterRow
              label="Категория"
              value={category}
              onPress={() => setActivePicker('category')}
            />
            <ParameterRow label="Цвет" value={color} onPress={() => setActivePicker('color')} />
            <ParameterRow
              label="Принт"
              value={printDisplayValue}
              onPress={() => setActivePicker('print')}
            />
            <ParameterRow
              label="Стиль"
              value={style}
              onPress={() => setActivePicker('style')}
              isLast
            />
          </View>

          <Pressable
            onPress={() => {
              void runAnalysis();
            }}
            disabled={isProcessingPhoto}
            style={({ pressed }) => [
              styles.recognizeAgainButton,
              isProcessingPhoto && styles.recognizeAgainButtonDisabled,
              pressed && !isProcessingPhoto && styles.buttonPressed,
            ]}>
            <ThemedText
              style={[
                styles.recognizeAgainText,
                isProcessingPhoto && styles.recognizeAgainTextDisabled,
              ]}>
              ↻ Распознать снова
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={isSaveDisabled}
            style={({ pressed }) => [
              styles.saveButton,
              isSaveDisabled && styles.saveButtonDisabled,
              pressed && !isSaveDisabled && styles.buttonPressed,
            ]}>
            <ThemedText style={[styles.saveButtonText, isSaveDisabled && styles.saveButtonTextDisabled]}>
              Добавить в гардероб
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <TextEditModal
        visible={isNameEditorOpen}
        title="Название"
        value={name}
        onChange={setName}
        onClose={() => setIsNameEditorOpen(false)}
      />

      {pickerConfig && (
        <PickerModal
          visible={activePicker !== null}
          title={pickerConfig.title}
          options={pickerConfig.options}
          value={pickerConfig.value}
          onSelect={pickerConfig.onSelect}
          onClose={() => setActivePicker(null)}
        />
      )}

      <PhotoRetakeSheet
        visible={retakeSheetMode !== null}
        title={
          retakeSheetMode === 'background_removal'
            ? BACKGROUND_REMOVAL_SHEET_TITLE
            : undefined
        }
        message={
          retakeSheetMode === 'background_removal'
            ? BACKGROUND_REMOVAL_SHEET_MESSAGE
            : photoRejectMessage
        }
        hint={retakeSheetMode === 'background_removal' ? null : undefined}
        primaryLabel={
          retakeSheetMode === 'background_removal' ? 'Попробовать снова' : undefined
        }
        secondaryLabel={
          retakeSheetMode === 'background_removal' ? 'Выбрать другое фото' : undefined
        }
        onClose={() => setRetakeSheetMode(null)}
        onRetakePhoto={() => {
          if (retakeSheetMode === 'background_removal') {
            void runAnalysis();
            return;
          }

          void handleRetakePhoto();
        }}
        onPickAnotherPhoto={() => {
          void handlePickAnotherPhoto();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  topSection: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 56,
  },
  cancelLinkText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  cancelLink: {
    alignSelf: 'center',
    marginTop: Spacing.four,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressDotFilled: {
    backgroundColor: Colors.light.text,
  },
  progressDotOutline: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
  },
  progressLine: {
    width: 22,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: Colors.light.textSecondary,
    opacity: 0.35,
  },
  previewContainer: {
    position: 'relative',
    height: PREVIEW_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundElement,
  },
  previewInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  processingBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  processingBadgeText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  successBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  successBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: SUCCESS_ACCENT,
  },
  processingFailedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  processingFailedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  processingFailedDot: {
    fontSize: 14,
    lineHeight: 20,
  },
  processingRetryButton: {
    paddingVertical: Spacing.one,
  },
  processingRetryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  analysisStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  confidenceText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  aiSection: {
    gap: Spacing.one,
    marginTop: -Spacing.one,
  },
  aiSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  aiSectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  parametersCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    overflow: 'hidden',
  },
  parameterRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  parameterRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  parameterLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    flexShrink: 0,
  },
  parameterValueGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    minWidth: 0,
  },
  parameterValue: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  recognizeAgainButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  recognizeAgainButtonDisabled: {
    opacity: 0.45,
  },
  recognizeAgainText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  recognizeAgainTextDisabled: {
    color: Colors.light.textSecondary,
  },
  saveButton: {
    backgroundColor: Colors.light.text,
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  saveButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: Colors.light.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  pickerOption: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
  },
  textEditOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: Spacing.four,
  },
  textEditSheet: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  textEditInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
  },
  textEditSaveButton: {
    backgroundColor: Colors.light.text,
    borderRadius: 12,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
  },
  textEditSaveButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
