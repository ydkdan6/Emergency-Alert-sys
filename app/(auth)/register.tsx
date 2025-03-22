import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Shield, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

type UserType = 'civilian' | 'police' | 'hospital';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [userType, setUserType] = useState<UserType>('civilian');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!user) throw new Error('Registration failed');

      if (userType === 'civilian') {
        const { error: profileError } = await supabase.from('users').insert({
          id: user.id,
          full_name: fullName,
        });
        if (profileError) throw profileError;
      } else {
        const { error: responderError } = await supabase.from('responders').insert({
          id: user.id,
          organization_name: organizationName,
          responder_type: userType,
        });
        if (responderError) throw responderError;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Shield size={48} color="#FF4444" />
        <Text style={styles.title}>Emergency Response</Text>
        <Text style={styles.subtitle}>Create your account</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <View style={styles.userTypeContainer}>
          <TouchableOpacity
            style={[styles.userTypeButton, userType === 'civilian' && styles.userTypeButtonActive]}
            onPress={() => setUserType('civilian')}>
            <Text style={[styles.userTypeText, userType === 'civilian' && styles.userTypeTextActive]}>
              Civilian
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.userTypeButton, userType === 'police' && styles.userTypeButtonActive]}
            onPress={() => setUserType('police')}>
            <Text style={[styles.userTypeText, userType === 'police' && styles.userTypeTextActive]}>
              Police
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.userTypeButton, userType === 'hospital' && styles.userTypeButtonActive]}
            onPress={() => setUserType('hospital')}>
            <Text style={[styles.userTypeText, userType === 'hospital' && styles.userTypeTextActive]}>
              Hospital
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor='black'
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor='black'
        />
        {userType === 'civilian' ? (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor='black'
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Organization Name"
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholderTextColor='black'

          />
        )}

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>
            Login
          </Link>
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
    marginTop: 60,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  form: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  userTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  userTypeButtonActive: {
    backgroundColor: '#FF4444',
  },
  userTypeText: {
    color: '#666',
    fontWeight: '500',
  },
  userTypeTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#666',
  },
  link: {
    color: '#FF4444',
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  errorText: {
    color: '#FF4444',
    marginLeft: 8,
  },
});