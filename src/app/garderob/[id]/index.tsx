import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemWearStatisticsSheet } from '@/components/item-wear-statistics-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_COLORS,
  WARDROBE_PATTERNS,
  WARDROBE_STYLES,
} from '@/constants/wardrobe-options';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';

function getPrintDisplayValue(pattern: string, printDescription: string | null): string {
  if (pattern === 'Без принта') {
    return 'Без принта';
  }

  if (pattern === 'Принт' && printDescription) {
    return printDescription;
  }

  return pattern;
}

function showComingSoon() {
  Alert.alert('Скоро появится');
}

type InfoRowProps = {
  label: string;
  value: string;
  isLast?: boolean;
  onPress?: () => void;
};

function InfoRow({ label, value, isLast, onPress }: InfoRowProps) {
  const content = (
    <>
      <ThemedText themeColor="textSecondary" style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.infoValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.infoRow,
          !isLast && styles.infoRowBorder,
          pressed && styles.buttonPressed,
        ]}>
        {content}
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={12}
          tintColor={Colors.light.textSecondary}
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      {content}
    </View>
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

type ItemDraft = Pick<
  WardrobeItem,
  'name' | 'category' | 'color' | 'pattern' | 'printDescription' | 'style'
>;

function createDraftFromItem(item: WardrobeItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    printDescription: item.printDescription,
    style: item.style,
  };
}

export default function WardrobeItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { items, isHydrated, updateItem, removeItem, toggleFavorite } = useWardrobe();

  const item = useMemo(() => items.find((entry) => entry.id === id), [items, id]);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isWearStatisticsVisible, setIsWearStatisticsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [activePicker, setActivePicker] = useState<
    'category' | 'color' | 'print' | 'style' | null
  >(null);
  const [isNameEditorOpen, setIsNameEditorOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setDraft(createDraftFromItem(item));
    }
  }, [item]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleDeletePress = useCallback(() => {
    setIsMenuVisible(false);

    Alert.alert('Удалить вещь?', 'Вещь будет удалена из гардероба.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          if (!id) {
            return;
          }

          removeItem(id);
          router.back();
        },
      },
    ]);
  }, [id, removeItem]);

  const handleStartEditing = () => {
    if (item) {
      setDraft(createDraftFromItem(item));
      setIsEditing(true);
    }
  };

  const handleCancelEditing = () => {
    if (item) {
      setDraft(createDraftFromItem(item));
    }

    setIsEditing(false);
    setActivePicker(null);
    setIsNameEditorOpen(false);
  };

  const handleSaveEditing = () => {
    if (!item || !draft) {
      return;
    }

    updateItem(item.id, {
      name: draft.name.trim() || item.name,
      category: draft.category,
      color: draft.color,
      pattern: draft.pattern,
      printDescription: draft.printDescription,
      style: draft.style,
    });
    setIsEditing(false);
  };

  const handlePatternChange = (nextPattern: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        pattern: nextPattern,
        printDescription: nextPattern === 'Принт' ? current.printDescription : null,
      };
    });
  };

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!id || !item || !draft) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText style={styles.missingTitle}>Вещь не найдена</ThemedText>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backLink, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.backLinkText}>← Гардероб</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const displayImageUri = getWardrobeItemDisplayImageUri(item);
  const printDisplayValue = getPrintDisplayValue(draft.pattern, draft.printDescription);
  const metaLine = `${draft.category} · ${draft.color} · ${draft.style}`;

  const pickerConfig =
    activePicker === 'category'
      ? {
          title: 'Категория',
          options: WARDROBE_CATEGORIES,
          value: draft.category,
          onSelect: (value: string) => setDraft((current) => (current ? { ...current, category: value } : current)),
        }
      : activePicker === 'color'
        ? {
            title: 'Цвет',
            options: WARDROBE_COLORS,
            value: draft.color,
            onSelect: (value: string) => setDraft((current) => (current ? { ...current, color: value } : current)),
          }
        : activePicker === 'print'
          ? {
              title: 'Принт',
              options: WARDROBE_PATTERNS,
              value: draft.pattern,
              onSelect: handlePatternChange,
            }
          : activePicker === 'style'
            ? {
                title: 'Стиль',
                options: WARDROBE_STYLES,
                value: draft.style,
                onSelect: (value: string) => setDraft((current) => (current ? { ...current, style: value } : current)),
              }
            : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.headerBack, pressed && styles.buttonPressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={Colors.light.text}
              />
              <ThemedText style={styles.headerBackText}>Гардероб</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsMenuVisible(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
              hitSlop={8}>
              <ThemedText style={styles.menuButtonText}>•••</ThemedText>
            </Pressable>
          </View>

          <View style={styles.photoCard}>
            <View style={styles.photoInner}>
              <Image source={{ uri: displayImageUri }} style={styles.photo} contentFit="contain" />
            </View>
          </View>

          <View style={styles.titleBlock}>
            {isEditing ? (
              <Pressable
                onPress={() => setIsNameEditorOpen(true)}
                style={({ pressed }) => [styles.editableTitle, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.itemName}>{draft.name}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.editNameHint}>
                  Нажмите, чтобы изменить название
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText style={styles.itemName}>{item.name}</ThemedText>
            )}
            <ThemedText themeColor="textSecondary" style={styles.itemMeta}>
              {metaLine}
            </ThemedText>
          </View>

          <View style={styles.actionsBlock}>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/garderob/[id]/outfits',
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [styles.actionCard, styles.actionCardPrimary, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.actionCardEmoji}>✨</ThemedText>
                <ThemedText style={styles.actionCardText}>С чем носить</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => toggleFavorite(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                accessibilityState={{ selected: !!item.isFavorite }}
                style={({ pressed }) => [styles.actionCard, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.actionCardEmoji}>{item.isFavorite ? '♥' : '♡'}</ThemedText>
                <ThemedText style={styles.actionCardText}>{item.isFavorite ? 'В избранном' : 'Избранное'}</ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setIsWearStatisticsVisible(true)}
              style={({ pressed }) => [styles.actionCardWide, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.actionCardEmoji}>📊</ThemedText>
              <ThemedText style={styles.actionCardText}>Статистика носки</ThemedText>
            </Pressable>
          </View>

          <View style={styles.aboutSection}>
            <ThemedText style={styles.aboutTitle}>О ВЕЩИ</ThemedText>

            <View style={styles.aboutCard}>
              <InfoRow
                label="Категория"
                value={draft.category}
                onPress={isEditing ? () => setActivePicker('category') : undefined}
              />
              <InfoRow
                label="Цвет"
                value={draft.color}
                onPress={isEditing ? () => setActivePicker('color') : undefined}
              />
              <InfoRow
                label="Принт"
                value={printDisplayValue}
                onPress={isEditing ? () => setActivePicker('print') : undefined}
              />
              <InfoRow
                label="Стиль"
                value={draft.style}
                isLast
                onPress={isEditing ? () => setActivePicker('style') : undefined}
              />
            </View>
          </View>

          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable
                onPress={handleSaveEditing}
                style={({ pressed }) => [styles.saveEditButton, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.saveEditButtonText}>Сохранить</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCancelEditing}
                style={({ pressed }) => [styles.cancelEditButton, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.cancelEditButtonText}>Отмена</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleStartEditing}
              style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.editButtonText}>Редактировать</ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setIsMenuVisible(false)}>
          <View style={[styles.menuSheet, { top: insets.top + Spacing.five }]}>
            <Pressable
              onPress={handleDeletePress}
              style={({ pressed }) => [styles.menuOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.menuOptionDelete}>Удалить вещь</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <TextEditModal
        visible={isNameEditorOpen}
        title="Название"
        value={draft.name}
        onChange={(value) => setDraft((current) => (current ? { ...current, name: value } : current))}
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

      <ItemWearStatisticsSheet
        visible={isWearStatisticsVisible}
        item={item}
        onClose={() => setIsWearStatisticsVisible(false)}
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  menuButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  menuButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: 1,
  },
  photoCard: {
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundElement,
  },
  photoInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    gap: Spacing.one,
  },
  editableTitle: {
    gap: Spacing.one,
  },
  editNameHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemName: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    color: Colors.light.text,
  },
  itemMeta: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionsBlock: {
    gap: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  actionCardPrimary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
  },
  actionCardWide: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundElement,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionCardEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  actionCardText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  aboutSection: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
  },
  aboutCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  infoLabel: {
    width: 96,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'right',
  },
  editButton: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    borderRadius: 14,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  editActions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  saveEditButton: {
    backgroundColor: Colors.light.text,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelEditButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  cancelEditButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  backLink: {
    paddingVertical: Spacing.two,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  menuSheet: {
    position: 'absolute',
    right: Spacing.four,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    minWidth: 180,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  menuOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuOptionDelete: {
    fontSize: 16,
    color: '#C0392B',
    fontWeight: '500',
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
});
