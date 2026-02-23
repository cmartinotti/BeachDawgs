import { View, Text, StyleSheet } from 'react-native';
import { windDirectionLabel } from '@/lib/geo';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import type { BeachConditions } from '@/types/beach';

interface ConditionsRowProps {
  conditions: BeachConditions;
}

export function ConditionsRow({ conditions: c }: ConditionsRowProps) {
  return (
    <View style={styles.row}>
      <ConditionCell emoji="💨" label="Wind" value={c.wind_speed_kmh != null ? `${c.wind_speed_kmh.toFixed(0)} km/h` : '—'} sub={c.wind_direction_deg != null ? windDirectionLabel(c.wind_direction_deg) : ''} />
      <ConditionCell emoji="🌊" label="Swell" value={c.wave_height_m != null ? `${c.wave_height_m.toFixed(1)}m` : '—'} sub={c.wave_period_s != null ? `${c.wave_period_s.toFixed(0)}s` : ''} />
      <ConditionCell emoji="🌡️" label="Air" value={c.air_temp_c != null ? `${Math.round(c.air_temp_c)}°C` : '—'} />
      <ConditionCell emoji="💧" label="Water" value={c.water_temp_c != null ? `${Math.round(c.water_temp_c)}°C` : '—'} />
      <ConditionCell emoji="☀️" label="UV" value={c.uv_index != null ? c.uv_index.toFixed(0) : '—'} />
      <ConditionCell emoji="🌅" label="Sunset" value={c.sunset ? formatTime(c.sunset) : '—'} />
    </View>
  );
}

function ConditionCell({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    minWidth: 56,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  emoji: { fontSize: 18 },
  value: { fontSize: 14, fontWeight: '700', color: colors.gray900, marginTop: 2 },
  sub: { fontSize: 11, color: colors.gray500 },
  label: { fontSize: 11, color: colors.gray400, marginTop: 1 },
});
