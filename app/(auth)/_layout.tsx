import { Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return null;
  }

  // Redirect to main app if authenticated
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}