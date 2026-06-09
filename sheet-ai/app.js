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
const selectAiProvider = document.getElementById('aiProvider');
const groupGemini = document.getElementById('groupGemini');
const groupGroq = document.getElementById('groupGroq');
const inputGeminiKey = document.getElementById('geminiKey');
const inputGroqKey = document.getElementById('groqKey');
const inputGasUrl = document.getElementById('gasUrl');
const inputGasUrlRaw = document.getElementById('gasUrlRaw');
const inputRawOnly = document.getElementById('rawOnly');
const inputSystemPrompt = document.getElementById('systemPrompt');

// State
let isListening = false;
let recognition = null;
let settings = {
    aiProvider: 'gemini',
    geminiKey: '',
    groqKey: '',
    gasUrl: '',
    gasUrlRaw: '',
    rawOnly: false,
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
    selectAiProvider.value = settings.aiProvider || 'gemini';
    inputGeminiKey.value = settings.geminiKey || '';
    inputGroqKey.value = settings.groqKey || '';
    inputGasUrl.value = settings.gasUrl || '';
    inputGasUrlRaw.value = settings.gasUrlRaw || '';
    inputRawOnly.checked = settings.rawOnly || false;
    inputSystemPrompt.value = settings.systemPrompt || '';
    toggleProviderUI();
}

function saveSettings(silent = false) {
    settings.aiProvider = selectAiProvider.value;
    settings.geminiKey = inputGeminiKey.value.trim();
    settings.groqKey = inputGroqKey.value.trim();
    settings.gasUrl = inputGasUrl.value.trim();
    settings.gasUrlRaw = inputGasUrlRaw.value.trim();
    settings.rawOnly = inputRawOnly.checked;
    settings.systemPrompt = inputSystemPrompt.value.trim();
    localStorage.setItem('sheetAiSettings', JSON.stringify(settings));

    if (silent !== true) {
        settingsModal.classList.add('hidden');
        showToast('Đã lưu cài đặt');
    }
}

function toggleProviderUI() {
    if (selectAiProvider.value === 'gemini') {
        groupGemini.classList.remove('hidden');
        groupGroq.classList.add('hidden');
    } else {
        groupGemini.classList.add('hidden');
        groupGroq.classList.remove('hidden');
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
    if ((settings.aiProvider === 'gemini' && !settings.geminiKey) ||
        (settings.aiProvider === 'groq' && !settings.groqKey) ||
        !settings.gasUrl) {
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

// Process Data with AI
async function processVoiceCommand(text) {
    if (settings.rawOnly) {
        const url = settings.gasUrlRaw || settings.gasUrl;
        await sendToGoogleSheets({ raw_text: text }, url);
        return;
    }

    statusTitle.textContent = 'Đang xử lý AI...';

    try {
        let response;
        if (settings.aiProvider === 'groq') {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.groqKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: settings.systemPrompt },
                        { role: "user", content: text }
                    ],
                    temperature: 0.1
                })
            });
        } else {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${settings.geminiKey}`, {
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
                        temperature: 0.1
                    }
                })
            });
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Lỗi từ AI API');
        }

        const data = await response.json();
        let aiContent = '';
        if (settings.aiProvider === 'groq') {
            aiContent = data.choices[0].message.content;
        } else {
            aiContent = data.candidates[0].content.parts[0].text;
        }

        let parsedData;
        try {
            const cleanedContent = aiContent.replace(/```json\n?|```/g, '').trim();
            parsedData = JSON.parse(cleanedContent);
        } catch (e) {
            // Not JSON, treat as raw text
            parsedData = { raw_text: aiContent };
        }

        parsedData.raw_text = text;
        await sendToGoogleSheets(parsedData);

    } catch (error) {
        console.error(error);
        statusTitle.textContent = 'AI lỗi, đang lưu thô...';
        showToast('AI lỗi/quá tải, tự động lưu nguyên văn bản.');

        // Fallback: Send raw text to sheet
        await sendToGoogleSheets({ raw_text: text }, settings.gasUrlRaw || settings.gasUrl);
    }
}

// Send to Google Sheets
async function sendToGoogleSheets(data, url = settings.gasUrl) {
    statusTitle.textContent = 'Đang lưu vào Sheet...';

    const fetchOptions = {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };

    try {
        await fetch(url, fetchOptions);

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
    selectAiProvider.addEventListener('change', () => { toggleProviderUI(); saveSettings(true); });
    inputGeminiKey.addEventListener('input', () => saveSettings(true));
    inputGroqKey.addEventListener('input', () => saveSettings(true));
    inputGasUrl.addEventListener('input', () => saveSettings(true));
    inputGasUrlRaw.addEventListener('input', () => saveSettings(true));
    inputRawOnly.addEventListener('change', () => saveSettings(true));
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

        if ((settings.aiProvider === 'gemini' && !settings.geminiKey) ||
            (settings.aiProvider === 'groq' && !settings.groqKey) ||
            !settings.gasUrl) {
            showToast('Vui lòng cấu hình API Key và Webhook URL trước.');
            settingsModal.classList.remove('hidden');
            return;
        }
        processVoiceCommand(text);
    }
}

// Run
document.addEventListener('DOMContentLoaded', init);
