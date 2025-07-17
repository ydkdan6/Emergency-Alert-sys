import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateForm = () => {
    if (!email || !password) {
      setError('Please fill in all required fields');
      return false;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (userType === 'civilian' && !fullName) {
      setError('Please enter your full name');
      return false;
    }

    if (userType !== 'civilian' && !organizationName) {
      setError('Please enter your organization name');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      // Step 1: Sign up with Supabase Auth
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        // Handle specific auth errors
        if (authError.message.includes('duplicate key value violates unique constraint')) {
          throw new Error('An account with this email already exists');
        } else if (authError.message.includes('Password should be at least')) {
          throw new Error('Password must be at least 6 characters long');
        } else if (authError.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address');
        } else if (authError.message.includes('weak password')) {
          throw new Error('Password is too weak. Please use a stronger password');
        }
        throw authError;
      }

      if (!user) {
        throw new Error('Registration failed. Please try again.');
      }

      // Step 2: Create profile based on user type
      if (userType === 'civilian') {
        const { error: profileError } = await supabase.from('users').insert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim(),
          user_type: userType,
          created_at: new Date().toISOString(),
        });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          if (profileError.message.includes('duplicate key value violates unique constraint')) {
            // Profile already exists, continue
            console.log('User profile already exists');
          } else {
            throw new Error('Failed to create user profile');
          }
        }
      } else {
        // For police and hospital users
        const { error: responderError } = await supabase.from('responders').insert({
          id: user.id,
          email: user.email,
          organization_name: organizationName.trim(),
          responder_type: userType,
          created_at: new Date().toISOString(),
        });

        if (responderError) {
          console.error('Responder creation error:', responderError);
          if (responderError.message.includes('duplicate key value violates unique constraint')) {
            // Responder already exists, continue
            console.log('Responder profile already exists');
          } else {
            throw new Error('Failed to create responder profile');
          }
        }
      }

      // Step 3: Show success message and redirect
      Alert.alert(
        'Registration Successful',
        'Please check your email for verification instructions.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );

    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Set user-friendly error message
      if (err.message.includes('duplicate') || err.message.includes('already exists')) {
        setError('An account with this email already exists. Please try logging in instead.');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
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
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor='black'
          editable={!isLoading}
        />
        {userType === 'civilian' ? (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor='black'
            editable={!isLoading}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Organization Name"
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholderTextColor='black'
            editable={!isLoading}
          />
        )}

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleRegister}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Creating Account...' : 'Register'}
          </Text>
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
  buttonDisabled: {
    backgroundColor: '#ccc',
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