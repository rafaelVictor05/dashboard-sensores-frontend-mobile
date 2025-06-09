import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../ThemeProvider';
import axios from 'axios';
import moment from 'moment';
import { LineChart, BarChart } from 'react-native-svg-charts';
import * as ss from 'simple-statistics';
import { mean, median, std, mode } from 'mathjs';
import { Svg, Rect, Line as SvgLine } from 'react-native-svg'; 
import { useRoute } from '@react-navigation/native';
import { shapiroWilk } from '../utils/testeShapiroWilk';

interface DataItem {
  humidity: string;
  location: string;
  temperature: string;
  timestamp_TTL: number;
}

const API_URL = 'http://172.174.21.128:4000/data';

// Função para gerar bins do histograma
function getHistogram(arr: number[], bins = 8) {
  if (!arr.length) return [];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const step = (max - min) / bins || 1;
  const hist = Array(bins).fill(0);
  arr.forEach(v => {
    let idx = Math.floor((v - min) / step);
    if (idx === bins) idx = bins - 1;
    hist[idx]++;
  });
  return hist;
}

// Função para calcular o erro de Gauss (erf)
function erf(x: number) {
  // Abramowitz and Stegun formula 7.1.26
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// Componente QQ-Plot SVG
const QQPlotSVG = ({ data, width, height, color }: { data: number[], width: number, height: number, color: string }) => {
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  // Quantis teóricos da normal padrão
  const mu = mean(sorted) as number;
  const sigma = (std(sorted) as unknown) as number;
  const quantiles = sorted.map((_, i) => {
    // Posição de probabilidade
    const p = (i + 0.5) / n;
    // Quantil teórico da normal
    return mu + sigma * ss.probit(p);
  });
  // Escalas
  const minX = Math.min(...quantiles);
  const maxX = Math.max(...quantiles);
  const minY = Math.min(...sorted);
  const maxY = Math.max(...sorted);
  const scaleX = (x: number) => ((x - minX) / (maxX - minX || 1)) * (width - 32) + 16;
  const scaleY = (y: number) => height - (((y - minY) / (maxY - minY || 1)) * (height - 32) + 16);
  return (
    <Svg width={width} height={height}>
      {/* Linha de referência y = x */}
      <SvgLine
        x1={scaleX(minX)} y1={scaleY(minX)}
        x2={scaleX(maxX)} y2={scaleY(maxX)}
        stroke="#888" strokeWidth={1} strokeDasharray="4 2"
      />
      {/* Pontos do QQ-plot */}
      {sorted.map((y, i) => (
        <Rect
          key={i}
          x={scaleX(quantiles[i]) - 2}
          y={scaleY(y) - 2}
          width={4}
          height={4}
          fill={color}
        />
      ))}
    </Svg>
  );
};

const DashboardScreen = () => {
  const { background, card, text, accent } = useTheme();
  const route = useRoute();
  // @ts-ignore
  const location = route?.params?.location || 'Escritório';
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(API_URL)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: background }]}><ActivityIndicator color={accent} size="large" /></View>;
  }

  // Filtrar e converter dados
  const filteredData = data.filter(d => d.location === location);
  const tempArr = filteredData.map(d => Number(d.temperature));
  const humArr = filteredData.map(d => Number(d.humidity));
  const timeArr = filteredData.map(d => moment.unix(d.timestamp_TTL).format('HH:mm'));

  // Obter valores mais recentes
  const latest = filteredData.length ? filteredData[filteredData.length - 1] : null;
  const latestTemp = latest ? Number(latest.temperature) : null;
  const latestHum = latest ? Number(latest.humidity) : null;

  // Estatísticas
  const tempStats = {
    media: tempArr.length ? (mean(tempArr) as number) : 0,
    mediana: tempArr.length ? (median(tempArr) as number) : 0,
    moda: tempArr.length ? (mode(tempArr) as number[]) : [],
    desvio: tempArr.length ? (std(tempArr) as unknown as number) : 0,
    assimetria: tempArr.length > 2 ? (ss.sampleSkewness(tempArr) as number) : 0,
    curtose: tempArr.length > 2 && ss.sampleKurtosis ? (ss.sampleKurtosis(tempArr) as number) : 0,
    min: tempArr.length ? Math.min(...tempArr) : 0,
    max: tempArr.length ? Math.max(...tempArr) : 0,
  };

  const humStats = {
    media: humArr.length ? mean(humArr) : 0,
    mediana: humArr.length ? median(humArr) : 0,
    moda: humArr.length ? mode(humArr) : 0,
    desvio: tempArr.length ? (std(humArr) as unknown as number) : 0,
    assimetria: humArr.length > 2 ? ss.sampleSkewness(humArr) : 0,
    curtose: humArr.length > 2 && ss.sampleKurtosis ? ss.sampleKurtosis(humArr) : 0,
    min: humArr.length ? Math.min(...humArr) : 0,
    max: humArr.length ? Math.max(...humArr) : 0,
  };

  // Regressão Linear
  const tempRegression = tempArr.length > 1 ? ss.linearRegression(tempArr.map((y, i) => [i, y])) : { m: 0, b: 0 };
  const humRegression = humArr.length > 1 ? ss.linearRegression(humArr.map((y, i) => [i, y])) : { m: 0, b: 0 };

  // Previsão dos próximos 5 valores
  const tempForecast = tempArr.length > 1
    ? Array.from({ length: 5 }, (_, k) => tempRegression.m * (tempArr.length + k) + tempRegression.b)
    : [];
  const humForecast = humArr.length > 1
    ? Array.from({ length: 5 }, (_, k) => humRegression.m * (humArr.length + k) + humRegression.b)
    : [];

  // Calcular intervalo de 10 minutos para previsões
  let futureTimes: string[] = [];
  if (filteredData.length > 0) {
    const last = filteredData[filteredData.length - 1].timestamp_TTL;
    futureTimes = Array.from({ length: 5 }, (_, k) =>
      moment.unix(last + 600 * (k + 1)).format('HH:mm') // 600 segundos = 10 minutos
    );
  }

  // Histogramas e Boxplots
  const tempHist = getHistogram(tempArr);
  const humHist = getHistogram(humArr);
console.log("temp: ", tempArr);
// --- Distribuição Normal: Teste de Shapiro-Wilk e cálculo de probabilidade ---
let tempNormalPct: string | number = 'Anormal';
const resultado = shapiroWilk(tempArr);
const alpha = 0.05;

if (resultado.pValue > alpha) {
        const mu = mean(tempArr) as number;
        const sigma = (std(tempArr) as unknown) as number;
        const z = (25 - mu) / (sigma || 1e-8);
        const cdf = 0.5 * (1 + erf(z / Math.SQRT2));
        tempNormalPct = ((1 - cdf) * 100).toFixed(1) + '%';
      }
const countEmp = tempArr.reduce((acc, t) => acc + (t > 25 ? 1 : 0), 0);
let tempEmpiricalPct = ((countEmp / tempArr.length) * 100).toFixed(1) + '%';

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.title, { color: text }]}>Dashboard - {location}</Text>
      {/* Cards de valores mais recentes */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={[styles.card, { backgroundColor: card, flex: 1, marginRight: 8, alignItems: 'center' }]}>  
          <Text style={{ color: text, fontSize: 14, marginBottom: 4 }}>Temperatura Atual</Text>
          <Text style={{ color: '#FF5C5C', fontSize: 28, fontWeight: 'bold' }}>
            {latestTemp !== null ? `${latestTemp.toFixed(1)}°C` : '--'}
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: card, flex: 1, marginLeft: 8, alignItems: 'center' }]}>  
          <Text style={{ color: text, fontSize: 14, marginBottom: 4 }}>Umidade Atual</Text>
          <Text style={{ color: '#5C9EFF', fontSize: 28, fontWeight: 'bold' }}>
            {latestHum !== null ? `${latestHum.toFixed(1)}%` : '--'}
          </Text>
        </View>
      </View>
      {/* Gráfico de Linha Temperatura */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Gráfico de Linha - Temperatura</Text>
        <View style={{ height: 140, marginBottom: 8 }}>
          <LineChart
            style={{ height: 120, width: '100%' }}
            data={tempArr}
            svg={{ stroke: '#FF5C5C' }}
            contentInset={{ top: 20, bottom: 20 }}
          />
          {/* Pontos de referência próximos à linha */}
          {tempArr.length > 0 && (
            <>
              {/* Valor inicial */}
              <View style={{ position: 'absolute', left: 0, top: 20 + (100 - ((tempArr[0] - Math.min(...tempArr)) / ((Math.max(...tempArr) - Math.min(...tempArr) || 1)) * 100)) }}>
                <Text style={{ color: '#FF5C5C', fontSize: 10 }}>{tempArr[0].toFixed(1)}°C</Text>
              </View>
              {/* Valor final */}
              <View style={{ position: 'absolute', right: 0, top: 20 + (100 - ((tempArr[tempArr.length-1] - Math.min(...tempArr)) / ((Math.max(...tempArr) - Math.min(...tempArr) || 1)) * 100)) }}>
                <Text style={{ color: '#FF5C5C', fontSize: 10 }}>{tempArr[tempArr.length-1].toFixed(1)}°C</Text>
              </View>
            </>
          )}
        </View>
        {/* Eixo X com horários de referência (início, meio, fim) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 }}>
          {timeArr.length > 0 && [0, Math.floor(timeArr.length / 2), timeArr.length - 1].map((idx, i) => (
            <Text key={i} style={{ color: text, fontSize: 10, flex: 1, textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>{timeArr[idx]}</Text>
          ))}
        </View>
      </View>
      {/* Gráfico de Linha Umidade */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Gráfico de Linha - Umidade</Text>
        <View style={{ height: 140, marginBottom: 8 }}>
          <LineChart
            style={{ height: 120, width: '100%' }}
            data={humArr}
            svg={{ stroke: '#5C9EFF' }}
            contentInset={{ top: 20, bottom: 20 }}
          />
          {/* Pontos de referência próximos à linha */}
          {humArr.length > 0 && (
            <>
              {/* Valor inicial */}
              <View style={{ position: 'absolute', left: 0, top: 20 + (100 - ((humArr[0] - Math.min(...humArr)) / ((Math.max(...humArr) - Math.min(...humArr) || 1)) * 100)) }}>
                <Text style={{ color: '#5C9EFF', fontSize: 10 }}>{humArr[0].toFixed(1)}%</Text>
              </View>
              {/* Valor final */}
              <View style={{ position: 'absolute', right: 0, top: 20 + (100 - ((humArr[humArr.length-1] - Math.min(...humArr)) / ((Math.max(...humArr) - Math.min(...humArr) || 1)) * 100)) }}>
                <Text style={{ color: '#5C9EFF', fontSize: 10 }}>{humArr[humArr.length-1].toFixed(1)}%</Text>
              </View>
            </>
          )}
        </View>
        {/* Eixo X com horários de referência (início, meio, fim) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 }}>
          {timeArr.length > 0 && [0, Math.floor(timeArr.length / 2), timeArr.length - 1].map((idx, i) => (
            <Text key={i} style={{ color: text, fontSize: 10, flex: 1, textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>{timeArr[idx]}</Text>
          ))}
        </View>
      </View>
      {/* Estatísticas Temperatura */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Estatísticas Temperatura</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {/* Coluna 1 */}
          <View style={{ flex: 1 }}>
            <View style={[styles.statCard, { backgroundColor: '#FFE5E5' }]}> 
              <Text style={{ fontSize: 18 }}>🌡️</Text>
              <Text style={{ color: '#B71C1C', fontSize: 13, marginTop: 2 }}>Média</Text>
              <Text style={{ color: '#B71C1C', fontWeight: 'bold', fontSize: 16 }}>{tempStats.media.toFixed(2)}°C</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFE5E5' }]}> 
              <Text style={{ fontSize: 18 }}>🔀</Text>
              <Text style={{ color: '#B71C1C', fontSize: 13, marginTop: 2 }}>Mediana</Text>
              <Text style={{ color: '#B71C1C', fontWeight: 'bold', fontSize: 16 }}>{tempStats.mediana.toFixed(2)}°C</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFE5E5' }]}> 
              <Text style={{ fontSize: 18 }}>🎯</Text>
              <Text style={{ color: '#B71C1C', fontSize: 13, marginTop: 2 }}>Moda</Text>
              <Text style={{ color: '#B71C1C', fontWeight: 'bold', fontSize: 16 }}>{Array.isArray(tempStats.moda) ? tempStats.moda.join(', ') : tempStats.moda}°C</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF3E5', marginTop: 8 }]}> 
              <Text style={{ fontSize: 18 }}>↔️</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2 }}>Assimetria</Text>
              <Text style={{ color: '#B26A00', fontWeight: 'bold', fontSize: 16 }}>{tempStats.assimetria.toFixed(2)}</Text>
            </View>
          </View>
          {/* Coluna 2 */}
          <View style={{ flex: 1 }}>
            <View style={[styles.statCard, { backgroundColor: '#E5F0FF' }]}> 
              <Text style={{ fontSize: 18 }}>📈</Text>
              <Text style={{ color: '#0D47A1', fontSize: 13, marginTop: 2 }}>Máximo</Text>
              <Text style={{ color: '#0D47A1', fontWeight: 'bold', fontSize: 16 }}>{tempStats.max.toFixed(2)}°C</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5F0FF' }]}> 
              <Text style={{ fontSize: 18 }}>📉</Text>
              <Text style={{ color: '#0D47A1', fontSize: 13, marginTop: 2 }}>Mínimo</Text>
              <Text style={{ color: '#0D47A1', fontWeight: 'bold', fontSize: 16 }}>{tempStats.min.toFixed(2)}°C</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5F0FF' }]}> 
              <Text style={{ fontSize: 18 }}>📊</Text>
              <Text style={{ color: '#0D47A1', fontSize: 13, marginTop: 2 }}>Desvio</Text>
              <Text style={{ color: '#0D47A1', fontWeight: 'bold', fontSize: 16 }}>{tempStats.desvio.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF3E5', marginTop: 8 }]}> 
              <Text style={{ fontSize: 18 }}>📐</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2 }}>Curtose</Text>
              <Text style={{ color: '#B26A00', fontWeight: 'bold', fontSize: 16 }}>{tempStats.curtose.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
      {/* Estatísticas Umidade */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Estatísticas Umidade</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {/* Coluna 1 */}
          <View style={{ flex: 1 }}>
            <View style={[styles.statCard, { backgroundColor: '#E5F6FF' }]}> 
              <Text style={{ fontSize: 18 }}>💧</Text>
              <Text style={{ color: '#01579B', fontSize: 13, marginTop: 2 }}>Média</Text>
              <Text style={{ color: '#01579B', fontWeight: 'bold', fontSize: 16 }}>{humStats.media.toFixed(2)}%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5F6FF' }]}> 
              <Text style={{ fontSize: 18 }}>🔀</Text>
              <Text style={{ color: '#01579B', fontSize: 13, marginTop: 2 }}>Mediana</Text>
              <Text style={{ color: '#01579B', fontWeight: 'bold', fontSize: 16 }}>{humStats.mediana.toFixed(2)}%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5F6FF' }]}> 
              <Text style={{ fontSize: 18 }}>🎯</Text>
              <Text style={{ color: '#01579B', fontSize: 13, marginTop: 2 }}>Moda</Text>
              <Text style={{ color: '#01579B', fontWeight: 'bold', fontSize: 16 }}>
                {Array.isArray(humStats.moda) ? humStats.moda.join(', ') : humStats.moda}{humStats.moda ? '%' : ''}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5FFF3', marginTop: 8 }]}> 
              <Text style={{ fontSize: 18 }}>↔️</Text>
              <Text style={{ color: '#00695C', fontSize: 13, marginTop: 2 }}>Assimetria</Text>
              <Text style={{ color: '#00695C', fontWeight: 'bold', fontSize: 16 }}>{humStats.assimetria.toFixed(2)}</Text>
            </View>
          </View>
          {/* Coluna 2 */}
          <View style={{ flex: 1 }}>
            <View style={[styles.statCard, { backgroundColor: '#FFF7E5' }]}> 
              <Text style={{ fontSize: 18 }}>📈</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2 }}>Máximo</Text>
              <Text style={{ color: '#B26A00', fontWeight: 'bold', fontSize: 16 }}>{humStats.max.toFixed(2)}%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF7E5' }]}> 
              <Text style={{ fontSize: 18 }}>📉</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2 }}>Mínimo</Text>
              <Text style={{ color: '#B26A00', fontWeight: 'bold', fontSize: 16 }}>{humStats.min.toFixed(2)}%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF7E5' }]}> 
              <Text style={{ fontSize: 18 }}>📊</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2 }}>Desvio</Text>
              <Text style={{ color: '#B26A00', fontWeight: 'bold', fontSize: 16 }}>{humStats.desvio.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E5FFF3', marginTop: 8 }]}> 
              <Text style={{ fontSize: 18 }}>📐</Text>
              <Text style={{ color: '#00695C', fontSize: 13, marginTop: 2 }}>Curtose</Text>
              <Text style={{ color: '#00695C', fontWeight: 'bold', fontSize: 16 }}>{humStats.curtose.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
      {/* Probabilidades (Distribuição Normal e Empírica) */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Probabilidades</Text>
        {/* Distribuição Normal */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: text, fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>Distribuição Normal</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: '#FFF3E5', borderRadius: 10, padding: 16, alignItems: 'center', elevation: 2, minWidth: 120 }}>
              <Text style={{ fontSize: 22, color: '#FF9800', fontWeight: 'bold' }}>🌡️</Text>
              <Text style={{ color: '#B26A00', fontSize: 13, marginTop: 2, marginBottom: 2, fontWeight: '600', textAlign: 'center' }}>Temp &gt; 25°C</Text>
              <Text style={{ color: '#FF9800', fontSize: 24, fontWeight: 'bold' }}>{resultado && resultado.pValue > alpha ? tempNormalPct : 'Anormal'}</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 6 }}>p-value: {resultado.pValue.toFixed(5)}</Text>
            </View>
          </View>
        </View>
        {/* Empírica */}
        <View>
          <Text style={{ color: text, fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>Empírica</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: '#E5F6FF', borderRadius: 10, padding: 16, alignItems: 'center', elevation: 2, minWidth: 120 }}>
              <Text style={{ fontSize: 22, color: '#2196F3', fontWeight: 'bold' }}>🌡️</Text>
              <Text style={{ color: '#01579B', fontSize: 13, marginTop: 2, marginBottom: 2, fontWeight: '600', textAlign: 'center' }}>Temp &gt; 25°C</Text>
              <Text style={{ color: '#2196F3', fontSize: 24, fontWeight: 'bold' }}>{tempEmpiricalPct}</Text>
            </View>
          </View>
        </View>
      </View>
      {/* Projeções */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text }]}>Projeções</Text>
        {/* Equações de regressão em destaque, sem fundo branco */}
        <View style={{ borderRadius: 8, padding: 12, marginBottom: 18, marginTop: 4, alignItems: 'center', elevation: 0 }}>
          <Text style={{ color: text, fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>Equações de Regressão</Text>
          <Text style={{ color: '#FF5C5C', fontSize: 14, fontWeight: '600', marginBottom: 2 }}>Temperatura:</Text>
          <Text style={{ color: '#FF5C5C', fontSize: 14, marginBottom: 8 }}>y = {tempRegression.m.toFixed(2)}x + {tempRegression.b.toFixed(2)}</Text>
          <Text style={{ color: '#5C9EFF', fontSize: 14, fontWeight: '600', marginBottom: 2 }}>Umidade:</Text>
          <Text style={{ color: '#5C9EFF', fontSize: 14 }}>y = {humRegression.m.toFixed(2)}x + {humRegression.b.toFixed(2)}</Text>
        </View>
        {/* Gráficos de barras para previsão dos próximos 5 valores */}
        <Text style={[styles.section, { color: text, marginTop: 0, marginBottom: 8 }]}>Próximos 5 valores previstos</Text>
        {/* Temperatura */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: text, fontSize: 13, marginBottom: 2, fontWeight: '600' }}>Temperatura</Text>
          {/* Valores previstos em cima das barras */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            {tempForecast.map((val, idx) => (
              <Text key={idx} style={{ color: '#FF5C5C', fontSize: 12, flex: 1, textAlign: 'center' }}>{val.toFixed(1)}°C</Text>
            ))}
          </View>
          <BarChart
            style={{ height: 80, marginBottom: 4 }}
            data={tempForecast}
            svg={{ fill: '#FF5C5C' }}
            spacingInner={0.2}
            contentInset={{ top: 10, bottom: 10 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            {futureTimes.map((t, idx) => (
              <Text key={idx} style={{ color: text, fontSize: 10, flex: 1, textAlign: 'center' }}>{t}</Text>
            ))}
          </View>
        </View>
        {/* Umidade */}
        <View>
          <Text style={{ color: text, fontSize: 13, marginBottom: 2, fontWeight: '600' }}>Umidade</Text>
          {/* Valores previstos em cima das barras */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            {humForecast.map((val, idx) => (
              <Text key={idx} style={{ color: '#5C9EFF', fontSize: 12, flex: 1, textAlign: 'center' }}>{val.toFixed(1)}%</Text>
            ))}
          </View>
          <BarChart
            style={{ height: 80, marginBottom: 4 }}
            data={humForecast}
            svg={{ fill: '#5C9EFF' }}
            spacingInner={0.2}
            contentInset={{ top: 10, bottom: 10 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            {futureTimes.map((t, idx) => (
              <Text key={idx} style={{ color: text, fontSize: 10, flex: 1, textAlign: 'center' }}>{t}</Text>
            ))}
          </View>
        </View>
      </View>
      {/* QQ-Plot Temperatura */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text, marginTop: 0 }]}>QQ-Plot Temperatura</Text>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <QQPlotSVG data={tempArr} width={260} height={200} color="#FF5C5C" />
        </View>
      </View>
      {/* QQ-Plot Umidade */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text, marginTop: 0 }]}>QQ-Plot Umidade</Text>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <QQPlotSVG data={humArr} width={260} height={200} color="#5C9EFF" />
        </View>
      </View>
      {/* Histogramas */}
      <View style={[styles.card, { backgroundColor: card, marginBottom: 16 }]}>  
        <Text style={[styles.section, { color: text, marginTop: 0 }]}>Histograma Temperatura</Text>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <BarChart
            style={{ height: 80, width: 260 }}
            data={tempHist}
            svg={{ fill: '#FF5C5C' }}
            spacingInner={0.2}
            contentInset={{ top: 10, bottom: 10 }}
          />
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: card, marginBottom: 24 }]}>  
        <Text style={[styles.section, { color: text, marginTop: 0 }]}>Histograma Umidade</Text>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <BarChart
            style={{ height: 80, width: 260 }}
            data={humHist}
            svg={{ fill: '#5C9EFF' }}
            spacingInner={0.2}
            contentInset={{ top: 10, bottom: 10 }}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    marginBottom: 16,
  },
  section: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCard: {
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    marginBottom: 8,
    alignItems: 'center',
    flexDirection: 'column',
    minHeight: 44,
    width: '100%',
  },
});

export default DashboardScreen;
