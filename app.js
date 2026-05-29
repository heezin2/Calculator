/**
 * ==========================================
 * 스마트 계산기 통합 작동 로직 (최종 수정본)
 * ==========================================
 */

// 1. DOM 객체 불러오기
const formulaDisplay = document.getElementById('formula-display');
const previewDisplay = document.getElementById('preview-display');
const themeToggleBtn = document.getElementById('theme-toggle');
const historyToggleBtn = document.getElementById('history-toggle');
const historyCloseBtn = document.getElementById('history-close');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const emptyHistoryMsg = document.getElementById('empty-history-msg');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const tabCalc = document.getElementById('tab-calc');
const tabCurrency = document.getElementById('tab-currency');
const calcScreenView = document.getElementById('calc-screen-view');
const currencyScreenView = document.getElementById('currency-screen-view');
const fromCurrencySelect = document.getElementById('from-currency');
const toCurrencySelect = document.getElementById('to-currency');
const fromAmountDiv = document.getElementById('from-amount');
const toAmountDiv = document.getElementById('to-amount');
const rateIndicator = document.getElementById('rate-indicator');
const equalBtn = document.getElementById('btn-equal');

// 2. 상태 관리 변수
let currentMode = 'calc';
let currentFormula = '';
let isResultDisplayed = false;
let history = JSON.parse(localStorage.getItem('calc_history')) || [];

let fromAmount = '0';
let exchangeRates = null;
let isOfflineMode = false;

const fallbackRates = {
    "USD": 1.0, "KRW": 1350.0, "JPY": 150.0, "EUR": 0.92, "CNY": 7.25
};

// 3. 앱 초기화
window.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    initTheme();
    initTabs();
    loadExchangeRates();
});

/* ==========================================
   [추가 기능] 숫자 포맷팅 (콤마 처리)
   ========================================== */

/**
 * 수식 내의 숫자들만 찾아 3자리마다 콤마를 찍어주는 함수
 */
function formatFormulaWithCommas(formula) {
    if (!formula) return '0';
    // 숫자 부분(소수점 포함)을 찾아 콤마 포맷팅 적용
    return formula.replace(/\d+(\.\d+)?/g, (match) => {
        const parts = match.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    });
}

/**
 * 일반 숫자를 콤마 포맷으로 변경 (결과값용)
 */
function formatNumber(num) {
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

/* ==========================================
   [기능 A] 환율 API 로직
   ========================================== */

async function loadExchangeRates() {
    const cacheKey = 'calc_exchange_rates';
    const cacheTimeKey = 'calc_rates_timestamp';
    const oneHour = 60 * 60 * 1000;
    const cachedRates = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimeKey);
    const now = Date.now();

    if (cachedRates && cachedTimestamp && (now - cachedTimestamp < oneHour)) {
        exchangeRates = JSON.parse(cachedRates);
        updateRateIndicator();
        calculateCurrency();
        return;
    }

    try {
        rateIndicator.textContent = "환율 동기화 중...";
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates) {
            exchangeRates = data.rates;
            localStorage.setItem(cacheKey, JSON.stringify(data.rates));
            localStorage.setItem(cacheTimeKey, now.toString());
            isOfflineMode = false;
        }
    } catch (error) {
        exchangeRates = cachedRates ? JSON.parse(cachedRates) : fallbackRates;
        isOfflineMode = true;
    }
    updateRateIndicator();
    calculateCurrency();
}

function updateRateIndicator() {
    if (!exchangeRates) return;
    const usdToKrw = exchangeRates["KRW"] || fallbackRates["KRW"];
    rateIndicator.textContent = `1 USD = ${formatNumber(usdToKrw)} KRW (${isOfflineMode ? '오프라인' : '실시간'})`;
    rateIndicator.style.color = isOfflineMode ? '#ef4444' : '';
}

/* ==========================================
   [기능 B] 탭 전환 및 버튼 관리
   ========================================== */

function initTabs() {
    tabCalc.addEventListener('click', () => switchMode('calc'));
    tabCurrency.addEventListener('click', () => switchMode('currency'));
    fromCurrencySelect.addEventListener('change', calculateCurrency);
    toCurrencySelect.addEventListener('change', calculateCurrency);
}

function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    if (mode === 'calc') {
        tabCalc.classList.add('active');
        tabCurrency.classList.remove('active');
        currencyScreenView.classList.remove('active');
        setTimeout(() => calcScreenView.classList.add('active'), 50);
        enableCalculatorButtons(true);
        equalBtn.innerHTML = '<i class="fa-solid fa-equals"></i>';
    } else {
        tabCurrency.classList.add('active');
        tabCalc.classList.remove('active');
        calcScreenView.classList.remove('active');
        setTimeout(() => currencyScreenView.classList.add('active'), 50);
        enableCalculatorButtons(false);
        equalBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down"></i>';
        calculateCurrency();
    }
}

function enableCalculatorButtons(enable) {
    const targets = ['btn-div', 'btn-mul', 'btn-sub', 'btn-add', 'btn-paren-open', 'btn-paren-close'];
    targets.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) enable ? btn.classList.remove('disabled') : btn.classList.add('disabled');
    });
}

/* ==========================================
   [기능 C] 환율 변환 연산
   ========================================== */

function calculateCurrency() {
    if (currentMode !== 'currency' || !exchangeRates) return;
    const fromUnit = fromCurrencySelect.value;
    const toUnit = toCurrencySelect.value;
    const rawVal = parseFloat(fromAmount.replace(/,/g, ''));

    if (isNaN(rawVal) || rawVal === 0) {
        fromAmountDiv.textContent = '0';
        toAmountDiv.textContent = '0';
        return;
    }

    fromAmountDiv.textContent = formatFormulaWithCommas(fromAmount);
    const rateFrom = exchangeRates[fromUnit] || fallbackRates[fromUnit];
    const rateTo = exchangeRates[toUnit] || fallbackRates[toUnit];
    const converted = (rawVal / rateFrom) * rateTo;

    let maxDigits = (toUnit === 'KRW' || toUnit === 'JPY') ? 0 : 2;
    toAmountDiv.textContent = converted.toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDigits
    });
}

function swapCurrencies() {
    const temp = fromCurrencySelect.value;
    fromCurrencySelect.value = toCurrencySelect.value;
    toCurrencySelect.value = temp;
    fromAmount = toAmountDiv.textContent.replace(/,/g, '');
    calculateCurrency();
}

/* ==========================================
   [기능 D] 일반 계산기 연산 엔진
   ========================================== */

function updateDisplay() {
    if (currentFormula === '') {
        formulaDisplay.textContent = '0';
        formulaDisplay.classList.add('placeholder');
    } else {
        formulaDisplay.classList.remove('placeholder');
        let formatted = formatFormulaWithCommas(currentFormula);
        formatted = formatted
            .replace(/\*/g, ' × ')
            .replace(/\//g, ' ÷ ')
            .replace(/\+/g, ' + ')
            .replace(/-/g, ' - ');
        formulaDisplay.textContent = formatted;
    }
    calculatePreview();
}

function calculatePreview() {
    if (!currentFormula || isResultDisplayed) {
        previewDisplay.textContent = '';
        return;
    }
    const lastChar = currentFormula.trim().slice(-1);
    if (['+', '-', '*', '/', '.'].includes(lastChar)) {
        previewDisplay.textContent = '';
        return;
    }

    try {
        const openBrackets = (currentFormula.match(/\(/g) || []).length;
        const closeBrackets = (currentFormula.match(/\)/g) || []).length;
        if (openBrackets !== closeBrackets) {
            previewDisplay.textContent = '';
            return;
        }
        const result = safeEvaluate(currentFormula);
        if (result !== null && isFinite(result)) {
            previewDisplay.textContent = '= ' + formatNumber(result.toFixed(8));
        } else {
            previewDisplay.textContent = '';
        }
    } catch (e) {
        previewDisplay.textContent = '';
    }
}

function safeEvaluate(expression) {
    const safePattern = /^[0-9+\-*/().\s]*$/;
    if (!safePattern.test(expression)) throw new Error("Security Error");
    return Function('"use strict"; return (' + expression + ')')();
}

function performCalculation() {
    if (!currentFormula) return;
    try {
        // 수식 끝이 연산자면 자동 제거
        if (['+', '-', '*', '/'].includes(currentFormula.slice(-1))) {
            currentFormula = currentFormula.slice(0, -1);
        }
        // 괄호 자동 닫기
        const openCount = (currentFormula.match(/\(/g) || []).length;
        const closeCount = (currentFormula.match(/\)/g) || []).length;
        for (let i = 0; i < openCount - closeCount; i++) currentFormula += ')';

        const result = safeEvaluate(currentFormula);
        if (result === null || !isFinite(result)) throw new Error("NaN");

        const finalResult = Number(result.toFixed(8));
        addHistoryItem(currentFormula, finalResult);
        currentFormula = finalResult.toString();
        isResultDisplayed = true;
        updateDisplay();
        previewDisplay.textContent = '';
    } catch (error) {
        formulaDisplay.textContent = 'Error';
        currentFormula = '';
        isResultDisplayed = true;
        setTimeout(updateDisplay, 1500);
    }
}

/* ==========================================
   [기능 E] 입력 핸들러 (유효성 강화 통합)
   ========================================== */

function handleInput(val, type) {
    if (currentMode === 'currency') {
        handleCurrencyInput(val, type);
        return;
    }

    if (isResultDisplayed) {
        if (type === 'num' || val === 'parenthesis-open') currentFormula = '';
        isResultDisplayed = false;
    }

    const lastChar = currentFormula.slice(-1);
    const ops = ['+', '-', '*', '/'];

    if (type === 'num') {
        if (currentFormula === '0' && val === '0') return;
        if (val === '.') {
            const lastNum = currentFormula.split(/[+\-*/()]/).pop();
            if (lastNum.includes('.')) return;
            if (currentFormula === '' || ops.includes(lastChar) || lastChar === '(') currentFormula += '0';
        }
        currentFormula === '0' && val !== '.' ? currentFormula = val : currentFormula += val;
    }
    else if (type === 'op') {
        if (currentFormula === '' && (val === '*' || val === '/')) return;
        if (ops.includes(lastChar)) {
            currentFormula = currentFormula.slice(0, -1) + val;
        } else if (lastChar !== '(' || val === '-') {
            currentFormula += val;
        }
    }
    else if (type === 'action') {
        if (val === 'clear') { currentFormula = ''; previewDisplay.textContent = ''; }
        else if (val === 'backspace') { currentFormula = currentFormula.slice(0, -1); }
        else if (val === 'parenthesis-open') {
            if (currentFormula !== '' && !ops.includes(lastChar) && lastChar !== '(') currentFormula += '*(';
            else currentFormula += '(';
        }
        else if (val === 'parenthesis-close') {
            const openC = (currentFormula.match(/\(/g) || []).length;
            const closeC = (currentFormula.match(/\)/g) || []).length;
            if (openC > closeC && !ops.includes(lastChar) && lastChar !== '(') currentFormula += ')';
        }
    }
    updateDisplay();
}

function handleCurrencyInput(val, type) {
    if (type === 'num') {
        if (val === '.' && fromAmount.includes('.')) return;
        if (fromAmount === '0') {
            fromAmount = (val === '.') ? '0.' : val;
        } else {
            if (fromAmount.includes('.')) {
                if (fromAmount.split('.')[1].length >= 4) return;
            }
            if (fromAmount.replace('.', '').length >= 12) return;
            fromAmount += val;
        }
    } else if (type === 'action') {
        if (val === 'clear') fromAmount = '0';
        else if (val === 'backspace') {
            fromAmount = fromAmount.slice(0, -1);
            if (fromAmount === '' || fromAmount === '-') fromAmount = '0';
        }
    }
    calculateCurrency();
}

/* ==========================================
   [기능 F] 계산 기록 (개별 삭제 추가)
   ========================================== */

function addHistoryItem(formula, result) {
    history.unshift({ formula, result });
    if (history.length > 30) history.pop();
    localStorage.setItem('calc_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';
    if (history.length === 0) {
        emptyHistoryMsg.style.display = 'flex';
        clearHistoryBtn.style.display = 'none';
        return;
    }
    emptyHistoryMsg.style.display = 'none';
    clearHistoryBtn.style.display = 'block';

    history.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        const displayF = formatFormulaWithCommas(item.formula)
            .replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/-/g, ' - ');

        itemDiv.innerHTML = `
            <button class="history-del-btn" title="삭제"><i class="fas fa-times"></i></button>
            <div class="history-item-formula">${displayF}</div>
            <div class="history-item-result">= ${formatNumber(item.result)}</div>
        `;

        itemDiv.addEventListener('click', (e) => {
            if (e.target.closest('.history-del-btn')) return;
            switchMode('calc');
            currentFormula = item.result.toString();
            isResultDisplayed = false;
            updateDisplay();
            closeHistoryPanel();
        });

        itemDiv.querySelector('.history-del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            history.splice(index, 1);
            localStorage.setItem('calc_history', JSON.stringify(history));
            renderHistory();
        });
        historyList.appendChild(itemDiv);
    });
}

clearHistoryBtn.addEventListener('click', () => {
    if (confirm("모든 기록을 삭제할까요?")) {
        history = [];
        localStorage.removeItem('calc_history');
        renderHistory();
    }
});

/* ==========================================
   [기능 G/H] 테마 및 패널 제어
   ========================================== */

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') document.body.classList.add('light-mode');
    updateThemeIcon(document.body.classList.contains('light-mode'));
}

themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
});

function updateThemeIcon(isLight) {
    themeToggleBtn.querySelector('i').className = isLight ? 'fas fa-sun' : 'fas fa-moon';
}

function openHistoryPanel() { historyPanel.classList.add('active'); }
function closeHistoryPanel() { historyPanel.classList.remove('active'); }
historyToggleBtn.addEventListener('click', openHistoryPanel);
historyCloseBtn.addEventListener('click', closeHistoryPanel);

document.addEventListener('click', (e) => {
    if (!historyPanel.contains(e.target) && !historyToggleBtn.contains(e.target) && historyPanel.classList.contains('active')) {
        closeHistoryPanel();
    }
});

/* ==========================================
   [기능 I] 이벤트 바인딩
   ========================================== */

document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', () => {
        const val = button.getAttribute('data-val');
        const action = button.getAttribute('data-action');
        if (action === 'calculate') {
            currentMode === 'currency' ? swapCurrencies() : performCalculation();
        } else if (action) {
            handleInput(action, 'action');
        } else {
            handleInput(val, button.classList.contains('btn-num') ? 'num' : 'op');
        }
    });
});

document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/[0-9.]/.test(key)) handleInput(key, 'num');
    else if (['+', '-', '*', '/'].includes(key)) currentMode === 'calc' && handleInput(key, 'op');
    else if (key === '(') currentMode === 'calc' && handleInput('parenthesis-open', 'action');
    else if (key === ')') currentMode === 'calc' && handleInput('parenthesis-close', 'action');
    else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        currentMode === 'currency' ? swapCurrencies() : performCalculation();
    }
    else if (key === 'Backspace') handleInput('backspace', 'action');
    else if (key === 'Escape') handleInput('clear', 'action');
});