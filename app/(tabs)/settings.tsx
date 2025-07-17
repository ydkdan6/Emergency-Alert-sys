import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { TriangleAlert as AlertTriangle, LogOut, Bell, User, Shield } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync } from '../../lib/notifications';

type UserProfile = {
  full_name: string;
  phone_number: string;
  medical_conditions: string[];
  blood_type: string;
};

type ResponderProfile = {
  organization_name: string;
  jurisdiction: string;
  verification_status: boolean;
};

export default function SettingsScreen() {
  const [userType, setUserType] = useState<'civilian' | 'police' | 'hospital' | null>(null);
  const [profile, setProfile] = useState<UserProfile | ResponderProfile | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const setupNotifications = async (determinedUserType: 'civilian' | 'police' | 'hospital') => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Store token in Supabase for the user
        const table = determinedUserType === 'civilian' ? 'users' : 'responders';
        const { error } = await supabase
          .from(table)
          .update({ push_token: token })
          .eq('id', user.id);

        if (error) {
          console.error('Push token update error:', error);
          // Don't show error to user if it's just a missing column
          if (error.code !== 'PGRST204') {
            setError('Failed to setup notifications');
          }
        }
      }
    } catch (err: any) {
      console.error('Setup notifications error:', err);
      setError('Failed to setup notifications');
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace('/login');
        return;
      }

      // Check if user is civilian first
      const { data: civilian, error: civilianError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no row exists

      if (civilianError) {
        console.error('Civilian query error:', civilianError);
      }

      if (civilian) {
        setUserType('civilian');
        setProfile({
          full_name: civilian.full_name || '',
          phone_number: civilian.phone_number || '',
          medical_conditions: civilian.medical_conditions || [],
          blood_type: civilian.blood_type || ''
        });
        await setupNotifications('civilian');
        setLoading(false);
        return;
      }

      // Check if user is responder
      const { data: responder, error: responderError } = await supabase
        .from('responders')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (responderError) {
        console.error('Responder query error:', responderError);
      }

      if (responder) {
        const responderType = responder.responder_type as 'police' | 'hospital';
        setUserType(responderType);
        setProfile({
          organization_name: responder.organization_name || '',
          jurisdiction: responder.jurisdiction || '',
          verification_status: responder.verification_status || false
        });
        await setupNotifications(responderType);
        setLoading(false);
        return;
      }

      // If neither civilian nor responder found
      setError('User profile not found');
      setLoading(false);
    } catch (err: any) {
      console.error('Load profile error:', err);
      setError(err.message || 'Failed to load profile');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveProfile = async () => {
    try {
      if (!profile || !userType) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const table = userType === 'civilian' ? 'users' : 'responders';
      const { error } = await supabase
        .from(table)
        .update(profile)
        .eq('id', user.id);

      if (error) throw error;
      setIsEditing(false);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderCivilianProfile = () => {
    const civilianProfile = profile as UserProfile;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        {isEditing ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={civilianProfile?.full_name || ''}
              onChangeText={(text) => setProfile({ ...civilianProfile, full_name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={civilianProfile?.phone_number || ''}
              onChangeText={(text) => setProfile({ ...civilianProfile, phone_number: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Blood Type"
              value={civilianProfile?.blood_type || ''}
              onChangeText={(text) => setProfile({ ...civilianProfile, blood_type: text })}
            />
          </>
        ) : (
          <>
            <Text style={styles.profileText}>Name: {civilianProfile?.full_name || 'Not provided'}</Text>
            <Text style={styles.profileText}>Phone: {civilianProfile?.phone_number || 'Not provided'}</Text>
            <Text style={styles.profileText}>Blood Type: {civilianProfile?.blood_type || 'Not provided'}</Text>
          </>
        )}
      </View>
    );
  };

  const renderResponderProfile = () => {
    const responderProfile = profile as ResponderProfile;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organization Information</Text>
        {isEditing ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Organization Name"
              value={responderProfile?.organization_name || ''}
              onChangeText={(text) =>
                setProfile({ ...responderProfile, organization_name: text })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Jurisdiction"
              value={responderProfile?.jurisdiction || ''}
              onChangeText={(text) =>
                setProfile({ ...responderProfile, jurisdiction: text })
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.profileText}>
              Organization: {responderProfile?.organization_name || 'Not provided'}
            </Text>
            <Text style={styles.profileText}>
              Jurisdiction: {responderProfile?.jurisdiction || 'Not provided'}
            </Text>
            <Text style={styles.profileText}>
              Status: {responderProfile?.verification_status ? 'Verified' : 'Pending Verification'}
            </Text>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Shield size={48} color="#FF4444" />
        <Text style={styles.title}>Settings</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.content}>
        {userType === 'civilian' ? renderCivilianProfile() : renderResponderProfile()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.preference}>
            <View style={styles.preferenceText}>
              <Bell size={20} color="#666" />
              <Text style={styles.preferenceLabel}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ddd', true: '#FF4444' }}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveProfile}>
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save Changes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => setIsEditing(true)}>
              <User size={20} color="#FF4444" />
              <Text style={[styles.buttonText, styles.editButtonText]}>Edit Profile</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
            <LogOut size={20} color="#fff" />
            <Text style={[styles.buttonText, styles.logoutButtonText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  profileText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  saveButton: {
    backgroundColor: '#FF4444',
  },
  cancelButton: {
    backgroundColor: '#f1f3f5',
  },
  logoutButton: {
    backgroundColor: '#FF4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editButtonText: {
    color: '#FF4444',
  },
  saveButtonText: {
    color: '#fff',
  },
  logoutButtonText: {
    color: '#fff',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    margin: 20,
  },
  errorText: {
    color: '#FF4444',
    marginLeft: 8,
  },
});