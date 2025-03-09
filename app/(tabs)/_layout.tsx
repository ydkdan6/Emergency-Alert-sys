import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Chrome as Home, Bell, Users, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  const { session, isLoading } = useAuth();
  const [userType, setUserType] = useState<'civilian' | 'police' | 'hospital' | null>(null);

  useEffect(() => {
    if (session?.user) {
      checkUserType();
    }
  }, [session]);

  const checkUserType = async () => {
    try {
      const { data: civilian } = await supabase
        .from('users')
        .select()
        .eq('id', session!.user.id);
      
      if (civilian?.length) {
        setUserType('civilian');
        return;
      }

      const { data: responder } = await supabase
        .from('responders')
        .select('responder_type')
        .eq('id', session!.user.id);
      
      if (responder?.length) {
        setUserType(responder[0].responder_type);
      }
    } catch (error) {
      console.error('Error checking user type:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF4444',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      {(userType === 'civilian' || userType === 'hospital') && (
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contacts',
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}