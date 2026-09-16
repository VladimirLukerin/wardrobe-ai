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

  const capturePhotoUri = useCallback(async (): Promise<string | null> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Нужен доступ к камере',
        'Для съёмки вещи приложению нужен доступ к камере. Разрешение можно изменить в настройках iPhone.',
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    return result.assets[0].uri;
  }, []);

  const pickGalleryPhotoUri = useCallback(async (): Promise<string | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Нужен доступ к фотографиям',
        'Разреши доступ к галерее в настройках, чтобы добавлять вещи в гардероб.',
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    return result.assets[0].uri;
  }, []);

  const takePhoto = useCallback(async () => {
    const uri = await capturePhotoUri();

    if (!uri) {
      return;
    }

    openAddItemScreen(uri);
  }, [capturePhotoUri, openAddItemScreen]);

  const pickFromGallery = useCallback(async () => {
    const uri = await pickGalleryPhotoUri();

    if (!uri) {
      return;
    }

    openAddItemScreen(uri);
  }, [openAddItemScreen, pickGalleryPhotoUri]);

  return {
    openAddItemScreen,
    capturePhotoUri,
    pickGalleryPhotoUri,
    takePhoto,
    pickFromGallery,
  };
}
