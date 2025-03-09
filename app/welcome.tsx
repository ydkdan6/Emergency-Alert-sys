import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Bell, Users, MapPin } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const WELCOME_STEPS = [
  {
    title: 'Emergency Response System',
    description: 'Your personal safety companion that connects you with emergency services and your trusted contacts instantly.',
    icon: (props: any) => <Shield {...props} />,
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=2000&q=80'
  },
  {
    title: 'Quick Access',
    description: 'Send emergency alerts with a single tap. Your location is automatically shared with responders.',
    icon: (props: any) => <Bell {...props} />,
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=2000&q=80'
  },
];

export default function WelcomeScreen() {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (data?.full_name) {
          setUserName(data.full_name);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleNext = () => {
    if (step < WELCOME_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  const BlurComponent = Platform.OS === 'web' ? View : BlurView;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: WELCOME_STEPS[step].image }}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurComponent intensity={80} style={StyleSheet.absoluteFillObject} tint="dark">
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)']}
          style={StyleSheet.absoluteFillObject}
        />
      </BlurComponent>

      <View style={styles.content}>
        <View style={styles.header}>
          {userName && (
            <Text style={styles.welcome}>Welcome, {userName}!</Text>
          )}
        </View>

        <View style={styles.stepContent}>
          {WELCOME_STEPS[step].icon({ size: 80, color: '#fff' })}
          <Text style={styles.title}>{WELCOME_STEPS[step].title}</Text>
          <Text style={styles.description}>{WELCOME_STEPS[step].description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {WELCOME_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === step && styles.activeDot,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF4444', '#FF6B6B']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonText}>
                {step === WELCOME_STEPS.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  welcome: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    maxWidth: 320,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    padding: 20,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 24,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});