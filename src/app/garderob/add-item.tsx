import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  MOCK_WARDROBE_DEFAULTS,
  WARDROBE_CATEGORIES,
  WARDROBE_COLORS,
  WARDROBE_STYLES,
} from '@/constants/wardrobe-options';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { analyzeClothingImage } from '@/services/clothingAnalysis';

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.selectInput, pressed && styles.buttonPressed]}>
        <ThemedText style={styles.selectValue}>{value}</ThemedText>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <ThemedText style={styles.pickerTitle}>{label}</ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setIsOpen(false);
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
    </View>
  );
}

export default function AddItemScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { addItem } = useWardrobe();

  const [name, setName] = useState(MOCK_WARDROBE_DEFAULTS.name);
  const [category, setCategory] = useState<string>(MOCK_WARDROBE_DEFAULTS.category);
  const [color, setColor] = useState<string>(MOCK_WARDROBE_DEFAULTS.color);
  const [style, setStyle] = useState<string>(MOCK_WARDROBE_DEFAULTS.style);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');

  const analysisRequestRef = useRef(0);

  const applyAnalysisResult = useCallback(
    (result: Awaited<ReturnType<typeof analyzeClothingImage>>) => {
      setName(result.name);
      setCategory(result.category);
      setColor(result.color);
      setStyle(result.style);
    },
    [],
  );

  const runAnalysis = useCallback(async () => {
    if (!uri) {
      return;
    }

    const requestId = ++analysisRequestRef.current;
    setAnalysisStatus('loading');

    try {
      const result = await analyzeClothingImage(uri);

      if (requestId !== analysisRequestRef.current) {
        return;
      }

      applyAnalysisResult(result);
      setAnalysisStatus('success');
    } catch {
      if (requestId !== analysisRequestRef.current) {
        return;
      }

      setAnalysisStatus('error');
    }
  }, [uri, applyAnalysisResult]);

  useEffect(() => {
    runAnalysis();

    return () => {
      analysisRequestRef.current += 1;
    };
  }, [runAnalysis]);

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
      uri,
      name: name.trim() || MOCK_WARDROBE_DEFAULTS.name,
      category,
      color,
      style,
    });
    router.back();
  };

  const isAnalyzing = analysisStatus === 'loading';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={({ pressed }) => pressed && styles.buttonPressed}>
            <ThemedText style={styles.cancelLinkText}>Отмена</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Добавить вещь</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Image source={{ uri }} style={styles.preview} contentFit="cover" />

          {isAnalyzing && (
            <View style={styles.analysisStatus}>
              <ActivityIndicator color={Colors.light.text} />
              <ThemedText style={styles.analysisStatusText}>Распознаём вещь...</ThemedText>
            </View>
          )}

          {analysisStatus === 'error' && (
            <ThemedText style={styles.analysisError}>
              Не удалось распознать вещь. Заполни данные вручную.
            </ThemedText>
          )}

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Название</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.textInput}
              placeholder="Название вещи"
              placeholderTextColor={Colors.light.textSecondary}
            />
          </View>

          <SelectField
            label="Категория"
            value={category}
            options={WARDROBE_CATEGORIES}
            onChange={setCategory}
          />

          <SelectField label="Цвет" value={color} options={WARDROBE_COLORS} onChange={setColor} />

          <SelectField label="Стиль" value={style} options={WARDROBE_STYLES} onChange={setStyle} />

          <Pressable
            onPress={runAnalysis}
            disabled={isAnalyzing}
            style={({ pressed }) => [
              styles.retryButton,
              isAnalyzing && styles.retryButtonDisabled,
              pressed && !isAnalyzing && styles.buttonPressed,
            ]}>
            <ThemedText style={[styles.retryButtonText, isAnalyzing && styles.retryButtonTextDisabled]}>
              Распознать снова
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.saveButtonText}>Добавить в гардероб</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
    paddingBottom: BottomTabInset,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 60,
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundElement,
  },
  analysisStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  analysisStatusText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  analysisError: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  textInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
  },
  selectInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  selectValue: {
    fontSize: 16,
    color: Colors.light.text,
  },
  retryButton: {
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
  retryButtonDisabled: {
    borderColor: Colors.light.backgroundSelected,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  retryButtonTextDisabled: {
    color: Colors.light.textSecondary,
  },
  saveButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three + 2,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
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
  errorText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
