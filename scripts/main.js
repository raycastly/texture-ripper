// ==================== INITIALIZATION ====================
// Initialize panels when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    let drawingMode = false;
    let currentPolygon = null;
    let placedPoints = [];
    
    const stageLeft = LeftPanelManager.init(
        'canvasLeftContainer', 
        'addRectLeft', 
        'deleteObjLeft', 
        'bgUploadLeft'
    );
    
    const stageRight = RightPanelManager.init('canvasRightContainer');

    // Set Size button
    document.getElementById('resizeRight').addEventListener('click', () => {
        const newWidth = parseInt(document.getElementById('rightWidth').value);
        const newHeight = parseInt(document.getElementById('rightHeight').value);

        if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) return;

        // Resize bgRect only
        stageRight.bgRect.width(newWidth);
        stageRight.bgRect.height(newHeight);

        // Update background
        if (window.rightPanel && window.rightPanel.updateBackground) {
            window.rightPanel.updateBackground();
        }

        stageRight.draw(); // Redraw the stage
    });

    // Auto Pack button
    document.getElementById('autoPack').addEventListener('click', () => {
        RightPanelManager.autoPackTextures(stageRight, false);
    });

    // Export button
    document.getElementById('exportRight').addEventListener('click', () => {
        const exportWidth = parseInt(document.getElementById('rightWidth').value);
        const exportHeight = parseInt(document.getElementById('rightHeight').value);

        if (isNaN(exportWidth) || isNaN(exportHeight) || exportWidth <= 0 || exportHeight <= 0) return;

        // Temporarily reset stage position for clean export
        const originalX = stageRight.x();
        const originalY = stageRight.y();
        const originalScaleX = stageRight.scaleX();
        const originalScaleY = stageRight.scaleY();

        // Reset to no panning/zooming for export
        stageRight.x(0);
        stageRight.y(0);
        stageRight.scaleX(1);
        stageRight.scaleY(1);
        stageRight.batchDraw();

        // Get the main image layer
        const imageLayer = stageRight.findOne('.imageLayer');
        if (!imageLayer) return;

        const transparent = document.getElementById('exportTransparent').checked;

        // Store original background visibility
        const originalBgVisibility = stageRight.bgRect.visible();
        
        // For transparent export, hide the background
        // For non-transparent export, ensure background is visible
        if (transparent) {
            stageRight.bgRect.visible(false);
        } else {
            stageRight.bgRect.visible(true);
        }

        // Export the specified area
        const dataURL = stageRight.toDataURL({
            x: stageRight.bgRect.x(),
            y: stageRight.bgRect.y(),
            width: stageRight.bgRect.width(),
            height: stageRight.bgRect.height(),
            pixelRatio: 1,
            mimeType: 'image/png',
            quality: 1
        });

        // Restore background visibility
        stageRight.bgRect.visible(originalBgVisibility);

        // Restore stage position
        stageRight.x(originalX);
        stageRight.y(originalY);
        stageRight.scaleX(originalScaleX);
        stageRight.scaleY(originalScaleY);
        stageRight.batchDraw();

        // Trigger download
        const link = document.createElement('a');
        link.download = 'atlas.png';
        link.href = dataURL;
        link.click();
    });

    // Add event listener for the transparency toggle
    document.getElementById('exportTransparent').addEventListener('change', (e) => {
        const isTransparent = e.target.checked;
        RightPanelManager.toggleTransparency(stageRight, isTransparent);
    });

    // Update version number directly from package.json
    fetch('./package.json')
        .then(r => r.json())
        .then(data => {
            const versionText = document.getElementById('version-text');
            versionText.textContent = `v${data.version}`;
        })
        .catch(error => {
            console.log('Could not load version from package.json, using default');
            document.getElementById('version-text').textContent = 'v1.0.0';
        });
        
    // Copy version to clipboard
    document.getElementById('copyVersion').addEventListener('click', () => {
        const version = document.getElementById('version-text').textContent;
        navigator.clipboard.writeText(version).then(() => {
            FeedbackManager.show(`Version number copied to clipboard!`);
        });
    });

    // Open report issue page
    document.getElementById('reportIssue').addEventListener('click', () => {
        openExternalURL('https://github.com/raycastly/texture-ripper/issues/new?template=bug_report.yml');
    });

    // Open request feature page
    document.getElementById('requestFeature').addEventListener('click', () => {
        openExternalURL('https://github.com/raycastly/texture-ripper/issues/new?template=feature_request.yml');
    });
});


// ===== AUTO-UPDATER UI INTEGRATION (Electron only) =====
// Check if we're running in Electron
const isElectron = () => {
    // Renderer process
    if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
        return true;
    }
    
    // Main process
    if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
        return true;
    }
    
    // Detect the user agent when the `nodeIntegration` option is enabled
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }
    
    return false;
};

if (isElectron()) {
    // We're in Electron - enable auto-updater
    const { ipcRenderer } = require('electron');

    // Get and display version
    ipcRenderer.invoke('get-app-version').then(version => {
        console.log('App version:', version);
        document.getElementById('version-text').textContent = `v${version}`;
    }).catch(error => {
        console.log('Could not get version from Electron:', error);
        fallbackToPackageJsonVersion();
    });

    // Update status handling
    ipcRenderer.on('update-available', (event, info) => {
        console.log('Update available:', info);
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = `⬇️ Downloading v${info.version}...`;
        statusText.style.display = 'inline';
    });

    ipcRenderer.on('update-downloaded', (event, info) => {
        console.log('Update downloaded:', info);
        const statusText = document.getElementById('update-status-text');
        const restartBtn = document.getElementById('restart-btn');
        
        statusText.textContent = `✅ Update v${info.version} ready!`;
        restartBtn.style.display = 'inline-block';
        statusText.style.display = 'inline';
        
        restartBtn.onclick = () => {
            ipcRenderer.invoke('restart-and-install');
        };
    });

    ipcRenderer.on('download-progress', (event, progress) => {
        console.log('Download progress:', progress.percent);
        const statusText = document.getElementById('update-status-text');
        if (statusText.textContent.includes('Downloading')) {
            statusText.textContent = `⬇️ Downloading: ${Math.round(progress.percent)}%`;
        }
    });

    ipcRenderer.on('update-error', (event, error) => {
        console.log('Update error:', error);
        const statusText = document.getElementById('update-status-text');
        
        // Don't show error for "no update available"
        if (!error.includes('No published versions') && !error.includes('404')) {
            statusText.textContent = '❌ Update failed';
            statusText.style.display = 'inline';
            setTimeout(() => { statusText.style.display = 'none'; }, 5000);
        }
    });

    ipcRenderer.on('update-not-available', (event, info) => {
        console.log('No updates available:', info);
        const statusText = document.getElementById('update-status-text');
        statusText.textContent = '✅ You have the latest version!';
        statusText.style.display = 'inline';
        setTimeout(() => { statusText.style.display = 'none'; }, 3000);
    });

    // Manual check button (Electron only)
    document.getElementById('check-updates').addEventListener('click', () => {
        console.log('Manual update check');
        ipcRenderer.invoke('check-for-updates');
    });

} else {
    // We're in browser - hide update-related UI
    console.log('Running in browser - disabling auto-updater');
    
    // Hide update buttons
    const checkUpdatesBtn = document.getElementById('check-updates');
    const restartBtn = document.getElementById('restart-btn');
    const statusText = document.getElementById('update-status-text');
    
    if (checkUpdatesBtn) checkUpdatesBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
    if (statusText) statusText.style.display = 'none';
    
    // Get version from package.json for browser
    fallbackToPackageJsonVersion();
}



// Add this to your browser/Electron detection code
if (isElectron()) {
    // We're in Electron - hide download button
    const downloadBtn = document.getElementById('download-desktop');
    if (downloadBtn) {
        downloadBtn.style.display = 'none';
    }
} else {
    // We're in browser - show download button
    const downloadBtn = document.getElementById('download-desktop');
    if (downloadBtn) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = () => {
            window.open('https://github.com/raycastly/texture-ripper/releases/latest', '_blank');
        };
    }
}


// Fallback to package.json version (for browser)
function fallbackToPackageJsonVersion() {
    fetch('./package.json')
        .then(r => r.json())
        .then(data => {
            const versionText = document.getElementById('version-text');
            versionText.textContent = `v${data.version}`;
        })
        .catch(error => {
            console.log('Could not load version from package.json, using default');
            document.getElementById('version-text').textContent = 'v1.0.0';
        });
}

// Handle both Electron and browser environments
function openExternalURL(url) {
    if (isElectron()) {
        // We're in Electron - use shell.openExternal
        const { shell } = require('electron');
        shell.openExternal(url);
    } else {
        // We're in browser - use window.open
        window.open(url, '_blank');
    }
}