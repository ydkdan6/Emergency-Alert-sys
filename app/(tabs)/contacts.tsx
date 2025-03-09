import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Plus, Trash2, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

type Contact = {
  id: string;
  name: string;
  relationship: string;
  phone_number: string;
  email: string;
  is_primary: boolean;
};

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [newContact, setNewContact] = useState({
    name: '',
    relationship: '',
    phone_number: '',
    email: '',
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addContact = async () => {
    try {
      const { error } = await supabase.from('contacts').insert([
        {
          ...newContact,
          is_primary: contacts.length === 0,
        },
      ]);

      if (error) throw error;

      setIsAdding(false);
      setNewContact({ name: '', relationship: '', phone_number: '', email: '' });
      loadContacts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      loadContacts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const setPrimaryContact = async (id: string) => {
    try {
      await supabase.from('contacts').update({ is_primary: false }).neq('id', id);
      const { error } = await supabase.from('contacts').update({ is_primary: true }).eq('id', id);
      if (error) throw error;
      loadContacts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <TouchableOpacity
        style={[styles.primaryBadge, item.is_primary && styles.primaryBadgeActive]}
        onPress={() => setPrimaryContact(item.id)}>
        <Text style={[styles.primaryText, item.is_primary && styles.primaryTextActive]}>
          {item.is_primary ? 'Primary' : 'Set as Primary'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.contactName}>{item.name}</Text>
      <Text style={styles.contactDetail}>{item.relationship}</Text>
      <Text style={styles.contactDetail}>{item.phone_number}</Text>
      <Text style={styles.contactDetail}>{item.email}</Text>

      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteContact(item.id)}>
        <Trash2 size={20} color="#FF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Contacts</Text>

      {error && (
        <View style={styles.errorContainer}>
          <AlertTriangle color="#FF4444" size={20} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isAdding ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={newContact.name}
            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Relationship"
            value={newContact.relationship}
            onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={newContact.phone_number}
            onChangeText={(text) => setNewContact({ ...newContact, phone_number: text })}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={newContact.email}
            onChangeText={(text) => setNewContact({ ...newContact, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setIsAdding(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={addContact}>
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)}>
          <Plus size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Contact</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={contacts}
        renderItem={renderContact}
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
  contactCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  contactDetail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  primaryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  primaryBadgeActive: {
    backgroundColor: '#FF4444',
  },
  primaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  primaryTextActive: {
    color: '#fff',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4444',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f3f5',
  },
  saveButton: {
    backgroundColor: '#FF4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButtonText: {
    color: '#fff',
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