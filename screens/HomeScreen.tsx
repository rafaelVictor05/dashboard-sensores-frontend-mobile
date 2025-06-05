import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeProvider';

const HomeScreen = () => {
  const { background, card, text, button, accent } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { backgroundColor: background }]}>  
      <Text style={[styles.title, { color: text }]}>Bem-vindo ao Smart Home</Text>
      <Text style={[styles.subtitle, { color: text }]}>Selecione um ambiente para visualizar os dados</Text>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: card, borderColor: accent, shadowColor: accent }]}
        onPress={() => navigation.navigate('Dashboard')}
        activeOpacity={0.85}
      >
        <View style={styles.iconContainer}>
          <Image
            source={{ uri: 'https://img.icons8.com/ios-filled/100/bedroom.png' }}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.cardTitle, { color: text }]}>Bedroom</Text>
        <Text style={[styles.cardDesc, { color: accent }]}>Toque para ver temperatura e umidade</Text>
      </TouchableOpacity>
    </View>
  );
};

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
    borderWidth: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
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
