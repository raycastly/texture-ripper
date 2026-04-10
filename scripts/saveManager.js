// ==================== SAVE/LOAD MANAGER ====================
const SaveManager = {
    imageToDataURL(konvaImg, format = 'image/png', quality = 0.92) {
        const canvas = document.createElement('canvas');
        const htmlImg = konvaImg.image();
        canvas.width = htmlImg.naturalWidth || htmlImg.width;
        canvas.height = htmlImg.naturalHeight || htmlImg.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(htmlImg, 0, 0);
        return canvas.toDataURL(format, quality);
    },

    _buildState(stageLeft, stageRight) {
        return {
            version: 1,
            atlas: {
                width: parseInt(document.getElementById('rightWidth').value),
                height: parseInt(document.getElementById('rightHeight').value),
                transparent: document.getElementById('exportTransparent').checked
            },
            leftPanel: window.leftPanel ? window.leftPanel.getState() : { images: [], polygons: [] },
            rightPanel: window.rightPanel && window.rightPanel.getState ? window.rightPanel.getState() : { textures: [] }
        };
    },

    save(stageLeft, stageRight) {
        if (isElectron()) {
            const { ipcRenderer } = require('electron');
            const fs = require('fs');
            ipcRenderer.invoke('save-project-dialog').then(filePath => {
                if (filePath) {
                    FeedbackManager.showSpinner('Saving project...');
                    // Defer to let the spinner render before heavy sync work
                    setTimeout(() => {
                        try {
                            const state = this._buildState(stageLeft, stageRight);
                            const json = JSON.stringify(state);
                            fs.writeFileSync(filePath, json, 'utf8');
                            FeedbackManager.hideSpinner();
                            FeedbackManager.show('Project saved!');
                        } catch (err) {
                            FeedbackManager.hideSpinner();
                            FeedbackManager.show('Failed to save project', { bgColor: 'rgba(180,0,0,0.85)' });
                            console.error('Save error:', err);
                        }
                    }, 50);
                }
            });
        } else {
            const json = JSON.stringify(this._buildState(stageLeft, stageRight));
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
        if (isElectron()) {
            const { ipcRenderer } = require('electron');
            const fs = require('fs');
            ipcRenderer.invoke('open-project-dialog').then(filePath => {
                if (filePath) {
                    FeedbackManager.showSpinner('Loading project...');
                    setTimeout(() => {
                        try {
                            const json = fs.readFileSync(filePath, 'utf8');
                            self.deserialize(JSON.parse(json), stageLeft, stageRight);
                            FeedbackManager.hideSpinner();
                            FeedbackManager.show('Project loaded!');
                        } catch (e) {
                            FeedbackManager.hideSpinner();
                            FeedbackManager.show('Failed to load project', { bgColor: 'rgba(180,0,0,0.85)' });
                            console.error('Load error:', e);
                        }
                    }, 50);
                }
            });
        } else {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.trp,.json';
            input.onchange = (e) => {
                const file = e.target.files[0]; if (!file) return;
                FeedbackManager.showSpinner('Loading project...');
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        self.deserialize(JSON.parse(evt.target.result), stageLeft, stageRight);
                        FeedbackManager.hideSpinner();
                        FeedbackManager.show('Project loaded!');
                    } catch (e) {
                        FeedbackManager.hideSpinner();
                        FeedbackManager.show('Failed to load project', { bgColor: 'rgba(180,0,0,0.85)' });
                        console.error('Load error:', e);
                    }
                };
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
    }
};
