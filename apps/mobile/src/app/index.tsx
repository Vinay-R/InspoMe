import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand, radius, spacing } from '@inspome/shared';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brandMark} />
        <ThemedText type="title" style={styles.title}>
          InspoMe
        </ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          Save the content you admire. Understand why it works.
        </ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          Mobile scaffold — auth and share-in land next.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radius.xl - 2,
    backgroundColor: brand.DEFAULT,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
