export function isMacPlatform(): boolean {
  return navigator.userAgent.toLowerCase().includes("mac");
}
