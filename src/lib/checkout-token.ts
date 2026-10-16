const STORAGE_KEY = "motocar-checkout-confirmation-token-v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getCheckoutConfirmationToken(storage: Storage): string {
  const storedToken = storage.getItem(STORAGE_KEY);
  if (storedToken && UUID_PATTERN.test(storedToken)) return storedToken;

  const token = crypto.randomUUID();
  storage.setItem(STORAGE_KEY, token);
  return token;
}

export function clearCheckoutConfirmationToken(storage: Storage): void {
  storage.removeItem(STORAGE_KEY);
}
