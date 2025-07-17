import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter(); // Fixed: was "routear"

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      if (!email || !password) {
        setError('Please enter both email and password');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link.');
        } else if (error.message.includes('Too many requests')) {
          setError('Too many login attempts. Please try again later.');
        } else if (error.message.includes('structuredClone')) {
          setError('Login failed. Please restart the app and try again.');
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        try {
          // First, check if user is a civilian or responder
          const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('user_type, last_login')
            .eq('id', data.user.id)
            .single();

          const { data: responderProfile, error: responderError } = await supabase
            .from('responders')
            .select('responder_type, verification_status')
            .eq('id', data.user.id)
            .single();

          let isFirstLogin = false;
          let userType = null;

          if (userProfile) {
            // User is a civilian
            userType = 'civilian';
            isFirstLogin = !userProfile.last_login;
            
            // Update last login for civilian
            await supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', data.user.id);
              
          } else if (responderProfile) {
            // User is a responder (police or hospital)
            userType = responderProfile.responder_type;
            isFirstLogin = !responderProfile.verification_status; // Assuming first login if not verified
            
            // You might want to track last login for responders too
            // Add a last_login column to responders table if needed
            
          } else {
            // This shouldn't happen if registration worked correctly
            console.error('User profile not found in either table');
            setError('User profile not found. Please contact support.');
            return;
          }

          // Navigate based on user type and first login status
          if (isFirstLogin) {
            router.replace('/welcome');
          } else {
            // You might want different navigation based on user type
            switch (userType) {
              case 'civilian':
                router.replace('/(tabs)');
                break;
              case 'police':
                router.replace('/(police-tabs)'); // Assuming you have police-specific tabs
                break;
              case 'hospital':
                router.replace('/(hospital-tabs)'); // Assuming you have hospital-specific tabs
                break;
              default:
                router.replace('/(tabs)');
            }
          }
        } catch (profileError) {
          console.error('Profile lookup error:', profileError);
          // Still allow login even if profile lookup fails
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.message && err.message.includes('structuredClone')) {
        setError('Login failed. Please restart the app and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Shield size={48} color="#FF4444" />
        <Text style={styles.title}>Emergency Response</Text>
        <Text style={styles.subtitle}>Login to your account</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
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
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor='black'
          editable={!isLoading}
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
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
  },
  errorText: {
    color: '#FF4444',
    marginLeft: 8,
  },
});