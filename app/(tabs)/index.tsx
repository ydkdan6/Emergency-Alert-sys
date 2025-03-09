import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ambulance, Slice as Police, Shield, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for emergency services.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const sendEmergencyAlert = async (type: 'police' | 'medical' | 'general') => {
    if (!location) {
      setError('Unable to get your location. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First, ensure user exists in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select()
        .eq('id', user.id)
        .single();

      if (!userData) {
        // Create user profile if it doesn't exist
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: user.id }]);

        if (insertError) throw insertError;
      }

      // Now create the alert
      const { error: alertError } = await supabase
        .from('alerts')
        .insert({
          user_id: user.id,
          type,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          status: 'pending',
        });

      if (alertError) throw alertError;

      Alert.alert(
        'Alert Sent',
        'Emergency services have been notified and are on their way.',
        [{ text: 'View Status', onPress: () => router.push('/alerts') }]
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const BlurComponent = Platform.OS === 'web' ? View : BlurView;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1583912086096-8c60d75a53f9?auto=format&fit=crop&w=2000&q=80' }}
        style={StyleSheet.absoluteFillObject}
      />
      
      <BlurComponent intensity={80} style={StyleSheet.absoluteFillObject} tint="light" />

      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']}
        style={styles.content}>
        <View style={styles.header}>
          <Shield size={48} color="#FF4444" />
          <Text style={styles.title}>Emergency Response</Text>
          <Text style={styles.subtitle}>Quick Access Emergency Services</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <AlertTriangle color="#FF4444" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.emergencyButton, styles.sosButton]}
            onPress={() => sendEmergencyAlert('general')}
            disabled={loading}>
            <LinearGradient
              colors={['#FF4444', '#FF6B6B']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}>
              <Shield size={32} color="#fff" />
              <Text style={styles.buttonText}>Emergency SOS</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity
              style={[styles.emergencyButton, styles.policeButton]}
              onPress={() => sendEmergencyAlert('police')}
              disabled={loading}>
              <LinearGradient
                colors={['#4444FF', '#6B6BFF']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>
                <Police size={32} color="#fff" />
                <Text style={styles.buttonText}>Police</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emergencyButton, styles.medicalButton]}
              onPress={() => sendEmergencyAlert('medical')}
              disabled={loading}>
              <LinearGradient
                colors={['#44B944', '#6BDB6B']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>
                <Ambulance size={32} color="#fff" />
                <Text style={styles.buttonText}>Medical</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <BlurComponent intensity={80} style={StyleSheet.absoluteFillObject} tint="light" />
            <Text style={styles.loadingText}>Sending alert...</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    flex: 1,
    gap: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  emergencyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  buttonGradient: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sosButton: {
    flex: 0,
    marginBottom: 16,
  },
  policeButton: {
    flex: 1,
  },
  medicalButton: {
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF4444',
    marginLeft: 8,
    fontSize: 16,
  },
});