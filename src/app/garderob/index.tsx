import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWardrobe } from '@/contexts/wardrobe-context';

const GRID_GAP = Spacing.two;
const NUM_COLUMNS = 2;

export default function GarderobScreen() {
  const { items } = useWardrobe();
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const cardWidth = (contentWidth - Spacing.four * 2 - GRID_GAP) / NUM_COLUMNS;

  const openAddItemScreen = useCallback((uri: string) => {
    router.push({
      pathname: '/garderob/add-item',
      params: { uri },
    });
  }, []);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Нужен доступ к фотографиям',
        'Разреши доступ к галерее в настройках, чтобы добавлять вещи в гардероб.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    openAddItemScreen(result.assets[0].uri);
  }, [openAddItemScreen]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Нужен доступ к камере',
        'Для съёмки вещи приложению нужен доступ к камере. Разрешение можно изменить в настройках iPhone.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    openAddItemScreen(result.assets[0].uri);
  }, [openAddItemScreen]);

  const handleSelectCamera = useCallback(async () => {
    setIsAddSheetVisible(false);
    await takePhoto();
  }, [takePhoto]);

  const handleSelectGallery = useCallback(async () => {
    setIsAddSheetVisible(false);
    await pickFromGallery();
  }, [pickFromGallery]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof items)[number] }) => (
      <ThemedView style={[styles.card, { width: cardWidth }]}>
        <Image source={{ uri: item.uri }} style={styles.cardImage} contentFit="cover" />
        <ThemedText style={styles.cardLabel}>{item.name}</ThemedText>
      </ThemedView>
    ),
    [cardWidth],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Мой гардероб
        </ThemedText>

        <Pressable
          onPress={() => setIsAddSheetVisible(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.addButtonText}>+ Добавить вещь</ThemedText>
        </Pressable>

        {items.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Гардероб пока пуст</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
              Добавь первую вещь, чтобы начать создавать образы.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLUMNS}
            renderItem={renderItem}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      <Modal
        visible={isAddSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddSheetVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setIsAddSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <ThemedText style={styles.sheetTitle}>Добавить вещь</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sheetSubtitle}>
              Выбери, откуда добавить фотографию
            </ThemedText>

            <Pressable
              onPress={handleSelectCamera}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetOptionTitle}>📷 Сделать фото</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Открыть камеру
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSelectGallery}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetOptionTitle}>🖼 Выбрать из галереи</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Выбрать существующее фото
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsAddSheetVisible(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetCancelText}>Отмена</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  emptyHint: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  grid: {
    paddingBottom: Spacing.two,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  sheetOption: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  sheetOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sheetOptionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetCancel: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
});
