export type AuthEntryUiState = {
  isLoginChoiceVisible: boolean;
  showAuthSplash: boolean;
};

export function handleAuthLoginPress(state: AuthEntryUiState): AuthEntryUiState {
  return {
    ...state,
    isLoginChoiceVisible: true,
  };
}

export function shouldResetAuthEntrySheetsOnSessionChange(
  previousSessionKey: string | number,
  nextSessionKey: string | number,
): boolean {
  return previousSessionKey !== nextSessionKey;
}

export function resetAuthEntrySheets(state: AuthEntryUiState): AuthEntryUiState {
  return {
    ...state,
    isLoginChoiceVisible: false,
  };
}
