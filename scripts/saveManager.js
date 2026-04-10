// ==================== SAVE/LOAD MANAGER ====================
const SaveManager = {
    imageToDataURL(konvaImg) {
        const canvas = document.createElement('canvas');
        const htmlImg = konvaImg.image();
        canvas.width = htmlImg.naturalWidth || htmlImg.width;
        canvas.height = htmlImg.naturalHeight || htmlImg.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(htmlImg, 0, 0);
        return canvas.toDataURL('image/png');
    },

    save(stageLeft, stageRight) {
        const state = {
            version: 1,
            atlas: {
                width: parseInt(document.getElementById('rightWidth').value),
                height: parseInt(document.getElementById('rightHeight').value),
                transparent: document.getElementById('exportTransparent').checked
            },
            leftPanel: window.leftPanel ? window.leftPanel.getState() : { images: [], polygons: [] },
            rightPanel: window.rightPanel && window.rightPanel.getState ? window.rightPanel.getState() : { textures: [] }
        };
        const json = JSON.stringify(state);
        if (isElectron()) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('save-project', json).then(saved => {
                if (saved) FeedbackManager.show('Project saved!');
            });
        } else {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'project.trp'; a.click();
            URL.revokeObjectURL(url);
            FeedbackManager.show('Project saved!');
        }
    },

    load(stageLeft, stageRight) {
        const self = this;
        function handleData(json) {
            try { self.deserialize(JSON.parse(json), stageLeft, stageRight); }
            catch (e) { FeedbackManager.show('Failed to load project'); console.error('Load error:', e); }
        }
        if (isElectron()) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('open-project').then(data => { if (data) handleData(data); });
        } else {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.trp,.json';
            input.onchange = (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => handleData(evt.target.result);
                reader.readAsText(file);
            };
            input.click();
        }
    },

    deserialize(state, stageLeft, stageRight) {
        if (state.version !== 1) { FeedbackManager.show('Unsupported project file version'); return; }
        document.getElementById('rightWidth').value = state.atlas.width;
        document.getElementById('rightHeight').value = state.atlas.height;
        document.getElementById('exportTransparent').checked = state.atlas.transparent;
        stageRight.bgRect.width(state.atlas.width);
        stageRight.bgRect.height(state.atlas.height);
        RightPanelManager.toggleTransparency(stageRight, state.atlas.transparent);
        if (window.leftPanel && window.leftPanel.loadState) window.leftPanel.loadState(state.leftPanel);
        if (window.rightPanel && window.rightPanel.loadState) window.rightPanel.loadState(state.rightPanel);
        FeedbackManager.show('Project loaded!');
    }
};
