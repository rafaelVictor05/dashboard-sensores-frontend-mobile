import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeProvider';
import axios from 'axios';

const API_URL = 'http://172.174.21.128:4000';

const LoginScreen = () => {
  const { background, text, button, card } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      if (res.data && res.data.token) {
        // salvar token
        navigation.navigate('Home');
      } else {
        setErrorMsg('Email ou senha inválidos.');
      }
    } catch (e: any) {
      setErrorMsg('Erro ao conectar ou credenciais inválidas.');
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>  
      <View style={[styles.card, { backgroundColor: card }]}>  
        <Text style={[styles.title, { color: text }]}>Login</Text>
        <TextInput
          style={[styles.input, { color: text, borderColor: button }]}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { color: text, borderColor: button }]}
          placeholder="Senha"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {errorMsg ? <Text style={{ color: 'red', marginBottom: 8 }}>{errorMsg}</Text> : null}
        <TouchableOpacity style={[styles.button, { backgroundColor: button }]} onPress={handleLogin} disabled={loading}>
          <Text style={{ color: text }}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkContainer}>
          <Text style={[styles.link, { color: text }]}>Não tem uma conta? Cadastre-se</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', padding: 24, borderRadius: 16, elevation: 4 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  linkContainer: { marginTop: 16 },
  link: { textAlign: 'center', textDecorationLine: 'underline' },
});

export default LoginScreen;
