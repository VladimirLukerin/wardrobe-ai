import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

export function useAddWardrobeItem() {
  const openAddItemScreen = useCallback((uri: string) => {
    router.push({
      pathname: '/garderob/add-item',
      params: { uri },
    });
  }, []);

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

  return {
    openAddItemScreen,
    takePhoto,
    pickFromGallery,
  };
}
