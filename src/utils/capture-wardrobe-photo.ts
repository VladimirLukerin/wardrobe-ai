import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Existing wardrobe camera flow:
 * open camera → capture photo → open add-item form with the photo URI.
 */
export async function captureWardrobePhoto(): Promise<void> {
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

  router.push({
    pathname: '/garderob/add-item',
    params: { uri: result.assets[0].uri },
  });
}
