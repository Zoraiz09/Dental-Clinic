// Shared shadow presets — style objects that work on native (shadow*/elevation)
// and web (react-native-web translates shadow* → box-shadow automatically).
// Replace every inline '#5E472E' shadow object with one of these presets.
import { StyleSheet } from 'react-native';

export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fab: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
