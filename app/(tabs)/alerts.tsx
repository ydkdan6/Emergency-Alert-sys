import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Clock, MapPin, User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { getAddressFromCoordinates } from '../../lib/geocoding';

type Alert = {
  id: string;
  type: 'police' | 'medical' | 'general';
  status: 'pending' | 'acknowledged' | 'responding' | 'resolved';
  created_at: string;
  latitude: number;
  longitude: number;
  responses: Response[];
  user_id: string;
  address: string;
  description?: string;
  user: {
    full_name: string;
    phone_number: string;
    email: string;
  };
  primary_contact?: {
    name: string;
    phone_number: string;
    email?: string;
    relationship?: string;
  };
};

type Response = {
  id: string;
  action_taken: string;
  created_at: string;
  responder: {
    organization_name: string;
    responder_type: string;
  };
};

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'civilian' | 'police' | 'hospital' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    if (userType !== null) {
      loadAlerts();
      setupRealtimeSubscription();
    }
  }, [userType]);

  const initializeScreen = async () => {
    await checkUserType();
  };

  const checkUserType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // Check if user is a civilian
      const { data: civilian } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (civilian) {
        setUserType('civilian');
        return;
      }

      // Check if user is a responder
      const { data: responder } = await supabase
        .from('responders')
        .select('responder_type')
        .eq('id', user.id)
        .single();
      
      if (responder) {
        setUserType(responder.responder_type);
      } else {
        setError('User type not found');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Error checking user type:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const loadAlerts = async () => {
    if (!userType) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      let query = supabase.from('alerts').select(`
        *,
        user:users!alerts_user_id_fkey (
          full_name,
          phone_number,
          email
        ),
        responses (
          *,
          responder:responders (organization_name, responder_type)
        )
      `);

      // Apply filters based on user type
      if (userType === 'civilian') {
        query = query.eq('user_id', user.id);
      } else if (userType === 'police') {
        // Police should see police alerts and general emergency SOS alerts
        query = query.or('type.eq.police,type.eq.general');
      } else if (userType === 'hospital') {
        // Medical should see medical alerts and general emergency SOS alerts
        query = query.or('type.eq.medical,type.eq.general');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading alerts:', error);
        throw error;
      }

      // For alerts without an address, fetch it using geocoding
      // Also fetch primary contact for each alert
      const alertsWithAddressesAndContacts = await Promise.all(
        (data || []).map(async (alert) => {
          let address = '';
          if (alert.latitude && alert.longitude) {
            try {
              address = await getAddressFromCoordinates(alert.latitude, alert.longitude);
            } catch (geocodingError) {
              console.error('Geocoding error:', geocodingError);
              address = `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`;
            }
          }

          // Fetch primary contact for this alert's user
          let primaryContact = null;
          try {
            const { data: contactData } = await supabase
              .from('contacts')
              .select('name, phone_number, email, relationship')
              .eq('user_id', alert.user_id)
              .eq('is_primary', true)
              .single();
            
            if (contactData) {
              primaryContact = contactData;
            }
          } catch (contactError) {
            console.error('Error fetching primary contact:', contactError);
          }

          return { 
            ...alert, 
            address,
            primary_contact: primaryContact 
          };
        })
      );

      setAlerts(alertsWithAddressesAndContacts);
      setError('');
    } catch (err: any) {
      console.error('Error loading alerts:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!userType || !currentUserId) return;

    let channel;
    
    if (userType === 'civilian') {
      // Subscribe to user's own alerts
      channel = supabase
        .channel('user-alerts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: `user_id=eq.${currentUserId}`
          }, 
          () => {
            loadAlerts();
          }
        )
        .subscribe();
    } else if (userType === 'police') {
      // Subscribe to police alerts and general emergency alerts
      channel = supabase
        .channel('police-alerts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=eq.police'
          }, 
          () => {
            loadAlerts();
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=eq.general'
          }, 
          () => {
            loadAlerts();
          }
        )
        .subscribe();
    } else if (userType === 'hospital') {
      // Subscribe to medical alerts and general emergency alerts
      channel = supabase
        .channel('medical-alerts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=eq.medical'
          }, 
          () => {
            loadAlerts();
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'alerts',
            filter: 'type=eq.general'
          }, 
          () => {
            loadAlerts();
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

  const updateAlertStatus = async (alertId: string, status: Alert['status']) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status })
        .eq('id', alertId);
      
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Add response record
      const { error: responseError } = await supabase
        .from('responses')
        .insert({
          alert_id: alertId,
          responder_id: user.id,
          action_taken: `Status updated to ${status}`,
        });

      if (responseError) {
        console.error('Error inserting response:', responseError);
      }

      // Reload alerts to get fresh data
      loadAlerts();
    } catch (err: any) {
      console.error('Error updating alert status:', err);
      setError(err.message);
    }
  };

  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'pending':
        return '#FF4444';
      case 'acknowledged':
        return '#FFB020';
      case 'responding':
        return '#3366FF';
      case 'resolved':
        return '#44B944';
      default:
        return '#666';
    }
  };

  const getTypeLabel = (type: Alert['type']) => {
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

  const renderAlert = ({ item }: { item: Alert }) => (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <Text style={styles.alertType}>{getTypeLabel(item.type)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.alertInfo}>
        <View style={styles.infoRow}>
          <Clock size={16} color="#666" />
          <Text style={styles.infoText}>
            {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={16} color="#666" />
          <Text style={styles.infoText}>
            {item.address || `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`}
          </Text>
        </View>
        {item.description && (
          <View style={styles.infoRow}>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
        
        {/* User Contact Information */}
        {userType !== 'civilian' && item.user && (
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Reporter Details</Text>
            <View style={styles.infoRow}>
              <User size={16} color="#666" />
              <Text style={styles.infoText}>{item.user.full_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.contactLabel}>Phone: </Text>
              <Text style={styles.contactValue}>{item.user.phone_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.contactLabel}>Email: </Text>
              <Text style={styles.contactValue}>{item.user.email}</Text>
            </View>
            
            {/* Primary Contact Information */}
            {item.primary_contact && (
              <View style={styles.emergencyContact}>
                <Text style={styles.contactTitle}>Emergency Contact</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.contactLabel}>Name: </Text>
                  <Text style={styles.contactValue}>{item.primary_contact.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.contactLabel}>Phone: </Text>
                  <Text style={styles.contactValue}>{item.primary_contact.phone_number}</Text>
                </View>
                {item.primary_contact.relationship && (
                  <View style={styles.infoRow}>
                    <Text style={styles.contactLabel}>Relationship: </Text>
                    <Text style={styles.contactValue}>{item.primary_contact.relationship}</Text>
                  </View>
                )}
                {item.primary_contact.email && (
                  <View style={styles.infoRow}>
                    <Text style={styles.contactLabel}>Email: </Text>
                    <Text style={styles.contactValue}>{item.primary_contact.email}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {userType !== 'civilian' && item.status !== 'resolved' && (
        <View style={styles.actionButtons}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FFB020' }]}
              onPress={() => updateAlertStatus(item.id, 'acknowledged')}>
              <Text style={styles.actionButtonText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
          {(item.status === 'acknowledged' || item.status === 'pending') && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#3366FF' }]}
              onPress={() => updateAlertStatus(item.id, 'responding')}>
              <Text style={styles.actionButtonText}>Respond</Text>
            </TouchableOpacity>
          )}
          {item.status === 'responding' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#44B944' }]}
              onPress={() => updateAlertStatus(item.id, 'resolved')}>
              <Text style={styles.actionButtonText}>Mark as Resolved</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {item.responses?.length > 0 && (
        <View style={styles.responses}>
          <Text style={styles.responsesTitle}>Response History</Text>
          {item.responses.map((response) => (
            <View key={response.id} style={styles.responseItem}>
              <Text style={styles.responseText}>{response.action_taken}</Text>
              <Text style={styles.responseOrg}>
                {response.responder?.organization_name} ({response.responder?.responder_type})
              </Text>
              <Text style={styles.responseTime}>
                {format(new Date(response.created_at), 'MMM d, h:mm a')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>
        {userType === 'civilian' 
          ? 'No alerts found. Your emergency alerts will appear here.'
          : 'No active alerts at this time.'
        }
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Alerts</Text>

      {error ? (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError('');
              loadAlerts();
            }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmptyState}
          refreshing={isLoading}
          onRefresh={loadAlerts}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1a1a1a',
    marginTop: 25,
  },
  list: {
    gap: 16,
  },
  alertCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
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
  description: {
    fontSize: 14,
    color: '#1a1a1a',
    fontStyle: 'italic',
  },
  contactSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  contactValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  emergencyContact: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  responses: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 16,
    gap: 12,
  },
  responsesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  responseItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  responseOrg: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  responseTime: {
    fontSize: 12,
    color: '#666',
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
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});