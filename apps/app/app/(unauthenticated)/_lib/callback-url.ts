const defaultCallbackUrl = "/";

export function getSafeCallbackUrl(callbackUrl: string | null) {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  return defaultCallbackUrl;
}

export function getAbsoluteCallbackUrl(callbackUrl: string) {
  if (typeof window === "undefined") {
    return callbackUrl;
  }

  return new URL(callbackUrl, window.location.origin).toString();
}
