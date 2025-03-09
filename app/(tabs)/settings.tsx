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
  const router = useRouter();

  useEffect(() => {
    loadProfile();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      // Store token in Supabase for the user
      const { error } = await supabase
        .from(userType === 'civilian' ? 'users' : 'responders')
        .update({ push_token: token.data })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        setError('Failed to setup notifications');
      }
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is civilian
      const { data: civilian } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (civilian) {
        setUserType('civilian');
        setProfile(civilian);
        return;
      }

      // Check if user is responder
      const { data: responder } = await supabase
        .from('responders')
        .select('*')
        .eq('id', user.id)
        .single();

      if (responder) {
        setUserType(responder.responder_type);
        setProfile(responder);
      }
    } catch (err: any) {
      setError(err.message);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const table = userType === 'civilian' ? 'users' : 'responders';
      const { error } = await supabase.from(table).update(profile).eq('id', user.id);

      if (error) throw error;
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderCivilianProfile = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Personal Information</Text>
      {isEditing ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={(profile as UserProfile)?.full_name}
            onChangeText={(text) => setProfile({ ...profile, full_name: text } as UserProfile)}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={(profile as UserProfile)?.phone_number}
            onChangeText={(text) => setProfile({ ...profile, phone_number: text } as UserProfile)}
          />
          <TextInput
            style={styles.input}
            placeholder="Blood Type"
            value={(profile as UserProfile)?.blood_type}
            onChangeText={(text) => setProfile({ ...profile, blood_type: text } as UserProfile)}
          />
        </>
      ) : (
        <>
          <Text style={styles.profileText}>Name: {(profile as UserProfile)?.full_name}</Text>
          <Text style={styles.profileText}>Phone: {(profile as UserProfile)?.phone_number}</Text>
          <Text style={styles.profileText}>Blood Type: {(profile as UserProfile)?.blood_type}</Text>
        </>
      )}
    </View>
  );

  const renderResponderProfile = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Organization Information</Text>
      {isEditing ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Organization Name"
            value={(profile as ResponderProfile)?.organization_name}
            onChangeText={(text) =>
              setProfile({ ...profile, organization_name: text } as ResponderProfile)
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Jurisdiction"
            value={(profile as ResponderProfile)?.jurisdiction}
            onChangeText={(text) =>
              setProfile({ ...profile, jurisdiction: text } as ResponderProfile)
            }
          />
        </>
      ) : (
        <>
          <Text style={styles.profileText}>
            Organization: {(profile as ResponderProfile)?.organization_name}
          </Text>
          <Text style={styles.profileText}>
            Jurisdiction: {(profile as ResponderProfile)?.jurisdiction}
          </Text>
          <Text style={styles.profileText}>
            Status:{' '}
            {(profile as ResponderProfile)?.verification_status ? 'Verified' : 'Pending Verification'}
          </Text>
        </>
      )}
    </View>
  );

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