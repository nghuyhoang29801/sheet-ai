// DOM Elements
const btnMic = document.getElementById('btnMic');
const statusTitle = document.getElementById('statusTitle');
const transcriptText = document.getElementById('transcriptText');
const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsModal = document.getElementById('settingsModal');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnDeleteProfile = document.getElementById('btnDeleteProfile');
const btnClearCache = document.getElementById('btnClearCache');
const btnAddProfile = document.getElementById('btnAddProfile');
const profileList = document.getElementById('profileList');
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
const inputUseAI = document.getElementById('useAI');
const inputSystemPrompt = document.getElementById('systemPrompt');
const inputProfileName = document.getElementById('profileName');
const aiSection = document.getElementById('aiSection');

// --- Profile Management ---
const STORAGE_KEY = 'sheetAiProfiles';
const ACTIVE_KEY = 'sheetAiActiveProfile';

const DEFAULT_PROFILE = {
    name: 'app-test',
    aiProvider: 'groq',
    geminiKey: '',
    groqKey: '1',
    gasUrl: 'https://script.google.com/macros/s/AKfycbzD9HF48vUdK4nTv9WjbPUHZwTmFAayBTCxJATGTdvELLHlkfbt5yxwRwfkRTn16RLW1A/exec',
    useAI: true,
    systemPrompt: 'Chỉ trả về DUY NHẤT một JSON hợp lệ với cấu trúc:\n\n{\n"food": "",\n"total_amount": 0,\n"people_count": 0 \n}'
};

function loadProfiles() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [{ ...DEFAULT_PROFILE, id: 1 }];
    const profiles = JSON.parse(saved);
    // ensure every profile has a valid id
    profiles.forEach((p, i) => { if (!p.id) p.id = Date.now() + i; });
    return profiles;
}

function saveProfiles(profiles) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function getActiveId() {
    const val = localStorage.getItem(ACTIVE_KEY);
    return val ? Number(val) : null;
}

function setActiveId(id) {
    localStorage.setItem(ACTIVE_KEY, String(id));
}

function getActiveProfile() {
    const profiles = loadProfiles();
    const id = getActiveId();
    return profiles.find(p => p.id === id) || profiles[0];
}

// State
let isListening = false;
let recognition = null;
let isLoadingProfile = false;

// Initialize
function init() {
    let profiles = loadProfiles();
    if (!getActiveId()) setActiveId(profiles[0].id);
    renderProfileList();
    loadProfileToForm(getActiveProfile());
    initSpeechRecognition();
    setupEventListeners();
}

function renderProfileList() {
    const profiles = loadProfiles();
    const activeId = getActiveId();
    profileList.innerHTML = profiles.map(p => `
        <button class="profile-chip ${String(p.id) === String(activeId) ? 'active' : ''}" data-id="${p.id}">
            ${p.name || 'Untitled'}
        </button>
    `).join('');

    profileList.querySelectorAll('.profile-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveId(Number(btn.dataset.id));
            renderProfileList();
            loadProfileToForm(getActiveProfile());
        });
    });
}

function loadProfileToForm(profile) {
    isLoadingProfile = true;
    inputProfileName.value = profile.name || '';
    selectAiProvider.value = profile.aiProvider || 'groq';
    inputGeminiKey.value = profile.geminiKey || '';
    inputGroqKey.value = profile.groqKey || '';
    inputGasUrl.value = profile.gasUrl || '';
    inputUseAI.checked = profile.useAI !== false;
    inputSystemPrompt.value = profile.systemPrompt || '';
    toggleProviderUI();
    isLoadingProfile = false;
}

function saveCurrentProfile(silent = false) {
    if (isLoadingProfile) return;
    const profiles = loadProfiles();
    const activeId = getActiveId();
    const idx = profiles.findIndex(p => p.id === activeId);
    if (idx === -1) return;

    profiles[idx] = {
        ...profiles[idx],
        name: inputProfileName.value.trim() || 'Untitled',
        aiProvider: selectAiProvider.value,
        geminiKey: inputGeminiKey.value.trim(),
        groqKey: inputGroqKey.value.trim(),
        gasUrl: inputGasUrl.value.trim(),
        useAI: inputUseAI.checked,
        systemPrompt: inputSystemPrompt.value.trim()
    };

    saveProfiles(profiles);
    renderProfileList();

    if (!silent) {
        settingsModal.classList.add('hidden');
        showToast('Đã lưu cài đặt');
    }
}

function addNewProfile() {
    const profiles = loadProfiles();
    const newProfile = { ...DEFAULT_PROFILE, id: Date.now(), name: `Profile ${profiles.length + 1}` };
    profiles.push(newProfile);
    saveProfiles(profiles);
    setActiveId(newProfile.id);
    renderProfileList();
    loadProfileToForm(newProfile);
}

function deleteCurrentProfile() {
    let profiles = loadProfiles();
    if (profiles.length === 1) { showToast('Cần ít nhất 1 profile'); return; }
    const activeId = getActiveId();
    profiles = profiles.filter(p => p.id !== activeId);
    saveProfiles(profiles);
    setActiveId(profiles[0].id);
    renderProfileList();
    loadProfileToForm(profiles[0]);
    showToast('Đã xoá profile');
}

function toggleProviderUI() {
    const useAI = inputUseAI.checked;
    aiSection.classList.toggle('hidden', !useAI);
    if (useAI) {
        if (selectAiProvider.value === 'gemini') {
            groupGemini.classList.remove('hidden');
            groupGroq.classList.add('hidden');
        } else {
            groupGemini.classList.add('hidden');
            groupGroq.classList.remove('hidden');
        }
    }
}

function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Trình duyệt không hỗ trợ nhận diện giọng nói. Dùng Chrome/Safari.');
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
        let interim = '', final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }
        transcriptText.textContent = final || interim;
    };

    recognition.onerror = (event) => {
        console.error('Speech error', event.error);
        stopListening();
        statusTitle.textContent = 'Lỗi nhận diện';
        if (event.error === 'not-allowed') showToast('Vui lòng cấp quyền sử dụng microphone.');
    };

    recognition.onend = () => {
        if (isListening) {
            stopListening();
            const text = transcriptText.textContent.trim();
            if (text.length > 0) processInput(text);
            else {
                statusTitle.textContent = 'Không nghe rõ';
                setTimeout(() => { statusTitle.textContent = 'Chạm để nói'; }, 2000);
            }
        }
    };
}

function startListening() {
    const profile = getActiveProfile();
    if ((profile.useAI && !profile.geminiKey && profile.aiProvider === 'gemini') ||
        (profile.useAI && !profile.groqKey && profile.aiProvider === 'groq') ||
        !profile.gasUrl) {
        showToast('Vui lòng cấu hình API Key và GAS URL trước.');
        settingsModal.classList.remove('hidden');
        return;
    }
    try { recognition.start(); } catch (e) { }
}

function stopListening() {
    isListening = false;
    btnMic.classList.remove('listening');
    try { recognition.stop(); } catch (e) { }
}

function toggleListening() {
    isListening ? stopListening() : startListening();
}

// Process
async function processInput(text) {
    const profile = getActiveProfile();

    if (!profile.useAI) {
        await sendToGoogleSheets({ raw_text: text }, profile.gasUrl);
        return;
    }

    statusTitle.textContent = 'Đang xử lý AI...';

    try {
        let response;
        if (profile.aiProvider === 'groq') {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.groqKey}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'system', content: profile.systemPrompt }, { role: 'user', content: text }],
                    temperature: 0.1
                })
            });
        } else {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${profile.geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: profile.systemPrompt }] },
                    contents: [{ parts: [{ text }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Lỗi AI API');
        }

        const data = await response.json();
        const aiContent = profile.aiProvider === 'groq'
            ? data.choices[0].message.content
            : data.candidates[0].content.parts[0].text;

        let parsed;
        try {
            parsed = JSON.parse(aiContent.replace(/```json\n?|```/g, '').trim());
        } catch (e) {
            parsed = { raw_text: aiContent };
        }
        parsed.raw_text = text;
        await sendToGoogleSheets(parsed, profile.gasUrl);

    } catch (error) {
        console.error(error);
        statusTitle.textContent = 'AI lỗi, lưu thô...';
        showToast('AI lỗi/quá tải, tự động lưu nguyên văn bản.');
        await sendToGoogleSheets({ raw_text: text }, profile.gasUrl);
    }
}

async function sendToGoogleSheets(data, url) {
    statusTitle.textContent = 'Đang lưu vào Sheet...';
    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        statusTitle.textContent = 'Hoàn tất!';
        showResult(data);
        setTimeout(() => { if (!isListening) statusTitle.textContent = 'Chạm để nói'; }, 3000);
    } catch (error) {
        console.error(error);
        statusTitle.textContent = 'Lỗi lưu dữ liệu';
        showToast('Không thể gửi đến Google Sheets.');
    }
}

function showResult(data) {
    const labels = { food: 'Món ăn', total_amount: 'Tổng tiền', people_count: 'Số người', raw_text: 'Nội dung thô', date: 'Ngày', amount: 'Số tiền', category: 'Danh mục', note: 'Ghi chú' };
    resultData.innerHTML = Object.entries(data).map(([key, value]) => {
        const label = labels[key] || key;
        const displayValue = (key === 'amount' || key === 'total_amount') && !isNaN(value) && value !== null
            ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
            : value;
        return `<div class="data-row"><span class="data-label">${label}</span><span class="data-value">${displayValue}</span></div>`;
    }).join('');
    resultCard.classList.remove('hidden');
}

// Event Listeners
function setupEventListeners() {
    btnMic.addEventListener('click', toggleListening);
    btnSettings.addEventListener('click', () => {
        renderProfileList();
        loadProfileToForm(getActiveProfile());
        settingsModal.classList.remove('hidden');
    });
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    btnSaveSettings.addEventListener('click', () => saveCurrentProfile(false));
    btnDeleteProfile.addEventListener('click', deleteCurrentProfile);
    btnClearCache.addEventListener('click', () => {
        if (!confirm('Xoá toàn bộ dữ liệu và về mặc định?')) return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_KEY);
        renderProfileList();
        loadProfileToForm(getActiveProfile());
        showToast('Đã reset về mặc định');
    });
    btnAddProfile.addEventListener('click', addNewProfile);

    selectAiProvider.addEventListener('change', () => { toggleProviderUI(); saveCurrentProfile(true); });
    [inputProfileName, inputGeminiKey, inputGroqKey, inputGasUrl, inputSystemPrompt].forEach(el =>
        el.addEventListener('input', () => saveCurrentProfile(true))
    );
    inputUseAI.addEventListener('change', () => { toggleProviderUI(); saveCurrentProfile(true); });

    btnSendText.addEventListener('click', sendTextInput);
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendTextInput(); });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
}

function sendTextInput() {
    const text = textInput.value.trim();
    if (!text) return;
    const profile = getActiveProfile();
    transcriptText.textContent = text;
    transcriptText.classList.add('active');
    textInput.value = '';
    if ((profile.useAI && !profile.geminiKey && profile.aiProvider === 'gemini') ||
        (profile.useAI && !profile.groqKey && profile.aiProvider === 'groq') ||
        !profile.gasUrl) {
        showToast('Vui lòng cấu hình API Key và GAS URL trước.');
        settingsModal.classList.remove('hidden');
        return;
    }
    processInput(text);
}

document.addEventListener('DOMContentLoaded', init);
