// DOM Elements
const btnMic = document.getElementById('btnMic');
const statusTitle = document.getElementById('statusTitle');
const transcriptText = document.getElementById('transcriptText');
const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsModal = document.getElementById('settingsModal');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const resultCard = document.getElementById('resultCard');
const resultData = document.getElementById('resultData');
const textInput = document.getElementById('textInput');
const btnSendText = document.getElementById('btnSendText');

// Settings Inputs
const inputGeminiKey = document.getElementById('geminiKey');
const inputGasUrl = document.getElementById('gasUrl');
const inputSystemPrompt = document.getElementById('systemPrompt');

// State
let isListening = false;
let recognition = null;
let settings = {
    geminiKey: '',
    gasUrl: '',
    systemPrompt: 'Bạn là trợ lý ghi log.\nNhiệm vụ: Ghi lại thông tin mà tôi đọc\n chưa có định dạng'
};

// Initialize
function init() {
    loadSettings();
    initSpeechRecognition();
    setupEventListeners();
}

function loadSettings() {
    const saved = localStorage.getItem('sheetAiSettings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
    inputGeminiKey.value = settings.geminiKey || '';
    inputGasUrl.value = settings.gasUrl || '';
    inputSystemPrompt.value = settings.systemPrompt || '';
}

function saveSettings(silent = false) {
    settings.geminiKey = inputGeminiKey.value.trim();
    settings.gasUrl = inputGasUrl.value.trim();
    settings.systemPrompt = inputSystemPrompt.value.trim();
    localStorage.setItem('sheetAiSettings', JSON.stringify(settings));

    if (silent !== true) {
        settingsModal.classList.add('hidden');
        showToast('Đã lưu cài đặt');
    }
}

function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Speech Recognition Setup
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome/Safari.');
        btnMic.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
        isListening = true;
        btnMic.classList.add('listening');
        statusTitle.textContent = 'Đang nghe...';
        transcriptText.textContent = '';
        transcriptText.classList.add('active');
        resultCard.classList.add('hidden');
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        transcriptText.textContent = finalTranscript || interimTranscript;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopListening();
        statusTitle.textContent = 'Lỗi nhận diện';
        if (event.error === 'not-allowed') {
            showToast('Vui lòng cấp quyền sử dụng microphone.');
        }
    };

    recognition.onend = () => {
        if (isListening) {
            stopListening();
            const text = transcriptText.textContent;
            if (text.trim().length > 0) {
                processVoiceCommand(text);
            } else {
                statusTitle.textContent = 'Không nghe rõ';
                setTimeout(() => { statusTitle.textContent = 'Chạm để nói'; }, 2000);
            }
        }
    };
}

function startListening() {
    if (!settings.geminiKey || !settings.gasUrl) {
        showToast('Vui lòng cấu hình API Key và Webhook URL trước.');
        settingsModal.classList.remove('hidden');
        return;
    }

    try {
        recognition.start();
    } catch (e) {
        // Recognition already started
    }
}

function stopListening() {
    isListening = false;
    btnMic.classList.remove('listening');
    try {
        recognition.stop();
    } catch (e) { }
}

function toggleListening() {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

// Process Data with Gemini
async function processVoiceCommand(text) {
    statusTitle.textContent = 'Đang xử lý AI...';

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${settings.geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: settings.systemPrompt }]
                },
                contents: [{
                    parts: [{ text: text }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Lỗi từ Gemini API');
        }

        const data = await response.json();
        const jsonContent = data.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(jsonContent);

        await sendToGoogleSheets(parsedData);

    } catch (error) {
        console.error(error);
        statusTitle.textContent = 'AI lỗi, đang lưu thô...';
        showToast('AI lỗi/quá tải, tự động lưu nguyên văn bản.');

        // Fallback: Send raw text to sheet
        await sendToGoogleSheets({ raw_text: text });
    }
}

// Send to Google Sheets
async function sendToGoogleSheets(data) {
    statusTitle.textContent = 'Đang lưu vào Sheet...';

    try {
        // Google Apps Script requires no-cors for POST usually, or JSONP, but we can do a simple POST
        // Make sure your GAS Web app is deployed to be accessible to "Anyone"
        const response = await fetch(settings.gasUrl, {
            method: 'POST',
            mode: 'no-cors', // Because GAS doesn't return proper CORS headers for preflight easily without extra code
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // with no-cors we can't read the response properly, but we assume success if no fetch error
        statusTitle.textContent = 'Hoàn tất!';
        showResult(data);

        setTimeout(() => {
            if (!isListening) statusTitle.textContent = 'Chạm để nói';
        }, 3000);

    } catch (error) {
        console.error(error);
        statusTitle.textContent = 'Lỗi lưu dữ liệu';
        showToast('Không thể gửi đến Google Sheets.');
    }
}

function showResult(data) {
    resultData.innerHTML = '';

    for (const [key, value] of Object.entries(data)) {
        // Simple translation for common keys
        const labels = {
            'food': 'Món ăn',
            'total_amount': 'Tổng tiền',
            'people_count': 'Số người',
            'raw_text': 'Nội dung thô',
            'date': 'Ngày',
            'amount': 'Số tiền',
            'category': 'Danh mục',
            'note': 'Ghi chú'
        };
        const label = labels[key] || key;

        let displayValue = value;
        if ((key === 'amount' || key === 'total_amount') && !isNaN(value) && value !== null) {
            displayValue = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
        }

        resultData.innerHTML += `
            <div class="data-row">
                <span class="data-label">${label}</span>
                <span class="data-value">${displayValue}</span>
            </div>
        `;
    }

    resultCard.classList.remove('hidden');
}

// Event Listeners
function setupEventListeners() {
    btnMic.addEventListener('click', toggleListening);
    btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    btnSaveSettings.addEventListener('click', () => saveSettings(false));

    // Auto-save settings to prevent cache loss
    inputGeminiKey.addEventListener('input', () => saveSettings(true));
    inputGasUrl.addEventListener('input', () => saveSettings(true));
    inputSystemPrompt.addEventListener('input', () => saveSettings(true));

    // Text input events
    btnSendText.addEventListener('click', sendTextInput);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTextInput();
        }
    });

    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });
}

function sendTextInput() {
    const text = textInput.value.trim();
    if (text) {
        transcriptText.textContent = text;
        transcriptText.classList.add('active');
        textInput.value = '';

        if (!settings.geminiKey || !settings.gasUrl) {
            showToast('Vui lòng cấu hình API Key và Webhook URL trước.');
            settingsModal.classList.remove('hidden');
            return;
        }
        processVoiceCommand(text);
    }
}

// Run
document.addEventListener('DOMContentLoaded', init);
