import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, Platform, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ambulance, Slice as Police, Shield, TriangleAlert as AlertTriangle, Clock, MapPin, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../lib/supabase';
import { getAddressFromCoordinates } from '../../lib/geocoding';
import { format } from 'date-fns';

type EmergencyAlert = {
  id: string;
  type: 'police' | 'medical' | 'general';
  status: 'pending' | 'acknowledged' | 'responding' | 'resolved';
  created_at: string;
  latitude: number;
  longitude: number;
  description?: string;
  user_id: string;
  users: {
    full_name: string;
    phone_number: string;
    medical_conditions: string[];
    blood_type: string;
  } | null;
  contacts: {
    name: string;
    relationship: string;
    phone_number: string;
    email: string;
    is_primary: boolean;
  }[];
  // Raw junction table data (for reference, but we flatten it above)
  alert_contacts?: {
    contacts: {
      name: string;
      relationship: string;
      phone_number: string;
      email: string;
      is_primary: boolean;
    };
  }[];
};

type UserProfile = {
  full_name: string;
  phone_number: string;
  medical_conditions: string[];
  blood_type: string;
};

const SAFETY_TIPS = [
  "Stay calm during emergencies - clear thinking saves lives",
  "Keep emergency contacts easily accessible",
  "Learn basic first aid - it could save someone's life",
  "Create a family emergency plan and practice it",
  "Keep emergency supplies in your home and car",
  "Know your evacuation routes and meeting points",
  "Save emergency numbers on speed dial",
  "Keep important documents in a waterproof container",
  "Learn CPR and basic life support",
  "Install smoke detectors and check them monthly"
];

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'civilian' | 'police' | 'hospital' | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [alertAddresses, setAlertAddresses] = useState<{ [key: string]: string }>({});
  const fadeAnim = useState(new Animated.Value(1))[0];
  const router = useRouter();

  useEffect(() => {
    checkUserType();
    getLocation();
  }, []);

  useEffect(() => {
    if (userType === 'civilian') {
      loadUserProfile();
    }
  }, [userType]);

  useEffect(() => {
    if (userType && (userType === 'police' || userType === 'hospital')) {
      loadActiveAlerts(userType);
      setupRealtimeSubscription();
    }
  }, [userType]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();

      setTipIndex((current) => (current + 1) % SAFETY_TIPS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required for emergency services.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setLocation(location);
  };

  const checkUserType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: civilian } = await supabase.from('users').select().eq('id', user.id);
      if (civilian?.length) {
        setUserType('civilian');
        return;
      }

      const { data: responder } = await supabase
        .from('responders')
        .select('responder_type')
        .eq('id', user.id);
      
      if (responder?.length) {
        setUserType(responder[0].responder_type);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadActiveAlerts = async (type: string) => {
  try {
    let query = supabase
      .from('alerts')
      .select(`
        *,
        users!alerts_user_id_fkey (
          full_name,
          phone_number,
          medical_conditions,
          blood_type
        ),
        alert_contacts!alert_contacts_alert_id_fkey (
          contacts!alert_contacts_contact_id_fkey (
            name,
            relationship,
            phone_number,
            email,
            is_primary
          )
        )
      `)
      .not('status', 'eq', 'resolved')
      .order('created_at', { ascending: false });

    // Updated filtering logic
    if (type === 'police') {
      // Police see: police alerts + general (SOS) alerts
      query = query.in('type', ['police', 'general']);
    } else if (type === 'hospital') {
      // Medical see: medical alerts + general (SOS) alerts
      query = query.in('type', ['medical', 'general']);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Transform the data to flatten the contacts structure for easier access
    const transformedData = data?.map(alert => ({
      ...alert,
      contacts: alert.alert_contacts?.map(ac => ac.contacts).filter(Boolean) || []
    })) || [];
    
    setActiveAlerts(transformedData);
    
    // Load addresses for alerts
    if (transformedData && transformedData.length > 0) {
      const addresses: { [key: string]: string } = {};
      await Promise.all(
        transformedData.map(async (alert) => {
          try {
            const address = await getAddressFromCoordinates(
              alert.latitude,
              alert.longitude
            );
            addresses[alert.id] = address;
          } catch (err) {
            addresses[alert.id] = `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`;
          }
        })
      );
      setAlertAddresses(addresses);
    }
  } catch (err: any) {
    setError(err.message);
  }
};

  const setupRealtimeSubscription = () => {
    if (!userType || userType === 'civilian') return;

    let channel;
    
    if (userType === 'police') {
      // Subscribe to police and general alerts
      channel = supabase
        .channel('police-alerts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=in.(police,general)'
          }, 
          () => {
            loadActiveAlerts(userType);
          }
        )
        .subscribe();
    } else if (userType === 'hospital') {
      // Subscribe to medical and general alerts
      channel = supabase
        .channel('medical-alerts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=in.(medical,general)'
          }, 
          () => {
            loadActiveAlerts(userType);
          }
        )
        .subscribe();
    }

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  };

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

      const address = await getAddressFromCoordinates(
        location.coords.latitude,
        location.coords.longitude
      );

      const { data: userData } = await supabase
        .from('users')
        .select()
        .eq('id', user.id)
        .single();

      if (!userData) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: user.id }]);

        if (insertError) throw insertError;
      }

      // Insert alert
      const { error: alertError } = await supabase
        .from('alerts')
        .insert({
          user_id: user.id,
          type,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          status: 'pending',
          description: `Emergency alert sent from ${address}`
        });

      if (alertError) throw alertError;

      const alertTypeMessage = type === 'general' ? 'Emergency SOS' : 
                             type === 'police' ? 'Police emergency' : 'Medical emergency';

      Alert.alert(
        'Alert Sent',
        `${alertTypeMessage} services have been notified and are on their way to ${address}`,
        [{ text: 'View Status', onPress: () => router.push('/alerts') }]
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: EmergencyAlert['status']) => {
    switch (status) {
      case 'pending':
        return '#FF4444';
      case 'acknowledged':
        return '#FFB020';
      case 'responding':
        return '#3366FF';
      default:
        return '#666';
    }
  };

  const getTypeLabel = (type: EmergencyAlert['type']) => {
    switch (type) {
      case 'police':
        return 'Police Emergency';
      case 'medical':
        return 'Medical Emergency';
      case 'general':
        return 'Emergency SOS';
      default:
        return 'Emergency';
    }
  };

  const BlurComponent = Platform.OS === 'web' ? View : BlurView;

  if (userType === 'police' || userType === 'hospital') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#f8f9fa', '#e9ecef']}
          style={styles.responderContent}>
          <View style={styles.header}>
            <Shield size={48} color="#FF4444" />
            <Text style={styles.title}>Active Alerts</Text>
            <Text style={styles.subtitle}>
              {userType === 'police' ? 'Police & Emergency SOS' : 'Medical & Emergency SOS'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <AlertTriangle color="#FF4444" size={20} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.alertsList}>
            {activeAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertType}>
                    {getTypeLabel(alert.type)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(alert.status) }]}>
                    <Text style={styles.statusText}>{alert.status}</Text>
                  </View>
                </View>

                <View style={styles.alertInfo}>
                  <View style={styles.infoRow}>
                    <Clock size={16} color="#666" />
                    <Text style={styles.infoText}>
                      {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MapPin size={16} color="#666" />
                    <Text style={styles.infoText}>
                      {alertAddresses[alert.id] || `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`}
                    </Text>
                  </View>
                  
                  {/* User Contact Information */}
                  {alert.users && (
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactTitle}>Contact Information:</Text>
                      <Text style={styles.contactText}>Name: {alert.users.full_name || 'N/A'}</Text>
                      <Text style={styles.contactText}>Phone: {alert.users.phone_number || 'N/A'}</Text>
                      {alert.users.blood_type && (
                        <Text style={styles.contactText}>Blood Type: {alert.users.blood_type}</Text>
                      )}
                      {alert.users.medical_conditions && alert.users.medical_conditions.length > 0 && (
                        <Text style={styles.contactText}>
                          Medical Conditions: {alert.users.medical_conditions.join(', ')}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Emergency Contacts */}
                  {alert.users && alert.users.contacts && alert.users.contacts.length > 0 && (
                    <View style={styles.emergencyContacts}>
                      <Text style={styles.contactTitle}>Emergency Contacts:</Text>
                      {alert.users.contacts.map((contact, index) => (
                        <View key={index} style={styles.emergencyContact}>
                          <Text style={styles.contactText}>
                            {contact.name} ({contact.relationship})
                          </Text>
                          <Text style={styles.contactText}>Phone: {contact.phone_number}</Text>
                          {contact.email && (
                            <Text style={styles.contactText}>Email: {contact.email}</Text>
                          )}
                          {contact.is_primary && (
                            <Text style={styles.primaryContact}>Primary Contact</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => router.push('/alerts')}>
                  <Text style={styles.viewDetailsText}>View Details & Respond</Text>
                </TouchableOpacity>
              </View>
            ))}

            {activeAlerts.length === 0 && (
              <View style={styles.noAlerts}>
                <Text style={styles.noAlertsText}>No active alerts at this time</Text>
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

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
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Shield size={48} color="#FF4444" />
            <Text style={styles.title}>Emergency Response</Text>
            <Text style={styles.subtitle}>Quick Access Emergency Services</Text>
          </View>

          {userProfile && (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <User size={24} color="#FF4444" />
                <Text style={styles.profileTitle}>Personal Information</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileText}>Name: {userProfile?.full_name || 'Not set'}</Text>
                <Text style={styles.profileText}>Phone: {userProfile?.phone_number || 'Not set'}</Text>
                <Text style={styles.profileText}>Blood Type: {userProfile?.blood_type || 'Not set'}</Text>
              </View>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => router.push('/settings')}>
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          <Animated.View style={[styles.tipContainer, { opacity: fadeAnim }]}>
            <Text style={styles.tipTitle}>Safety Tip</Text>
            <Text style={styles.tipText}>{SAFETY_TIPS[tipIndex]}</Text>
          </Animated.View>

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
        </ScrollView>

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
  responderContent: {
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
    borderRadius: 50,
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
    borderRadius: 40,
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
  alertsList: {
    flex: 1,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  alertInfo: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  contactInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  emergencyContacts: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  emergencyContact: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  primaryContact: {
    fontSize: 12,
    color: '#FF4444',
    fontWeight: '600',
  },
  viewDetailsButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewDetailsText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
  },
  noAlerts: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noAlertsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  profileInfo: {
    gap: 8,
  },
  profileText: {
    fontSize: 16,
    color: '#666',
  },
  editProfileButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  editProfileText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  tipContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});