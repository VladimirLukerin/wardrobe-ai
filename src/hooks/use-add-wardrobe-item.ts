import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  setPhotoCaptureOnboardingSkipped,
  shouldShowPhotoCaptureOnboarding,
} from '@/storage/photo-onboarding-storage';

type PendingPhotoAction = 'camera' | 'gallery' | null;

export function useAddWardrobeItem() {
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingPhotoAction>(null);

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

  const runPendingAction = useCallback(async () => {
    if (pendingAction === 'camera') {
      const uri = await capturePhotoUri();

      if (uri) {
        openAddItemScreen(uri);
      }
    } else if (pendingAction === 'gallery') {
      const uri = await pickGalleryPhotoUri();

      if (uri) {
        openAddItemScreen(uri);
      }
    }

    setPendingAction(null);
  }, [capturePhotoUri, openAddItemScreen, pendingAction, pickGalleryPhotoUri]);

  const beginPhotoAction = useCallback(async (action: Exclude<PendingPhotoAction, null>) => {
    const shouldShowOnboarding = await shouldShowPhotoCaptureOnboarding();

    if (shouldShowOnboarding) {
      setPendingAction(action);
      setIsOnboardingVisible(true);
      return;
    }

    if (action === 'camera') {
      const uri = await capturePhotoUri();

      if (uri) {
        openAddItemScreen(uri);
      }

      return;
    }

    const uri = await pickGalleryPhotoUri();

    if (uri) {
      openAddItemScreen(uri);
    }
  }, [capturePhotoUri, openAddItemScreen, pickGalleryPhotoUri]);

  const takePhoto = useCallback(async () => {
    await beginPhotoAction('camera');
  }, [beginPhotoAction]);

  const pickFromGallery = useCallback(async () => {
    await beginPhotoAction('gallery');
  }, [beginPhotoAction]);

  const handleOnboardingContinue = useCallback(() => {
    setIsOnboardingVisible(false);
    void runPendingAction();
  }, [runPendingAction]);

  const handleOnboardingSkipForever = useCallback(() => {
    void setPhotoCaptureOnboardingSkipped(true);
    setIsOnboardingVisible(false);
    void runPendingAction();
  }, [runPendingAction]);

  const handleOnboardingClose = useCallback(() => {
    setIsOnboardingVisible(false);
    setPendingAction(null);
  }, []);

  return {
    openAddItemScreen,
    capturePhotoUri,
    pickGalleryPhotoUri,
    takePhoto,
    pickFromGallery,
    isPhotoOnboardingVisible: isOnboardingVisible,
    handlePhotoOnboardingContinue: handleOnboardingContinue,
    handlePhotoOnboardingSkipForever: handleOnboardingSkipForever,
    handlePhotoOnboardingClose: handleOnboardingClose,
  };
}
