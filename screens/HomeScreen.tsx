import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeProvider';
import axios from 'axios';

const API_URL = 'http://172.174.21.128:4000/data';

const HomeScreen = () => {
  const { background, card, text, button, accent } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(API_URL)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Extrai localizações únicas dos dados
  const locations = Array.from(new Set(data.map(d => d.location)));

  if (loading) {
    return <View style={[styles.container, { backgroundColor: background }]}><Text style={{ color: text }}>Carregando...</Text></View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ alignItems: 'center', padding: 24 }}>
      <Text style={[styles.title, { color: text }]}>Bem-vindo ao Smart Home</Text>
      <Text style={[styles.subtitle, { color: text }]}>Selecione um ambiente para visualizar os dados</Text>
      {locations.map(loc => (
        <TouchableOpacity
          key={loc}
          style={[
            styles.card,
            {
              backgroundColor: card,
              borderColor: accent,
              shadowColor: accent,
              marginBottom: 18,
              borderWidth: 0,
              elevation: 6,
              shadowOpacity: 0.22,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            },
          ]}
          onPress={() => navigation.navigate('Dashboard', { location: loc })}
          activeOpacity={0.92}
        >
          <View style={styles.iconContainer}>
            <Image
              source={{ uri: getLocationIcon(loc) }}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>
          <Text style={{
            color: text,
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 8,
            letterSpacing: 1,
            textTransform: 'capitalize',
            textAlign: 'center',
          }}>{loc}</Text>
          <Text style={{
            color: '#B0B3B8', // cinza médio
            fontSize: 15,
            fontWeight: '500',
            textAlign: 'center',
            opacity: 1,
            marginBottom: 2,
          }}>
            toque para ver os dados
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// Função para retornar um ícone genérico por localização
function getLocationIcon(loc: string) {
  if (/bedroom/i.test(loc)) return 'https://img.icons8.com/ios-filled/100/bedroom.png';
  if (/living/i.test(loc)) return 'https://img.icons8.com/ios-filled/100/living-room.png';
  if (/kitchen/i.test(loc)) return 'https://img.icons8.com/ios-filled/100/kitchen-room.png';
  if (/bath/i.test(loc)) return 'https://img.icons8.com/ios-filled/100/bath.png';
  if (/office|escritorio/i.test(loc)) return 'https://img.icons8.com/ios-filled/100/office.png';
  return 'https://img.icons8.com/ios-filled/100/room.png';
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', letterSpacing: 1 },
  subtitle: { fontSize: 16, marginBottom: 32, textAlign: 'center', color: '#A5A7B0' },
  card: {
    width: 260,
    height: 180,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
    marginTop: 12,
    padding: 18,
  },
  iconContainer: {
    backgroundColor: '#23252B',
    borderRadius: 50,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    width: 48,
    height: 48,
    tintColor: '#5C9EFF',
  },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  cardDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
});

export default HomeScreen;
