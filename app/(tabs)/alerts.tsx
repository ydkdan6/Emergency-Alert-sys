import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Clock, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

type Alert = {
  id: string;
  type: 'police' | 'medical' | 'general';
  status: 'pending' | 'acknowledged' | 'responding' | 'resolved';
  created_at: string;
  latitude: number;
  longitude: number;
  responses: Response[];
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

  useEffect(() => {
    checkUserType();
    loadAlerts();
  }, []);

  const checkUserType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: civilian } = await supabase.from('users').select().eq('id', user.id);
      if (civilian?.length) {
        setUserType('civilian');
        return;
      }

      const { data: responder } = await supabase
        .from('responders')
        .select('responder_type')
        .eq('id', user.id);
      if (responder?.length) {
        setUserType(responder[0].responder_type);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase.from('alerts').select(`
        *,
        responses (
          *,
          responder:responders (organization_name, responder_type)
        )
      `);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      setAlerts(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateAlertStatus = async (alertId: string, status: Alert['status']) => {
    try {
      const { error } = await supabase.from('alerts').update({ status }).eq('id', alertId);
      if (error) throw error;

      await supabase.from('responses').insert({
        alert_id: alertId,
        action_taken: `Status updated to ${status}`,
      });

      loadAlerts();
    } catch (err: any) {
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
        return 'General Emergency';
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
            {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
          </Text>
        </View>
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
              <Text style={styles.responseTime}>
                {format(new Date(response.created_at), 'MMM d, h:mm a')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Alerts</Text>

      {error && (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1a1a1a',
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
  },
});