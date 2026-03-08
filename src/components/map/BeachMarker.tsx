import { View, StyleSheet } from 'react-native';
import { Marker, Circle, Polygon } from 'react-native-maps';
import { RATING_COLORS, type Rating } from '@/lib/scoring';
import type { BeachWithConditions } from '@/types/beach';

interface BeachMarkerProps {
  beach: BeachWithConditions;
  isSelected: boolean;
  onPress: () => void;
}

// Fixed dark orange for all polygon/circle overlays — high contrast on satellite & terrain
const POLYGON_COLOR = '#D4600A';

// Fallback circle radius in metres by beach type
const FALLBACK_RADIUS: Record<string, number> = {
  surf_beach: 400,
  calm_bay:   300,
  rock_pool:  150,
  estuary:    350,
  remote:     500,
  lake:       300,
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function BeachMarker({ beach, isSelected, onPress }: BeachMarkerProps) {
  const conditions = beach.current_conditions;
  const overallRating: Rating = conditions?.overall_rating ?? 'yellow';
  const color = RATING_COLORS[overallRating];
  const coordinate = { latitude: beach.lat, longitude: beach.lng };

  const rawCoords = beach.boundary?.type === 'Polygon' ? beach.boundary.coordinates?.[0] : null;
  const polygonCoords = rawCoords && rawCoords.length >= 3
    ? rawCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    : null;

  return (
    <>
      {polygonCoords ? (
        /* Accurate OSM polygon overlay — dark orange for visibility */
        <Polygon
          coordinates={polygonCoords}
          fillColor={hexToRgba(POLYGON_COLOR, isSelected ? 0.45 : 0.28)}
          strokeColor={hexToRgba(POLYGON_COLOR, isSelected ? 1.0 : 0.75)}
          strokeWidth={isSelected ? 3 : 2}
          tappable
          onPress={onPress}
          zIndex={isSelected ? 2 : 1}
        />
      ) : (
        /* Fallback circle when no OSM polygon exists yet */
        <Circle
          center={coordinate}
          radius={
            (isSelected ? 1.2 : 1) *
            (FALLBACK_RADIUS[beach.beach_type ?? 'surf_beach'] ?? 300)
          }
          fillColor={hexToRgba(POLYGON_COLOR, isSelected ? 0.45 : 0.28)}
          strokeColor={hexToRgba(POLYGON_COLOR, isSelected ? 1.0 : 0.75)}
          strokeWidth={isSelected ? 3 : 2}
          zIndex={isSelected ? 2 : 1}
        />
      )}

      {/* Pin marker — always rendered on top for tap target */}
      <Marker
        coordinate={coordinate}
        onPress={onPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        zIndex={isSelected ? 3 : 2}
      >
        <View style={[
          styles.pin,
          { borderColor: color },
          isSelected && styles.pinSelected,
        ]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pinSelected: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
