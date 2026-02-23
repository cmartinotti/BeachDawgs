/**
 * Auto-generated Supabase types placeholder.
 * Replace with the output of: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
 *
 * Until generated, this file exports a basic Database type to keep TypeScript happy.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      beaches: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      beach_conditions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      user_profiles: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      user_preferences: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      notification_settings: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      user_beaches: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      check_ins: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      notifications_log: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      user_subscriptions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      rate_limit_counters: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Views: Record<string, never>;
    Functions: {
      is_premium: { Args: { check_user_id?: string }; Returns: boolean };
      increment_rate_limit_counter: {
        Args: { p_user_id: string; p_function_name: string; p_window_start: string; p_max_requests: number };
        Returns: { exceeded: boolean }[];
      };
    };
    Enums: Record<string, never>;
  };
}
