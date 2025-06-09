// Arquivo: estatisticas.js
// Contém uma implementação robusta do teste de normalidade de Shapiro-Wilk,
// baseada no algoritmo AS R94 da linguagem R. O código original foi
// complementado com a função de CDF para calcular o p-valor final.

// =============================================================================
// SEÇÃO 1: FUNÇÕES AUXILIARES PARA O CÁLCULO DE PROBABILIDADE (CDF)
// =============================================================================

/**
 * Função de Erro de Gauss (erf). Usada como base para a CDF da normal.
 * Aproximação de Abramowitz and Stegun.
 * @param {number} x - O valor de entrada.
 * @returns {number} O valor da função de erro.
 */
function erf(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

/**
 * Função de Distribuição Acumulada (CDF) para a distribuição normal padrão.
 * Converte um Z-score em uma probabilidade (P(Z <= z)).
 * @param {number} z - O Z-score.
 * @returns {number} A probabilidade acumulada de 0 a 1.
 */
function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}


// =============================================================================
// SEÇÃO 2: CÓDIGO DO ALGORITMO DE SHAPIRO-WILK (PORTADO DO R)
// =============================================================================

/**
 * The inverse of cdf. (Função Quantil ou PPF)
 * Ported from http://svn.r-project.org/R/trunk/src/library/stats/src/swilk.c
 * ALGORITHM AS 111 APPL. STATIST. (1977) VOL.26, NO.1
 */
function normalQuantile(p, mu, sigma) {
    var p_ , q, r, val;
    if (sigma < 0) return -1;
    if (sigma == 0) return mu;

    q = p - 0.5;

    if (Math.abs(q) <= .425) { // 0.075 <= p <= 0.925
        r = 0.180625 - q * q;
        val = q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r
            + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r
            + 3.387132872796366608) / (((((((r * 5226.495278852854561 + 28729.085735721942674) * r + 39307.89580009271061) * r
            + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
    } else {
        r = (q > 0) ? 1 - p : p;
        r = Math.sqrt(-Math.log(r));

        if (r <= 5.) {
            r += -1.6;
            val = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + .24178072517745061177) * r
                + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r
                + 4.6303378461565452959) * r + 1.42343711074968357734) / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r
                + .0151986665636164571966) * r + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r
                + 2.05319162663775882187) * r + 1);
        } else {
            r += -5.;
            val = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r
                + 0.026532189526576123093) * r + .29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r
                + 6.6579046435011037772) / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7)* r
                + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r + .0148753612908506148525) * r
                + .13692988092273580531) * r + .59983220655588793769) * r + 1.);
        }
        if (q < 0.0) val = -val;
    }
    return mu + sigma * val;
}

/**
 * Realiza o teste de normalidade de Shapiro-Wilk.
 * Portado do algoritmo AS R94. Válido para n entre 3 e 5000.
 * @param {number[]} x - Um array de dados da amostra.
 * @returns {{statistic: number, pValue: number}} - Um objeto com a estatística W e o p-valor.
 */
export function shapiroWilk(x) {
    // Função auxiliar para avaliação de polinômios
    function poly(cc, nord, x) {
        let ret_val = cc[0];
        if (nord > 1) {
            let p = x * cc[nord-1];
            for (let j = nord - 2; j > 0; j--) {
                p = (p + cc[j]) * x;
            }
            ret_val += p;
        }
        return ret_val;
    }

    let n = x.length;
    if (n < 3 || n > 5000) {
        console.warn(`Amostra de tamanho ${n} fora dos limites para o teste de Shapiro-Wilk (3-5000).`);
        return { statistic: NaN, pValue: 0 };
    }
    
    // Faz uma cópia e ordena os dados
    let sortedX = x.slice().sort((a, b) => a - b);
    
    let nn2 = Math.floor(n / 2);
    let a = new Array(nn2 + 1);
    let w, pw;

    // Coeficientes do algoritmo
    const c1 = [ 0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056 ];
    const c2 = [ 0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633 ];

    // Cálculo dos coeficientes 'a'
    let an = n;
    if (n === 3) {
        a[1] = 0.70710678;
    } else {
        let an25 = an + 0.25;
        let summ2 = 0.0;
        for (let i = 1; i <= nn2; i++) {
            a[i] = normalQuantile((i - 0.375) / an25, 0, 1);
            summ2 += a[i] * a[i];
        }
        summ2 *= 2;
        let ssumm2 = Math.sqrt(summ2);
        let rsn = 1 / Math.sqrt(an);
        let a1 = poly(c1, 6, rsn) - a[1] / ssumm2;

        let i1 = 2;
        if (n > 5) {
            i1 = 3;
            let a2 = -a[2] / ssumm2 + poly(c2, 6, rsn);
            let fac = Math.sqrt((summ2 - 2 * (a[1] * a[1]) - 2 * (a[2] * a[2])) / (1 - 2 * (a1 * a1) - 2 * (a2 * a2)));
            a[2] = a2;
            a[1] = a1;
            for (let i = i1; i <= nn2; i++) {
                a[i] /= -fac;
            }
        } else {
            let fac = Math.sqrt((summ2 - 2 * (a[1] * a[1])) / (1 - 2 * (a1 * a1)));
            a[1] = a1;
            for (let i = i1; i <= nn2; i++) {
                a[i] /= -fac;
            }
        }
    }

    // Cálculo da estatística W
    const range = sortedX[n - 1] - sortedX[0];
    if (range < 1e-19) {
        return { statistic: 1, pValue: 1 };
    }

    let ssassx = 0.0;
    for (let i = 1; i <= nn2; i++) {
        ssassx += a[i] * (sortedX[n - i] - sortedX[i - 1]);
    }

    const mean = sortedX.reduce((s, v) => s + v, 0) / n;
    const s2 = sortedX.reduce((s, v) => s + Math.pow(v - mean, 2), 0);
    w = Math.pow(ssassx, 2) / s2;

    // Cálculo do p-valor (a parte que foi corrigida)
    if (n === 3) {
        pw = 1.90985931710274 * (Math.asin(Math.sqrt(w)) - 1.04719755119660);
        return { statistic: w, pValue: pw };
    }

    let y = Math.log(1 - w);
    let xx = Math.log(an);
    let m, s;

    if (n <= 11) {
        const c3 = [ 0.544, -0.39978, 0.025054, -6.714e-4 ];
        const c4 = [ 1.3822, -0.77857, 0.062767, -0.0020322 ];
        const gamma = poly( [ -2.273, 0.459 ], 2, an);
        if (y >= gamma) {
            return { statistic: w, pValue: 1e-7 }; // Praticamente zero
        }
        y = -Math.log(gamma - y);
        m = poly(c3, 4, an);
        s = Math.exp(poly(c4, 4, an));
    } else { // n > 11
        const c5 = [ -1.5861, -0.31082, -0.083751, 0.0038915 ];
        const c6 = [ -0.4803, -0.082676, 0.0030302 ];
        m = poly(c5, 4, xx);
        s = Math.exp(poly(c6, 3, xx));
    }
    
    // A correção final: usar a CDF para encontrar a probabilidade
    const z = (y - m) / s;
    pw = 1 - normalCdf(z); // 1 - cdf para a cauda superior

    return { statistic: w, pValue: pw };
}