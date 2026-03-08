/**
 * BeachDawgs — Map Screen (main tab)
 *
 * Full-screen map with color-coded beach markers.
 * Beaches are loaded for the current viewport; zooming out past
 * MAX_VISIBLE_DELTA shows a "zoom in" prompt instead.
 *
 * Tapping a marker → BeachConditionsOverlay pops up (current scores +
 * mini sparkline forecasts, expandable to full-screen hourly chart).
 */

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, ActivityIndicator } from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { BeachMarker } from '@/components/map/BeachMarker';
import { BeachPreviewCard } from '@/components/map/BeachPreviewCard';
import { MapFiltersBar } from '@/components/map/MapFilters';
import { BeachConditionsOverlay } from '@/components/map/BeachConditionsOverlay';
import { useVisibleBeaches } from '@/hooks/useVisibleBeaches';
import { useLocationStore } from '@/store/locationStore';
import { useMapStore } from '@/store/mapStore';
import { colors } from '@/styles/colors';
import { spacing } from '@/styles/spacing';
import { AUSTRALIA_REGION } from '@/lib/constants';
import type { BeachWithConditions } from '@/types/beach';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState<Region | null>(null);
  // Snapshot of the selected beach — stored on press so the overlay never
  // disappears when the map region shifts and `beaches` briefly reloads.
  const [selectedBeachData, setSelectedBeachData] = useState<BeachWithConditions | null>(null);

  const { location, setLocation, setPermissionGranted } = useLocationStore();
  const { selectedBeachId, setSelectedBeach, filters, pendingFocusBeach, setPendingFocusBeach } = useMapStore();

  const { data: beaches = [], isLoading, tooZoomedOut } = useVisibleBeaches(region, filters);

  // Snap points — ~75% of the previous ['15%','45%','85%']
  const snapPoints = useMemo(() => ['11%', '34%', '64%'], []);

  // Debounced region update — avoids hammering DB on every scroll frame
  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => setRegion(newRegion), 500);
  }, []);

  // Request location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        }, 800);
      }
    })();
  }, []);

  // Navigate to a beach focused from the Explore screen
  useEffect(() => {
    if (!pendingFocusBeach) return;
    setSelectedBeach(pendingFocusBeach.id);
    mapRef.current?.animateToRegion({
      latitude:       pendingFocusBeach.lat - 0.05 * 0.28, // offset south → beach at top
      longitude:      pendingFocusBeach.lng,
      latitudeDelta:  0.05,
      longitudeDelta: 0.05,
    }, 800);
    bottomSheetRef.current?.snapToIndex(0); // minimise sheet so overlay has room
    setPendingFocusBeach(null);
  }, [pendingFocusBeach]);

  const handleMarkerPress = useCallback((beach: BeachWithConditions) => {
    setSelectedBeach(beach.id);
    setSelectedBeachData(beach);             // snapshot — survives a data reload
    bottomSheetRef.current?.snapToIndex(0); // minimise sheet; overlay takes over
    // Shift the map so the beach pin sits in the upper-centre of the screen,
    // clear of the overlay card that floats at the bottom.
    // Keep current zoom; move centre 28% of latitudeDelta south of the beach
    // → beach appears in the top ~30% of the viewport.
    const delta = region ?? { latitudeDelta: 0.3, longitudeDelta: 0.3 };
    mapRef.current?.animateToRegion({
      latitude:       beach.lat - delta.latitudeDelta  * 0.28,
      longitude:      beach.lng,
      latitudeDelta:  delta.latitudeDelta,
      longitudeDelta: delta.longitudeDelta,
    }, 450);
  }, [region]);

  const handleBeachPress = useCallback((beach: BeachWithConditions) => {
    router.push(`/beach/${beach.id}`);
  }, []);

  // Keep selectedBeachData fresh if conditions update in a subsequent load,
  // but never clear it during loading (that would flicker the overlay away).
  useEffect(() => {
    if (!selectedBeachId) { setSelectedBeachData(null); return; }
    const fresh = beaches.find((b) => b.id === selectedBeachId);
    if (fresh) setSelectedBeachData(fresh);
  }, [selectedBeachId, beaches]);

  const sheetTitle = tooZoomedOut
    ? 'Zoom in to see beaches'
    : isLoading
    ? 'Finding beaches…'
    : `${beaches.length} beach${beaches.length !== 1 ? 'es' : ''} in view`;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={AUSTRALIA_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={DARK_MAP_STYLE}
        onPress={() => { setSelectedBeach(null); setSelectedBeachData(null); }}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {beaches.map((beach) => (
          <BeachMarker
            key={beach.id}
            beach={beach}
            isSelected={beach.id === selectedBeachId}
            onPress={() => handleMarkerPress(beach)}
          />
        ))}
      </MapView>

      {/* Filters bar */}
      <View style={styles.filtersContainer}>
        <MapFiltersBar />
      </View>

      {/* My location FAB */}
      <Pressable style={styles.myLocationFab} onPress={async () => {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }, 600);
      }}>
        <Text style={styles.fabIcon}>📍</Text>
      </Pressable>

      {/* Beach conditions overlay — floats above bottom sheet when a beach is selected */}
      {selectedBeachData && (
        <BeachConditionsOverlay
          beach={selectedBeachData}
          onClose={() => { setSelectedBeach(null); setSelectedBeachData(null); }}
        />
      )}

      {/* Bottom sheet — list of beaches in view */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={0}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{sheetTitle}</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : tooZoomedOut ? (
          <Text style={styles.zoomHint}>Pan or zoom in on any coastline to load beaches</Text>
        ) : (
          <BottomSheetFlatList
            data={beaches}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => (
              <BeachPreviewCard
                beach={item}
                onPress={() => handleBeachPress(item)}
                compact
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </BottomSheet>
    </View>
  );
}

// ─── Google Maps "Night" dark style ──────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry',                    stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke',          stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill',            stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality',     elementType: 'labels.text.fill',   stylers: [{ color: '#d59563' }] },
  { featureType: 'poi',                         elementType: 'labels.text.fill',   stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park',                    elementType: 'geometry',            stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park',                    elementType: 'labels.text.fill',   stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road',                        elementType: 'geometry',            stylers: [{ color: '#38414e' }] },
  { featureType: 'road',                        elementType: 'geometry.stroke',     stylers: [{ color: '#212a37' }] },
  { featureType: 'road',                        elementType: 'labels.text.fill',   stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway',               elementType: 'geometry',            stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway',               elementType: 'geometry.stroke',     stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway',               elementType: 'labels.text.fill',   stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit',                     elementType: 'geometry',            stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station',            elementType: 'labels.text.fill',   stylers: [{ color: '#d59563' }] },
  { featureType: 'water',                       elementType: 'geometry',            stylers: [{ color: '#17263c' }] },
  { featureType: 'water',                       elementType: 'labels.text.fill',   stylers: [{ color: '#515c6d' }] },
  { featureType: 'water',                       elementType: 'labels.text.stroke',  stylers: [{ color: '#17263c' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersContainer: {
    position: 'absolute',
    top: 55,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  myLocationFab: {
    position: 'absolute',
    right: spacing.md,
    bottom: '20%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  fabIcon: { fontSize: 22 },
  sheetBackground: { backgroundColor: colors.gray100, borderRadius: 20 },
  sheetHandle: { backgroundColor: colors.gray300 },
  sheetHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: colors.gray700 },
  zoomHint: {
    textAlign: 'center',
    color: colors.gray600,
    marginTop: spacing.xl,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
  },
});
