/**
 * BeachDawgs — Map Screen (main tab)
 *
 * Full-screen map with color-coded beach markers.
 * Beaches are loaded for the current viewport; zooming out past
 * MAX_VISIBLE_DELTA hides markers to avoid overloading the map.
 * Bottom sheet shows a sorted list of visible beaches.
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

  const { location, setLocation, setPermissionGranted } = useLocationStore();
  const { selectedBeachId, setSelectedBeach, filters, pendingFocusBeach, setPendingFocusBeach } = useMapStore();

  const { data: beaches = [], isLoading, tooZoomedOut } = useVisibleBeaches(region, filters);

  const snapPoints = useMemo(() => ['15%', '45%', '85%'], []);

  // Debounced region update — avoids hammering DB on every scroll frame
  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => setRegion(newRegion), 500);
  }, []);

  // Request location on mount if not already granted
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
      latitude: pendingFocusBeach.lat,
      longitude: pendingFocusBeach.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 800);
    bottomSheetRef.current?.snapToIndex(1);
    setPendingFocusBeach(null);
  }, [pendingFocusBeach]);

  const handleMarkerPress = useCallback((beachId: string) => {
    setSelectedBeach(beachId);
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  const handleBeachPress = useCallback((beach: BeachWithConditions) => {
    router.push(`/beach/${beach.id}`);
  }, []);

  const selectedBeach = useMemo(
    () => beaches.find((b) => b.id === selectedBeachId) ?? null,
    [beaches, selectedBeachId]
  );

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
        onPress={() => setSelectedBeach(null)}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {beaches.map((beach) => (
          <BeachMarker
            key={beach.id}
            beach={beach}
            isSelected={beach.id === selectedBeachId}
            onPress={() => handleMarkerPress(beach.id)}
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

      {/* Bottom sheet */}
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

        {selectedBeach && (
          <BeachPreviewCard
            beach={selectedBeach}
            onPress={() => handleBeachPress(selectedBeach)}
          />
        )}

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
    backgroundColor: colors.white,
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
  sheetBackground: { backgroundColor: colors.white, borderRadius: 20 },
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
    color: colors.gray400,
    marginTop: spacing.xl,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
  },
});
