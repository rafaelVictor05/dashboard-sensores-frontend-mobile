import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeProvider';
import axios from 'axios';

const API_URL = 'http://172.174.21.128:4000';

const RegisterScreen = () => {
  const { background, text, button, card, error } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!email || !password || !confirmPassword) {
      setErrorMsg('Preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      // Verifica se o email já está cadastrado
      const existsRes = await axios.get(`${API_URL}/exists`, { params: { email } });
      if (existsRes.data.exists) {
        setErrorMsg('Email já cadastrado.');
        setLoading(false);
        return;
      }
      // Realiza o cadastro
      const res = await axios.post(`${API_URL}/register`, { email, password });
      if (res.data && (res.data.userId || res.data.id)) {
        setSuccessMsg('Cadastro realizado com sucesso!');
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else {
        setErrorMsg('Erro ao cadastrar.');
      }
    } catch (e: any) {
      setErrorMsg('Erro ao conectar com o servidor.');
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>  
      <View style={[styles.card, { backgroundColor: card }]}>  
        <Text style={[styles.title, { color: text }]}>Cadastro</Text>
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
        <TextInput
          style={[styles.input, { color: text, borderColor: button }]}
          placeholder="Confirme a senha"
          placeholderTextColor="#888"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        {errorMsg ? <Text style={{ color: error, marginBottom: 8 }}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={{ color: 'green', marginBottom: 8 }}>{successMsg}</Text> : null}
        <TouchableOpacity style={[styles.button, { backgroundColor: button }]} onPress={handleRegister} disabled={loading}>
          <Text style={{ color: text }}>{loading ? 'Cadastrando...' : 'Cadastrar'}</Text>
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
});

export default RegisterScreen;
