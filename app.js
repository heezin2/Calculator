/**
 * JanyTree_Calc Pro - LCD Sync & Keyboard Bug Fixed
 */

let currentVal = "0";
let prevVal = "";
let operator = null;
let isWaitingForNext = false;
let currentMode = "calc";

let memoryValue = 0;
let grandTotal = 0;
let taxRate = 10;
let history = JSON.parse(localStorage.getItem('calc_history')) || [];

let exchangeRates = {};
let fromAmount = "0";

const display = document.getElementById('display');
const exchFromVal = document.getElementById('exch-from-val');
const exchToVal = document.getElementById('exch-to-val');
const indM = document.getElementById('ind-m');
const indGT = document.getElementById('ind-gt');

window.addEventListener('DOMContentLoaded', () => {
    fetchRates();
    initTheme();
    updateDisplay();
    renderHistory();
    bindMouseButtons();
});

// 테마 관리
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'pink';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('#theme-toggle i').className = 'fas fa-sun';
    }
}

document.getElementById('theme-toggle').onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'pink');
    document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
};

// 환율 데이터 로드
async function fetchRates() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/KRW');
        const data = await res.json();
        exchangeRates = data.rates;
        if (currentMode === 'exch') updateExchange();
    } catch (e) { console.error("환율 데이터 로딩 실패"); }
}

// 모드 전환
document.getElementById('btn-calc-mode').onclick = () => switchMode('calc');
document.getElementById('btn-exch-mode').onclick = () => switchMode('exch');

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('calc-keypad').classList.toggle('active', mode === 'calc');
    document.getElementById('exch-keypad').classList.toggle('active', mode === 'exch');
    document.getElementById('btn-calc-mode').classList.toggle('active', mode === 'calc');
    document.getElementById('btn-exch-mode').classList.toggle('active', mode === 'exch');

    if (mode === 'exch') {
        fromAmount = (currentVal !== "0") ? currentVal : "0";
        updateExchange();
    } else {
        updateDisplay();
    }
}

// 숫자 입력 로직
function handleNumber(num) {
    if (currentMode === "calc") {
        if (isWaitingForNext) {
            currentVal = num;
            isWaitingForNext = false;
        } else {
            if (num === "00" && currentVal === "0") return;
            currentVal = (currentVal === "0") ? num : currentVal + num;
        }
        updateDisplay();
    } else {
        // 환율 모드 입력
        fromAmount = (fromAmount === "0") ? num : fromAmount + num;
        updateExchange();
    }
}

// 기능 처리 로직
function handleAction(action) {
    if (currentMode === "exch") {
        if (action === 'clear') fromAmount = "0";
        if (action === 'backspace') fromAmount = fromAmount.slice(0, -1) || "0";
        updateExchange();
        return;
    }

    const currentNum = parseFloat(currentVal);

    switch (action) {
        case '+': case '-': case '*': case '/':
            if (operator && !isWaitingForNext) {
                performCalculation();
            }
            operator = action;
            prevVal = currentVal;
            isWaitingForNext = true;
            break;

        case 'calculate':
            if (operator) {
                performCalculation();
                grandTotal += parseFloat(currentVal);
            }
            break;

        case 'clear':
            currentVal = "0"; prevVal = ""; operator = null; isWaitingForNext = false;
            updateDisplay();
            break;

        case 'clear-entry':
            currentVal = "0";
            updateDisplay();
            break;

        case 'backspace':
            currentVal = currentVal.slice(0, -1) || "0";
            updateDisplay();
            break;

        case 'gt':
            currentVal = String(grandTotal);
            isWaitingForNext = true;
            updateDisplay();
            break;

        case 'mc': memoryValue = 0; updateDisplay(); break;
        case 'mr': currentVal = String(memoryValue); isWaitingForNext = true; updateDisplay(); break;
        case 'm-plus': memoryValue += currentNum; isWaitingForNext = true; updateDisplay(); break;
        case 'm-minus': memoryValue -= currentNum; isWaitingForNext = true; updateDisplay(); break;
        case 'root': currentVal = String(Math.sqrt(currentNum)); updateDisplay(); break;
        case 'plus-minus': currentVal = String(currentNum * -1); updateDisplay(); break;
        case 'tax-plus': currentVal = String(currentNum * (1 + taxRate / 100)); updateDisplay(); break;
        case 'tax-minus': currentVal = String(currentNum / (1 + taxRate / 100)); updateDisplay(); break;
    }
}

function performCalculation() {
    const a = parseFloat(prevVal);
    const b = parseFloat(currentVal);
    let result = 0;
    if (operator === '+') result = a + b;
    else if (operator === '-') result = a - b;
    else if (operator === '*') result = a * b;
    else if (operator === '/') result = a / b;

    saveHistory(`${a} ${operator} ${b}`, result);
    currentVal = String(result);
    isWaitingForNext = true;
    operator = null;
    updateDisplay();
}

// 화면 업데이트 (계산기용)
function updateDisplay() {
    const num = parseFloat(currentVal);
    display.textContent = isNaN(num) ? "0" : num.toLocaleString(undefined, { maximumFractionDigits: 10 });
    indM.classList.toggle('active', memoryValue !== 0);
    indGT.classList.toggle('active', grandTotal !== 0);
}

// 환율 업데이트 (LCD 연동 포함)
function updateExchange() {
    const fromUnit = document.getElementById('from-currency').value;
    const toUnit = document.getElementById('to-currency').value;
    const amount = parseFloat(fromAmount);

    // 환율 입력창 업데이트
    exchFromVal.textContent = amount.toLocaleString();

    // 메인 LCD 액정에도 입력 숫자 표시 (요청사항)
    display.textContent = amount.toLocaleString(undefined, { maximumFractionDigits: 10 });

    if (exchangeRates[fromUnit]) {
        const rate = exchangeRates[toUnit] / exchangeRates[fromUnit];
        const converted = amount * rate;
        exchToVal.textContent = converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
}

// 마우스 버튼 바인딩
function bindMouseButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.onclick = () => {
            const val = btn.getAttribute('data-val');
            const action = btn.getAttribute('data-action');
            
            // data-val 속성에 + - * / 기호가 들어있을 경우 숫자가 아닌 연산 액션으로 처리합니다.
            if (val) {
                if (['+', '-', '*', '/'].includes(val)) {
                    handleAction(val);
                } else {
                    handleNumber(val);
                }
            } else if (action) {
                handleAction(action);
            }
        };
    });
}

// 키보드 지원 (버그 수정: preventDefault 및 연산자 즉시 반영)
document.addEventListener('keydown', (e) => {
    // 숫자 및 소수점
    if (/[0-9]/.test(e.key)) {
        handleNumber(e.key);
    } else if (e.key === '.') {
        handleNumber('.');
    }
    // 연산자
    else if (['+', '-', '*', '/'].includes(e.key)) {
        handleAction(e.key);
    }
    // 엔터/결과
    else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleAction('calculate');
    }
    // 백스페이스
    else if (e.key === 'Backspace') {
        handleAction('backspace');
    }
    // 초기화
    else if (e.key === 'Escape') {
        handleAction('clear');
    }
});

// 기록 관리
function saveHistory(formula, result) {
    history.unshift({ formula, result });
    if (history.length > 30) history.pop();
    localStorage.setItem('calc_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `<div>${item.formula}</div><div>= ${item.result.toLocaleString()}</div>`;
        historyItem.onclick = () => {
            const val = String(item.result);
            if (currentMode === "calc") {
                currentVal = val;
                isWaitingForNext = false;
                updateDisplay();
            } else {
                fromAmount = val;
                updateExchange();
            }
            document.getElementById('history-panel').classList.remove('active');
        };
        list.appendChild(historyItem);
    });
}

document.getElementById('btn-history').onclick = () => document.getElementById('history-panel').classList.add('active');
document.getElementById('close-history').onclick = () => document.getElementById('history-panel').classList.remove('active');
document.getElementById('clear-history-btn').onclick = () => { history = []; grandTotal = 0; renderHistory(); updateDisplay(); };
document.getElementById('from-currency').onchange = updateExchange;
document.getElementById('to-currency').onchange = updateExchange;