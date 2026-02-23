import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!,
  default: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
});

export const ENTITLEMENT_PREMIUM = 'premium';

// Call this once on auth, passing the Supabase user.id as appUserID
// This links RevenueCat subscription state directly to our own user ID
export async function initializePurchases(supabaseUserId: string): Promise<void> {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: RC_API_KEY!, appUserID: supabaseUserId });
}

// Get available subscription packages (monthly + annual)
export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('[Purchases] getOfferings failed:', e);
    return null;
  }
}

// Attempt to purchase a package; returns null on failure/cancellation
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (!e.userCancelled) {
      console.error('[Purchases] purchasePackage failed:', e);
    }
    return null;
  }
}

// Client-side entitlement check — for UI rendering ONLY, not a security gate
// Server-side (Edge Functions + RLS) always re-validates from user_subscriptions
export async function isPremiumClient(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}

// Restore purchases (required by App Store guidelines — must be accessible in UI)
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.error('[Purchases] restorePurchases failed:', e);
    return null;
  }
}
