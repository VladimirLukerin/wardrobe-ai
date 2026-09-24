type DevBypassRequestCodeResponse = {
  devBypassAvailable?: boolean;
};

export function isDevOtpBypassAvailable(response: DevBypassRequestCodeResponse): boolean {
  return __DEV__ && response.devBypassAvailable === true;
}
