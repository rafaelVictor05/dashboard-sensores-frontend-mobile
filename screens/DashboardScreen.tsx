import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../ThemeProvider';
import axios from 'axios';
import moment from 'moment';
import { LineChart, BarChart } from 'react-native-svg-charts';
import * as ss from 'simple-statistics';
import { mean, median, std, mode } from 'mathjs';
import { Svg, Rect, Line as SvgLine } from 'react-native-svg'; // Adicionado para BoxPlotSVG

interface DataItem {
  humidity: string;
  location: string;
  temperature: string;
  timestamp_TTL: number;
}

const API_URL = 'http://172.174.21.128:4000/data';

// Função utilitária para calcular dados do boxplot
function getBoxPlotStats(arr: number[]) {
  if (!arr.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = ss.quantileSorted(sorted, 0.25);
  const median = ss.quantileSorted(sorted, 0.5);
  const q3 = ss.quantileSorted(sorted, 0.75);
  return { min: sorted[0], q1, median, q3, max: sorted[sorted.length - 1] };
}

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

// Componente para Boxplot SVG
const BoxPlotSVG = ({ box, color, width, height }: { box: any, color: string, width: number, height: number }) => {
  const { min, q1, median, q3, max } = box;
  const range = max - min || 1;
  const scale = (v: number) => ((v - min) / range) * (width - 20) + 10;
  return (
    <Svg width={width} height={height}>
      {/* Linha do min ao max */}
      <SvgLine x1={scale(min)} y1={height / 2} x2={scale(max)} y2={height / 2} stroke={color} strokeWidth={2} />
      {/* Caixa Q1-Q3 */}
      <Rect
        x={scale(q1)}
        y={height / 2 - 12}
        width={scale(q3) - scale(q1)}
        height={24}
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={2}
      />
      {/* Linha mediana */}
      <SvgLine x1={scale(median)} y1={height / 2 - 12} x2={scale(median)} y2={height / 2 + 12} stroke={color} strokeWidth={2} />
      {/* Linhas min e max */}
      <SvgLine x1={scale(min)} y1={height / 2 - 8} x2={scale(min)} y2={height / 2 + 8} stroke={color} strokeWidth={2} />
      <SvgLine x1={scale(max)} y1={height / 2 - 8} x2={scale(max)} y2={height / 2 + 8} stroke={color} strokeWidth={2} />
    </Svg>
  );
};

const DashboardScreen = () => {
  const { background, card, text, accent } = useTheme();
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
  const bedroomData = data.filter(d => d.location === 'Bedroom');
  const tempArr = bedroomData.map(d => Number(d.temperature));
  const humArr = bedroomData.map(d => Number(d.humidity));
  const timeArr = bedroomData.map(d => moment.unix(d.timestamp_TTL).format('HH:mm'));

  // Estatísticas
  const tempStats = {
    media: tempArr.length ? (mean(tempArr) as number) : 0,
    mediana: tempArr.length ? (median(tempArr) as number) : 0,
    moda: tempArr.length ? (mode(tempArr) as number[]) : [],
    desvio: tempArr.length ? (std(tempArr) as unknown as number) : 0,
    assimetria: tempArr.length > 2 ? (ss.sampleSkewness(tempArr) as number) : 0,
  };

  const humStats = {
    media: humArr.length ? mean(humArr) : 0,
    mediana: humArr.length ? median(humArr) : 0,
    moda: humArr.length ? mode(humArr) : 0,
    desvio: tempArr.length ? (std(humArr) as unknown as number) : 0,
    assimetria: humArr.length > 2 ? ss.sampleSkewness(humArr) : 0,
  };

  // Percentuais
  const pctTemp30 = tempArr.length ? (tempArr.filter(t => t > 30).length / tempArr.length) * 100 : 0;
  const pctHumOut = humArr.length ? (humArr.filter(h => h < 40 || h > 70).length / humArr.length) * 100 : 0;

  // Probabilidade (aproximação)
  const probT30 = tempArr.length > 0 ? tempArr.filter(t => t > 30).length / tempArr.length : 0;

  // Regressão Linear
  const tempRegression = tempArr.length > 1 ? ss.linearRegression(tempArr.map((y, i) => [i, y])) : { m: 0, b: 0 };
  const tempNext = tempArr.length > 1 ? tempRegression.m * tempArr.length + tempRegression.b : 0;
  const humRegression = humArr.length > 1 ? ss.linearRegression(humArr.map((y, i) => [i, y])) : { m: 0, b: 0 };
  const humNext = humArr.length > 1 ? humRegression.m * humArr.length + humRegression.b : 0;

  // Histogramas e Boxplots
  const tempHist = getHistogram(tempArr);
  const humHist = getHistogram(humArr);
  const tempBox = getBoxPlotStats(tempArr);
  const humBox = getBoxPlotStats(humArr);

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.title, { color: text }]}>Dashboard - Bedroom</Text>
      <View style={[styles.card, { backgroundColor: card }]}>  
        <Text style={[styles.section, { color: text }]}>Gráfico de Linha</Text>
        <LineChart
          style={{ height: 120 }}
          data={tempArr}
          svg={{ stroke: '#FF5C5C' }}
          contentInset={{ top: 20, bottom: 20 }}
        />
        <LineChart
          style={{ height: 120, marginTop: 8 }}
          data={humArr}
          svg={{ stroke: '#5C9EFF' }}
          contentInset={{ top: 20, bottom: 20 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: text, fontSize: 12 }}>Temperatura</Text>
          <Text style={{ color: text, fontSize: 12 }}>Umidade</Text>
        </View>
        <Text style={[styles.section, { color: text }]}>Estatísticas Temperatura</Text>
        <Text style={{ color: text, fontSize: 13 }}>Média: {tempStats.media.toFixed(2)} | Mediana: {tempStats.mediana.toFixed(2)} | Moda: {tempStats.moda} | Desvio: {tempStats.desvio.toFixed(2)} | Assimetria: {tempStats.assimetria.toFixed(2)}</Text>
        <Text style={[styles.section, { color: text }]}>Estatísticas Umidade</Text>
        <Text style={{ color: text, fontSize: 13 }}>Média: {humStats.media.toFixed(2)} | Mediana: {humStats.mediana.toFixed(2)} | Moda: {humStats.moda} | Desvio: {humStats.desvio.toFixed(2)} | Assimetria: {humStats.assimetria.toFixed(2)}</Text>
        <Text style={[styles.section, { color: text }]}>Indicadores Percentuais</Text>
        <Text style={{ color: text, fontSize: 13 }}>{'% Temp > 30°C: '}{pctTemp30.toFixed(1)}{'%'}</Text>
        <Text style={{ color: text, fontSize: 13 }}>{'% Umidade fora 40-70%: '}{pctHumOut.toFixed(1)}{'%'}</Text>
        <Text style={[styles.section, { color: text }]}>Probabilidade</Text>
        <Text style={{ color: text, fontSize: 13 }}>{'P(T > 30°C): '}{probT30.toFixed(2)}</Text>
        <Text style={[styles.section, { color: text }]}>Previsão Linear</Text>
        <Text style={{ color: text, fontSize: 13 }}>Temp próxima: {tempNext.toFixed(2)}°C | Umidade próxima: {humNext.toFixed(2)}%</Text>
        <Text style={{ color: text, fontSize: 13 }}>Modelo Temp: y = {tempRegression.m.toFixed(2)}x + {tempRegression.b.toFixed(2)}</Text>
        <Text style={{ color: text, fontSize: 13 }}>Modelo Umidade: y = {humRegression.m.toFixed(2)}x + {humRegression.b.toFixed(2)}</Text>
        
        {/* Histogramas */}
        <Text style={[styles.section, { color: text }]}>Histogramas</Text>
        <Text style={{ color: text, fontSize: 13 }}>Temperatura</Text>
        <BarChart
          style={{ height: 80, marginBottom: 8 }}
          data={tempHist}
          svg={{ fill: '#FF5C5C' }}
          spacingInner={0.2}
          contentInset={{ top: 10, bottom: 10 }}
        />
        <Text style={{ color: text, fontSize: 13 }}>Umidade</Text>
        <BarChart
          style={{ height: 80, marginBottom: 8 }}
          data={humHist}
          svg={{ fill: '#5C9EFF' }}
          spacingInner={0.2}
          contentInset={{ top: 10, bottom: 10 }}
        />

        {/* Boxplots */}
        <Text style={[styles.section, { color: text }]}>Boxplots</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: text, fontSize: 13 }}>Temperatura</Text>
            <BoxPlotSVG box={tempBox} color="#FF5C5C" width={80} height={60} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: text, fontSize: 13 }}>Umidade</Text>
            <BoxPlotSVG box={humBox} color="#5C9EFF" width={80} height={60} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  section: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default DashboardScreen;
