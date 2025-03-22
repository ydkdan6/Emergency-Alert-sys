import { Platform } from 'react-native';

const LOCATIONIQ_TOKEN = 'pk.b48ca48498a5d2afe30e014ca0c5d7db';
const LOCATIONIQ_API = 'https://us1.locationiq.com/v1';

export async function getAddressFromCoordinates(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `${LOCATIONIQ_API}/reverse.php?key=${LOCATIONIQ_TOKEN}&lat=${latitude}&lon=${longitude}&format=json`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch address');
    }

    const data = await response.json();
    
    // LocationIQ returns a display_name that includes all address components
    return data.display_name;
  } catch (error) {
    console.error('Error getting address:', error);
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}

export async function getCoordinatesFromAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(
      `${LOCATIONIQ_API}/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(address)}&format=json`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch coordinates');
    }

    const data = await response.json();
    
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting coordinates:', error);
    return null;
  }
}