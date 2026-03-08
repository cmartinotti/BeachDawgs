/**
 * BeachConditionsOverlay
 *
 * Floating glass card over the map when a beach is selected.
 *
 * LEFT  — current condition scores (swim / sunset / surf) from real data
 * RIGHT — mini sparklines at 3h intervals (mock data); tap to expand
 *
 * ExpandedChartModal — full-screen hourly bar chart with fixed Y-axis,
 * horizontal grid lines, and X tick marks.
 *
 * NOTE: forecast data is mock until backend exposes hourly forecasts.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import type { BeachWithConditions } from '@/types/beach';
import { spacing, radius } from '@/styles/spacing';
import { colors } from '@/styles/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConditionType = 'swim' | 'sunset' | 'surf';
type Rating = 'green' | 'yellow' | 'red';

interface HourlyPoint { hour: number; score: number; rating: Rating; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RATING_HEX: Record<Rating, string> = {
  green:  '#22C55E',
  yellow: '#F59E0B',
  red:    '#EF4444',
};

function scoreToRating(s: number): Rating { return s >= 7 ? 'green' : s >= 4 ? 'yellow' : 'red'; }
function ratingToScore(r: string | null | undefined): number {
  return r === 'green' ? 8 : r === 'yellow' ? 5 : r === 'red' ? 3 : 5;
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}
function generateForecast(seed: number, type: ConditionType): HourlyPoint[] {
  const offset = type === 'swim' ? 0 : type === 'sunset' ? 7 : 13;
  return Array.from({ length: 24 }, (_, h) => {
    const raw = 5 + 3 * Math.sin((h + offset + seed * 0.3) * 0.45);
    const score = Math.min(10, Math.max(1, Math.round(raw)));
    return { hour: h, score, rating: scoreToRating(score) };
  });
}
function formatHour(h: number): string {
  if (h === 0) return '12a'; if (h < 12) return `${h}a`;
  if (h === 12) return '12p'; return `${h - 12}p`;
}

const CONDITION_META: Record<ConditionType, { icon: string; label: string }> = {
  swim:   { icon: '🏊', label: 'Swim' },
  sunset: { icon: '🌅', label: 'Sunset' },
  surf:   { icon: '🏄', label: 'Surf' },
};
const TYPES: ConditionType[] = ['swim', 'sunset', 'surf'];

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

const MINI_BAR_W = 9;
const MINI_BAR_G = 2;
const MINI_BAR_H = 32;

function MiniSparkline({ data, onPress }: { data: HourlyPoint[]; onPress: () => void }) {
  // 3-hour resolution in the mini preview (8 bars); tap to see full 24-hour chart
  const bars = data.filter((_, i) => i % 3 === 0);
  return (
    <Pressable onPress={onPress} style={mini.wrap} hitSlop={6}>
      <View style={mini.barRow}>
        {bars.map((p) => (
          <View key={p.hour} style={[mini.bar, {
            height: Math.max(3, (p.score / 10) * MINI_BAR_H),
            backgroundColor: RATING_HEX[p.rating],
          }]} />
        ))}
      </View>
      <View style={mini.labelRow}>
        {bars.map((p) => (
          <Text key={p.hour} style={mini.label}>
            {p.hour === 0 ? '12a' : p.hour === 12 ? '12p' : p.hour < 12 ? `${p.hour}` : `${p.hour - 12}`}
          </Text>
        ))}
      </View>
      <Text style={mini.tapHint}>tap to expand</Text>
    </Pressable>
  );
}
const mini = StyleSheet.create({
  wrap:     { paddingLeft: 2 },
  barRow:   { flexDirection: 'row', alignItems: 'flex-end', height: MINI_BAR_H, gap: MINI_BAR_G },
  bar:      { width: MINI_BAR_W, borderRadius: 2 },
  labelRow: { flexDirection: 'row', marginTop: 3, gap: MINI_BAR_G },
  label:    { width: MINI_BAR_W, fontSize: 6, color: '#6B7280', textAlign: 'center' },
  tapHint:  { fontSize: 8, color: '#4B5563', marginTop: 3 },
});

// ─── Expanded Chart Modal ─────────────────────────────────────────────────────

const EXP_BAR_W   = 40;   // bar width
const EXP_BAR_G   = 7;    // gap between bars
const EXP_CHART_H = 200;  // plot area height
const Y_AXIS_W    = 30;   // fixed left column width
const Y_TICKS     = [10, 8, 6, 4, 2];
// total scrollable content width (needed for grid lines to span everything)
const CHART_TOTAL_W = 24 * (EXP_BAR_W + EXP_BAR_G);

function ExpandedChartModal({ visible, onClose, data, beachName, type }: {
  visible: boolean; onClose: () => void;
  data: HourlyPoint[]; beachName: string; type: ConditionType;
}) {
  const { icon, label } = CONDITION_META[type];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={exp.container}>

        {/* Header */}
        <View style={exp.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={exp.backText}>← Back</Text>
          </Pressable>
          <Text style={exp.title} numberOfLines={1}>{icon}  {beachName} — {label}</Text>
          <Text style={exp.subtitle}>Hourly forecast · mock data</Text>
        </View>

        {/* Chart: fixed Y-axis + horizontal scrollable plot */}
        <View style={exp.chartRow}>

          {/* ── Fixed Y-axis ── */}
          <View style={{ width: Y_AXIS_W, height: EXP_CHART_H, position: 'relative' }}>
            {Y_TICKS.map((v) => (
              <Text
                key={v}
                style={[exp.yLabel, { top: ((10 - v) / 10) * EXP_CHART_H - 8 }]}
              >
                {v}
              </Text>
            ))}
            {/* Baseline label */}
            <Text style={[exp.yLabel, { top: EXP_CHART_H - 8, color: '#D1D5DB' }]}>0</Text>
          </View>

          {/* ── Scrollable plot ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>

              {/* Plot area */}
              <View style={{ height: EXP_CHART_H, position: 'relative' }}>

                {/* Horizontal grid lines */}
                {Y_TICKS.map((v) => (
                  <View key={v} style={{
                    position: 'absolute',
                    top: ((10 - v) / 10) * EXP_CHART_H,
                    left: 0,
                    width: CHART_TOTAL_W,
                    height: 1,
                    backgroundColor: v === 10 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                  }} />
                ))}
                {/* Baseline */}
                <View style={{
                  position: 'absolute', bottom: 0, left: 0,
                  width: CHART_TOTAL_W, height: 1.5,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                }} />

                {/* Bars — grow upward from baseline */}
                <View style={{
                  position: 'absolute', bottom: 0, left: 0,
                  flexDirection: 'row', alignItems: 'flex-end',
                  height: EXP_CHART_H,
                }}>
                  {data.map((p) => (
                    <View key={p.hour} style={{ width: EXP_BAR_W, marginRight: EXP_BAR_G, alignItems: 'center' }}>
                      <View style={{
                        width: EXP_BAR_W,
                        height: Math.max(3, (p.score / 10) * EXP_CHART_H),
                        backgroundColor: RATING_HEX[p.rating],
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }} />
                    </View>
                  ))}
                </View>
              </View>

              {/* X-axis: tick mark + hour label — every hour */}
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                {data.map((p) => {
                  const major = p.hour % 6 === 0;
                  return (
                    <View key={p.hour} style={{ width: EXP_BAR_W + EXP_BAR_G, alignItems: 'center' }}>
                      <View style={{
                        width: 1,
                        height: major ? 6 : 3,
                        backgroundColor: major ? colors.gray900 : colors.gray600,
                      }} />
                      <Text style={[exp.xLabel, major && exp.xLabelMajor]}>
                        {formatHour(p.hour)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Legend */}
        <View style={exp.legend}>
          {(['green', 'yellow', 'red'] as Rating[]).map((r) => (
            <View key={r} style={exp.legendItem}>
              <View style={[exp.legendDot, { backgroundColor: RATING_HEX[r] }]} />
              <Text style={exp.legendLabel}>{r === 'green' ? 'Good' : r === 'yellow' ? 'OK' : 'Poor'}</Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const exp = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, paddingTop: 60 },
  header:    { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  backText:  { fontSize: 16, color: colors.primary, fontWeight: '500', marginBottom: spacing.sm },
  title:     { fontSize: 22, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  subtitle:  { fontSize: 13, color: colors.gray600 },
  chartRow:  { flexDirection: 'row', paddingLeft: spacing.md, paddingRight: spacing.md, alignItems: 'flex-start' },
  yLabel:    { position: 'absolute', right: 4, fontSize: 11, color: colors.gray600, textAlign: 'right', width: Y_AXIS_W - 6 },
  xLabel:    { fontSize: 9, color: colors.gray600, textAlign: 'center', marginTop: 2 },
  xLabelMajor: { fontSize: 11, color: colors.gray900, fontWeight: '700' },
  legend:    { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xl },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel:{ fontSize: 13, color: colors.gray600 },
});

// ─── Overlay Card ─────────────────────────────────────────────────────────────

export function BeachConditionsOverlay({ beach, onClose }: { beach: BeachWithConditions; onClose: () => void }) {
  const [expandedType, setExpandedType] = useState<ConditionType | null>(null);

  const seed = useMemo(() => hashStr(beach.id), [beach.id]);
  const forecasts = useMemo<Record<ConditionType, HourlyPoint[]>>(() => ({
    swim:   generateForecast(seed, 'swim'),
    sunset: generateForecast(seed, 'sunset'),
    surf:   generateForecast(seed, 'surf'),
  }), [seed]);

  const cond = beach.current_conditions;
  const nowScore: Record<ConditionType, number> = {
    swim:   ratingToScore(cond?.overall_rating),
    sunset: ratingToScore(cond?.sunset_rating),
    surf:   ratingToScore(cond?.wind_rating),
  };
  const nowRating: Record<ConditionType, Rating> = {
    swim:   scoreToRating(nowScore.swim),
    sunset: scoreToRating(nowScore.sunset),
    surf:   scoreToRating(nowScore.surf),
  };

  return (
    <>
      <View style={card.wrap}>
        {/* Header */}
        <View style={card.header}>
          <Text style={card.beachName} numberOfLines={1}>{beach.name}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={card.closeX}>✕</Text>
          </Pressable>
        </View>

        {/* Body */}
        <View style={card.body}>
          {/* LEFT — current conditions */}
          <View style={card.leftCol}>
            <Text style={card.colHeading}>NOW</Text>
            {TYPES.map((type) => (
              <View key={type} style={card.condRow}>
                <Text style={card.icon}>{CONDITION_META[type].icon}</Text>
                <View>
                  <Text style={card.condLabel}>{CONDITION_META[type].label}</Text>
                  <View style={card.scoreRow}>
                    <View style={[card.dot, { backgroundColor: RATING_HEX[nowRating[type]] }]} />
                    <Text style={card.scoreText}>{nowScore[type]}/10</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={card.divider} />

          {/* RIGHT — mini sparklines */}
          <View style={card.rightCol}>
            <Text style={card.colHeading}>TODAY  ↗</Text>
            {TYPES.map((type) => (
              <View key={type} style={card.forecastRow}>
                <Text style={card.icon}>{CONDITION_META[type].icon}</Text>
                <MiniSparkline data={forecasts[type]} onPress={() => setExpandedType(type)} />
              </View>
            ))}
          </View>
        </View>
      </View>

      {expandedType !== null && (
        <ExpandedChartModal
          visible
          onClose={() => setExpandedType(null)}
          data={forecasts[expandedType]}
          beachName={beach.name}
          type={expandedType}
        />
      )}
    </>
  );
}

const card = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: '14%',
    // ── Dark glass background ──
    backgroundColor: 'rgba(15, 15, 15, 0.78)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.lg,
    padding: spacing.md,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 20,
  },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  beachName:  { flex: 1, fontSize: 16, fontWeight: '700', color: '#F9FAFB' },
  closeX:     { fontSize: 18, color: '#9CA3AF', marginLeft: spacing.sm },
  body:       { flexDirection: 'row' },
  leftCol:    { flex: 4 },
  rightCol:   { flex: 5, paddingLeft: spacing.sm },
  divider:    { width: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: spacing.sm },
  colHeading: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  condRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  forecastRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  icon:       { fontSize: 18, marginRight: 6 },
  condLabel:  { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  scoreRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  scoreText:  { fontSize: 14, fontWeight: '700', color: '#F9FAFB' },
});
