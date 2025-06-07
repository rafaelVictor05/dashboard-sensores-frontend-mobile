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

// Função Shapiro-Wilk para teste de normalidade (aproximação)
function shapiroWilkNormal(arr: number[]): {stat: number, p: number, normal: boolean} {
  if (arr.length < 3) return {stat: 0, p: 0, normal: false};
  if (arr.length > 5000) return {stat: 0, p: 0, normal: false};
  const skew = ss.sampleSkewness(arr);
  const kurt = ss.sampleKurtosis(arr);
  const normal = Math.abs(skew) < 0.5 && Math.abs(kurt) < 1;
  return {stat: 0, p: normal ? 0.1 : 0.01, normal};
}

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
  console.log('Bedroom Data:', bedroomData);
  const tempArr = bedroomData.map(d => Number(d.temperature));
  console.log('Temperature Array:', tempArr);
  const humArr = bedroomData.map(d => Number(d.humidity));
  console.log('Humidity Array:', humArr);
  const timeArr = bedroomData.map(d => moment.unix(d.timestamp_TTL).format('HH:mm'));
  console.log('Time Array:', timeArr);

  // Obter valores mais recentes
  const latest = bedroomData.length ? bedroomData[bedroomData.length - 1] : null;
  const latestTemp = latest ? Number(latest.temperature) : null;
  const latestHum = latest ? Number(latest.humidity) : null;

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
  let pctTemp20Fixed = 0;
  let pctHumInRangeFixed = 0;
  if (tempArr.length > 0) {
    const count = tempArr.reduce((acc, t) => acc + (t > 20 ? 1 : 0), 0);
    pctTemp20Fixed = (count / tempArr.length) * 100;
  }
  if (humArr.length > 0) {
    const count = humArr.reduce((acc, h) => acc + (h >= 50 && h <= 65 ? 1 : 0), 0);
    pctHumInRangeFixed = (count / humArr.length) * 100;
  }

  // Probabilidade (aproximação)
  // Teste de normalidade: Shapiro-Wilk (aproximação)
  let normalTemp = false;
  let probT30 = 0;
  if (tempArr.length > 2) {
    const shapiro = shapiroWilkNormal(tempArr);
    normalTemp = shapiro.normal;
    if (normalTemp) {
      const mu = mean(tempArr) as number;
      const sigma = (std(tempArr) as unknown) as number;
      if (sigma > 0) {
        const z = (30 - mu) / sigma;
        probT30 = 1 - ss.cumulativeStdNormalProbability(z);
      } else {
        probT30 = mu > 30 ? 1 : 0;
      }
    } else {
      probT30 = tempArr.filter(t => t > 30).length / tempArr.length;
    }
  } else if (tempArr.length > 0) {
    probT30 = tempArr.filter(t => t > 30).length / tempArr.length;
  }
  // Probabilidade Umidade > 40% usando Shapiro-Wilk
  let normalHum = false;
  let probH40 = 0;
  if (humArr.length > 2) {
    const shapiro = shapiroWilkNormal(humArr);
    normalHum = shapiro.normal;
    if (normalHum) {
      const mu = mean(humArr) as number;
      const sigma = (std(humArr) as unknown) as number;
      if (sigma > 0) {
        const z = (40 - mu) / sigma;
        probH40 = 1 - ss.cumulativeStdNormalProbability(z);
      } else {
        probH40 = mu > 40 ? 1 : 0;
      }
    } else {
      probH40 = humArr.filter(h => h > 40).length / humArr.length;
    }
  } else if (humArr.length > 0) {
    probH40 = humArr.filter(h => h > 40).length / humArr.length;
  }

  // Regressão Linear
  const tempRegression = tempArr.length > 1 ? ss.linearRegression(tempArr.map((y, i) => [i, y])) : { m: 0, b: 0 };
  const tempNext = tempArr.length > 1 ? tempRegression.m * tempArr.length + tempRegression.b : 0;
  const humRegression = humArr.length > 1 ? ss.linearRegression(humArr.map((y, i) => [i, y])) : { m: 0, b: 0 };
  const humNext = humArr.length > 1 ? humRegression.m * humArr.length + humRegression.b : 0;

  // Previsão dos próximos 5 valores
  const tempForecast = tempArr.length > 1
    ? Array.from({ length: 5 }, (_, k) => tempRegression.m * (tempArr.length + k) + tempRegression.b)
    : [];
  const humForecast = humArr.length > 1
    ? Array.from({ length: 5 }, (_, k) => humRegression.m * (humArr.length + k) + humRegression.b)
    : [];

  // Calcular intervalo médio entre medições
  let futureTimes: string[] = [];
  if (bedroomData.length > 1) {
    // Calcular intervalo médio real entre todas as medições
    const intervals = bedroomData.slice(1).map((d, i) => d.timestamp_TTL - bedroomData[i].timestamp_TTL);
    const avgInterval = intervals.length ? Math.round(mean(intervals)) : 60;
    const last = bedroomData[bedroomData.length - 1].timestamp_TTL;
    futureTimes = Array.from({ length: 5 }, (_, k) =>
      moment.unix(last + avgInterval * (k + 1)).format('HH:mm')
    );
  } else if (bedroomData.length === 1) {
    const last = bedroomData[0].timestamp_TTL;
    futureTimes = Array.from({ length: 5 }, (_, k) =>
      moment.unix(last + 60 * (k + 1)).format('HH:mm') // fallback: 1 min
    );
  }

  // Histogramas e Boxplots
  const tempHist = getHistogram(tempArr);
  const humHist = getHistogram(humArr);
  const tempBox = getBoxPlotStats(tempArr);
  const humBox = getBoxPlotStats(humArr);

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.title, { color: text }]}>Dashboard - Bedroom</Text>
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
      <View style={[styles.card, { backgroundColor: card }]}>  
        {/* Gráfico de Linha Temperatura */}
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

        {/* Gráfico de Linha Umidade */}
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: text, fontSize: 12 }}>Temperatura</Text>
          <Text style={{ color: text, fontSize: 12 }}>Umidade</Text>
        </View>
        <Text style={[styles.section, { color: text }]}>Estatísticas Temperatura</Text>
        <Text style={{ color: text, fontSize: 13 }}>Média: {tempStats.media.toFixed(2)} | Mediana: {tempStats.mediana.toFixed(2)} | Moda: {tempStats.moda} | Desvio: {tempStats.desvio.toFixed(2)} | Assimetria: {tempStats.assimetria.toFixed(2)}</Text>
        <Text style={[styles.section, { color: text }]}>Estatísticas Umidade</Text>
        <Text style={{ color: text, fontSize: 13 }}>Média: {humStats.media.toFixed(2)} | Mediana: {humStats.mediana.toFixed(2)} | Moda: {humStats.moda} | Desvio: {humStats.desvio.toFixed(2)} | Assimetria: {humStats.assimetria.toFixed(2)}</Text>
        <Text style={[styles.section, { color: text }]}>Indicadores Percentuais</Text>
        <Text style={{ color: text, fontSize: 13 }}>{'% Temp > 20°C: '}{pctTemp20Fixed.toFixed(1)}{'%'}</Text>
        <Text style={{ color: text, fontSize: 13 }}>{'% Umidade entre 50-65%: '}{pctHumInRangeFixed.toFixed(1)}{'%'}</Text>
        <Text style={[styles.section, { color: text }]}>Probabilidade</Text>
        <Text style={{ color: text, fontSize: 13 }}>
          {normalTemp
            ? 'Distribuição normal: '
            : 'Amostra não normal: '}
          {'P(T > 30°C): '}{probT30.toFixed(2)}
        </Text>
        <Text style={{ color: text, fontSize: 13, marginBottom: 8 }}>
          {normalHum
            ? 'Distribuição normal: '
            : 'Amostra não normal: '}
          {'P(H > 40%): '}{probH40.toFixed(2)}
        </Text>
        {/* Previsão Linear */}
        <Text style={[styles.section, { color: text }]}>Previsão Linear</Text>
        <Text style={{ color: text, fontSize: 13 }}>Modelo Temp: y = {tempRegression.m.toFixed(2)}x + {tempRegression.b.toFixed(2)}</Text>
        <Text style={{ color: text, fontSize: 13 }}>Modelo Umidade: y = {humRegression.m.toFixed(2)}x + {humRegression.b.toFixed(2)}</Text>
        {/* Gráficos de barras para previsão dos próximos 5 valores */}
        <Text style={[styles.section, { color: text, marginTop: 12 }]}>Próximos 5 valores previstos</Text>
        <Text style={{ color: text, fontSize: 13, marginBottom: 2 }}>Temperatura</Text>
        <View>
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
        <Text style={{ color: text, fontSize: 13, marginBottom: 2 }}>Umidade</Text>
        <View>
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
        {/* QQ-Plot Temperatura */}
        <Text style={[styles.section, { color: text, marginTop: 16 }]}>QQ-Plot Temperatura</Text>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <QQPlotSVG data={tempArr} width={260} height={200} color="#FF5C5C" />
        </View>
        {/* QQ-Plot Umidade */}
        <Text style={[styles.section, { color: text, marginTop: 16 }]}>QQ-Plot Umidade</Text>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <QQPlotSVG data={humArr} width={260} height={200} color="#5C9EFF" />
        </View>
        {/* Histogramas */}
        <Text style={[styles.section, { color: text, marginTop: 16 }]}>Histograma Temperatura</Text>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <BarChart
            style={{ height: 80, width: 260 }}
            data={tempHist}
            svg={{ fill: '#FF5C5C' }}
            spacingInner={0.2}
            contentInset={{ top: 10, bottom: 10 }}
          />
        </View>
        <Text style={[styles.section, { color: text, marginTop: 8 }]}>Histograma Umidade</Text>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
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
});

export default DashboardScreen;
