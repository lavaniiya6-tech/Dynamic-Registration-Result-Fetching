/**
 * ==============================================================================
 * COMMUNITY RUN: DYNAMIC REGISTRATION & RESULT FETCHING
 * Main Application Controller (Streamlined Single-Page Architecture)
 * Group 3 OS Project: Memory Management & Virtual Memory Simulator
 * ==============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'community_run_db_v3';
  const $ = (id) => document.getElementById(id);

  // Initialize MMU Simulation Core
  const mmu = new MemoryManagementUnit({
    frameCount: 4,
    policy: 'LRU',
    pageSize: 256
  });

  // Global App State
  let runners = [];
  let html5QrScanner = null;
  let isCameraActive = false;
  let isStressTesting = false;

  // ============================================================================
  // CHECK DIGIT ALGORITHM & BIB ALLOCATION
  // ============================================================================
  function calculateCheckDigit(num4) {
    const s = String(num4).padStart(4, '0');
    const weights = [3, 7, 1, 3];
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += (parseInt(s[i], 10) || 0) * weights[i];
    }
    return sum % 10;
  }

  function generateNextBib(category) {
    let base = 1001;
    if (category.includes('10K')) base = 2001;
    else if (category.includes('21K') || category.includes('Half')) base = 3001;

    const usedInCat = runners
      .filter(r => r.category === category)
      .map(r => parseInt(String(r.bib).split('-')[0], 10))
      .filter(n => !isNaN(n));

    if (usedInCat.length > 0) {
      base = Math.max(...usedInCat) + 1;
    }

    const checkDigit = calculateCheckDigit(base);
    return `${base}-${checkDigit}`;
  }

  // ============================================================================
  // DEFAULT RUNNER DATASET (Pre-Seeded with Authentic Matric Numbers)
  // ============================================================================
  function getDefaultRunners() {
    return [
      {
        bib: '1001-6',
        name: 'Courteney Jill Bobby',
        matricNo: '07DEE23F1046',
        email: 'courteney.bobby@student.edu.my',
        category: '5K Fun Run',
        finishTime: '00:24:18'
      },
      {
        bib: '1002-9',
        name: 'Nur Aisha Binti Rahman',
        matricNo: '07DEE23F1012',
        email: 'aisha.rahman@student.edu.my',
        category: '5K Fun Run',
        finishTime: '00:28:45'
      },
      {
        bib: '1003-2',
        name: 'Darren Tan Wei Ming',
        matricNo: '07DEE23F1025',
        email: 'darren.tan@student.edu.my',
        category: '5K Fun Run',
        finishTime: '00:31:02'
      },
      {
        bib: '2001-9',
        name: 'Muhammad Haziq Bin Yusof',
        matricNo: '07DEE23F2008',
        email: 'haziq.yusof@student.edu.my',
        category: '10K Challenge',
        finishTime: '00:52:14'
      },
      {
        bib: '2002-2',
        name: 'Kavitha Devi Muthusamy',
        matricNo: '07DEE23F2033',
        email: 'kavitha.devi@student.edu.my',
        category: '10K Challenge',
        finishTime: '00:58:30'
      },
      {
        bib: '3001-2',
        name: 'Ahmad Faiz Bin Roslan',
        matricNo: '07DEE23F3019',
        email: 'faiz.roslan@student.edu.my',
        category: '21K Half Marathon',
        finishTime: '01:46:50'
      },
      {
        bib: '3002-5',
        name: 'Sarah Jessica Lim',
        matricNo: '07DEE23F3041',
        email: 'sarah.lim@student.edu.my',
        category: '21K Half Marathon',
        finishTime: '01:54:12'
      },
      {
        bib: '3003-8',
        name: 'Brandon Lee Chee Keong',
        matricNo: '07DEE23F3055',
        email: 'brandon.lee@student.edu.my',
        category: '21K Half Marathon',
        finishTime: '' // In progress
      }
    ];
  }

  function loadDatabase() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        runners = JSON.parse(data);
        if (!Array.isArray(runners) || runners.length === 0) {
          runners = getDefaultRunners();
          saveDatabase();
        }
      } else {
        runners = getDefaultRunners();
        saveDatabase();
      }
    } catch (e) {
      console.warn('LocalStorage load failed, using defaults:', e);
      runners = getDefaultRunners();
    }

    mmu.syncRunners(runners);
  }

  function saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runners));
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  // ============================================================================
  // TOAST NOTIFICATIONS
  // ============================================================================
  function showToast(message, type = 'info') {
    const container = $('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================================================
  // REGISTRATION FORM CONTROLLER
  // ============================================================================
  function setupRegistrationForm() {
    const form = $('registrationForm');
    const catSelect = $('regCategory');
    const previewBib = $('previewAssignedBib');

    function updateBibPreview() {
      if (catSelect && previewBib) {
        previewBib.textContent = generateNextBib(catSelect.value);
      }
    }

    if (catSelect) catSelect.addEventListener('change', updateBibPreview);
    updateBibPreview();

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = $('regName').value.trim();
        const matricNo = $('regMatric').value.trim().toUpperCase();
        const category = $('regCategory').value;
        const email = $('regEmail').value.trim();

        if (!name || !matricNo || !email) {
          showToast('Please complete all required fields.', 'error');
          return;
        }

        const bib = generateNextBib(category);
        const newRunner = {
          bib,
          name,
          matricNo,
          email,
          category,
          finishTime: ''
        };

        runners.unshift(newRunner);
        saveDatabase();
        mmu.syncRunners(runners);

        form.reset();
        updateBibPreview();
        renderRunnerList();
        renderQuickScanButtons();

        showToast(`Runner registered! Assigned Bib ${bib}`, 'success');

        // Trigger memory lookup to page profile in
        executeMmuLookup(bib);
      });
    }
  }

  // ============================================================================
  // RUNNER LIST TABLE & CONTROLS
  // ============================================================================
  function renderRunnerList() {
    const tbody = $('runnerListTableBody');
    const emptyState = $('runnerEmptyState');
    const searchVal = ($('runnerSearchInput') ? $('runnerSearchInput').value : '').toLowerCase().trim();
    const filterCat = $('runnerCategoryFilter') ? $('runnerCategoryFilter').value : '';

    if (!tbody) return;

    $('runnerCountBadge').textContent = runners.length;

    const filtered = runners.filter(r => {
      const matchCat = !filterCat || r.category === filterCat;
      const matchQuery = !searchVal ||
        r.name.toLowerCase().includes(searchVal) ||
        r.bib.toLowerCase().includes(searchVal) ||
        (r.matricNo && r.matricNo.toLowerCase().includes(searchVal));
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(r => {
      const vpn = mmu.getPageNumberForRunner(r);
      const pte = mmu.pageTable.get(vpn);
      const inRam = pte && pte.valid === 1;

      let catClass = 'cat-5k';
      if (r.category.includes('10K')) catClass = 'cat-10k';
      if (r.category.includes('21K') || r.category.includes('Half')) catClass = 'cat-21k';

      return `
        <tr data-bib="${r.bib}">
          <td><span class="bib-pill">${r.bib}</span></td>
          <td>
            <strong>${escapeHtml(r.name)}</strong><br>
            <span style="font-size:0.72rem; color:var(--text-dim); font-family:var(--font-mono);">${escapeHtml(r.matricNo)}</span>
          </td>
          <td><span class="category-tag ${catClass}">${r.category}</span></td>
          <td>
            ${r.finishTime ? `<strong style="color:var(--accent-green); font-family:var(--font-mono);">${r.finishTime}</strong>` : '<span style="color:var(--text-dim); font-size:0.75rem;">Running...</span>'}
          </td>
          <td>
            ${inRam ? `<span class="status-badge status-valid">● RAM #${pte.frameNumber}</span>` : '<span class="status-badge status-invalid">○ DISK</span>'}
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="App.triggerLookup('${r.bib}')" title="Lookup via MMU">⚡ MMU</button>
              <button class="btn btn-secondary btn-sm" onclick="App.openBibModal('${r.bib}')" title="Printable Bib & QR">🏷️ Bib</button>
              <button class="btn btn-warning btn-sm" onclick="App.promptTime('${r.bib}')" title="Record Finish Time">⏱️ Time</button>
              <button class="btn btn-success btn-sm" onclick="App.openCertModal('${r.bib}')" title="View Finisher Certificate">🏆 Cert</button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteRunner('${r.bib}')" title="Delete Runner">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setupRunnerControls() {
    const search = $('runnerSearchInput');
    const cat = $('runnerCategoryFilter');
    const btnSeed = $('btnSeedDemo');
    const btnExport = $('btnExportCsv');

    if (search) search.addEventListener('input', renderRunnerList);
    if (cat) cat.addEventListener('change', renderRunnerList);

    if (btnSeed) {
      btnSeed.addEventListener('click', () => {
        runners = getDefaultRunners();
        saveDatabase();
        mmu.resetRAM();
        mmu.syncRunners(runners);
        renderRunnerList();
        renderQuickScanButtons();
        showToast('Demo runners loaded with authentic matric numbers!', 'success');
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', exportCsv);
    }
  }

  function exportCsv() {
    if (runners.length === 0) {
      showToast('No runners to export.', 'warning');
      return;
    }

    const headers = ['Bib', 'Full Name', 'Matric Number', 'Email Address', 'Category', 'Finish Time'];
    const rows = runners.map(r => [
      `"${r.bib}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.matricNo}"`,
      `"${r.email}"`,
      `"${r.category}"`,
      `"${r.finishTime || 'DNF'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Community_Run_Runners_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Runners database exported to CSV.', 'success');
  }

  // ============================================================================
  // CHECK-IN & QR SCANNER
  // ============================================================================
  function setupScanner() {
    const btnToggle = $('btnToggleCamera');
    const btnManual = $('btnManualLookup');
    const manualInput = $('manualBibInput');

    if (btnManual && manualInput) {
      btnManual.addEventListener('click', () => {
        const val = manualInput.value.trim();
        if (!val) {
          showToast('Please enter a bib number (e.g. 1001-6).', 'warning');
          return;
        }
        executeMmuLookup(val);
      });

      manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnManual.click();
      });
    }

    if (btnToggle) btnToggle.addEventListener('click', toggleCameraScanner);

    renderQuickScanButtons();
  }

  function renderQuickScanButtons() {
    const container = $('quickScanButtonsContainer');
    if (!container) return;

    if (runners.length === 0) {
      container.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">No runners registered yet.</span>';
      return;
    }

    container.innerHTML = runners.slice(0, 8).map(r => `
      <button class="btn btn-secondary btn-sm" onclick="App.triggerLookup('${r.bib}')" style="font-family:var(--font-mono);">
        ⚡ Scan ${r.bib} (${escapeHtml(r.name.split(' ')[0])})
      </button>
    `).join('');
  }

  function toggleCameraScanner() {
    const btn = $('btnToggleCamera');
    const statusMsg = $('cameraStatusMsg');

    if (isCameraActive) {
      if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
          html5QrScanner.clear();
          isCameraActive = false;
          if (btn) btn.textContent = '🎥 Start Camera';
          if (statusMsg) statusMsg.textContent = '📷 Camera standby. Use "Start Camera" or the 1-click test scan buttons below.';
          showToast('Camera stopped.', 'info');
        }).catch(err => console.warn('Error stopping scanner:', err));
      }
    } else {
      if (typeof window.Html5Qrcode !== 'function') {
        showToast('HTML5-QRCode library not ready. Use the 1-click test scan buttons below!', 'warning');
        return;
      }

      html5QrScanner = new window.Html5Qrcode('reader');
      const config = { fps: 10, qrbox: { width: 180, height: 180 } };

      html5QrScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          const bib = QRHelper.extractBib(decodedText);
          showToast(`QR Code Scanned -> Bib ${bib}`, 'success');
          executeMmuLookup(bib);
        },
        () => {}
      ).then(() => {
        isCameraActive = true;
        if (btn) btn.textContent = '🛑 Stop Camera';
        if (statusMsg) statusMsg.textContent = '🟢 Camera active. Show runner QR code.';
      }).catch(err => {
        console.error('Camera start error:', err);
        if (statusMsg) {
          statusMsg.innerHTML = `⚠️ Camera access unavailable.<br>Please use the 1-click test buttons below!`;
        }
        showToast('Camera not available. Use 1-click test buttons!', 'warning');
      });
    }
  }

  // ============================================================================
  // CORE MMU LOOKUP EXECUTION & VISUAL ANIMATION
  // ============================================================================
  function executeMmuLookup(bib) {
    if (!bib) return;
    const cleanBib = QRHelper.extractBib(bib);

    const result = mmu.accessRunnerByBib(cleanBib);
    const trace = result.trace;

    // Update Hardware Pipeline Display
    updatePipelineUI(trace);

    // Update Scanned Result Card in Scanner area
    displayScanResultCard(trace);

    // Flash row in Runner table
    highlightRunnerRow(cleanBib);

    // Flash Physical Memory Frame Card
    if (trace.assignedFrame !== null) {
      flashFrameCard(trace.assignedFrame, trace.isHit ? 'access-flash' : 'fault-load-flash');
    }

    // Flash Evicted Frame Card
    if (trace.evictedFrame !== null) {
      flashFrameCard(trace.evictedFrame, 'evict-flash');
    }

    // Toast Feedback
    if (trace.isHit) {
      showToast(`PAGE HIT! Bib ${cleanBib} read from RAM Frame #${trace.assignedFrame}.`, 'success');
    } else if (trace.isFault) {
      if (trace.evictedPage !== null) {
        showToast(`PAGE FAULT & EVICTION! Frame #${trace.evictedFrame} evicted Page #${trace.evictedPage}. Loaded Bib ${cleanBib}.`, 'warning');
      } else {
        showToast(`PAGE FAULT! Bib ${cleanBib} loaded from disk swap into Frame #${trace.assignedFrame}.`, 'error');
      }
    }

    renderRunnerList();
    renderPageTable();
    renderDiskSwapTable();
    renderFramesGrid();
  }

  function updatePipelineUI(trace) {
    const clock = $('pipelineClockTick');
    const pipeLogical = $('pipeLogicalAddr');
    const pipeSeg = $('pipeSegmentCheck');
    const pipeLinear = $('pipeLinearAddr');
    const pipeVpn = $('pipeVpnCheck');
    const pipePhys = $('pipePhysResult');

    if (clock) clock.textContent = `SIMULATION CLOCK: TICK #${trace.clock}`;
    if (pipeLogical) pipeLogical.textContent = trace.logicalAddress || `<Seg 0, Offset 0x0000>`;
    if (pipeSeg) {
      pipeSeg.textContent = trace.segment ? `${trace.segment.name} (PASS)` : 'PASSED';
      pipeSeg.style.color = 'var(--accent-green)';
    }
    if (pipeLinear) pipeLinear.textContent = trace.linearVirtualAddress || '0x0000';
    if (pipeVpn) pipeVpn.textContent = `VPN #${trace.vpn}`;
    if (pipePhys) {
      if (trace.isHit) {
        pipePhys.textContent = `HIT ➔ Frame #${trace.assignedFrame}`;
        pipePhys.style.color = 'var(--accent-green)';
      } else {
        pipePhys.textContent = `FAULT ➔ INT 14 (Frame #${trace.assignedFrame})`;
        pipePhys.style.color = 'var(--accent-red)';
      }
    }
  }

  function displayScanResultCard(trace) {
    const card = $('scannerResultCard');
    if (!card) return;

    const runner = trace.runner || runners.find(r => r.bib === trace.bib);
    if (!runner) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    $('scanResultBib').textContent = runner.bib;
    $('scanResultName').textContent = runner.name;

    const catBadge = $('scanResultCat');
    catBadge.textContent = runner.category;
    catBadge.className = 'category-tag ' + (runner.category.includes('10K') ? 'cat-10k' : runner.category.includes('21K') ? 'cat-21k' : 'cat-5k');

    $('scanResultMatric').textContent = runner.matricNo || 'N/A';
    $('scanResultEmail').textContent = runner.email || 'N/A';
    $('scanResultTime').textContent = runner.finishTime || 'In Progress (Not Finished)';

    const statusBadge = $('scanResultStatusBadge');
    if (trace.isHit) {
      statusBadge.textContent = 'PAGE HIT (RAM)';
      statusBadge.className = 'status-badge status-valid';
    } else {
      statusBadge.textContent = 'PAGE FAULT (LOADED)';
      statusBadge.className = 'status-badge status-dirty';
    }

    // Attach actions
    $('btnScanViewBib').onclick = () => openBibModal(runner.bib);
    $('btnScanRecordTime').onclick = () => promptRecordFinishTime(runner.bib);
    $('btnScanViewCert').onclick = () => openCertModal(runner.bib);
  }

  function highlightRunnerRow(bib) {
    const rows = document.querySelectorAll('#runnerListTableBody tr');
    rows.forEach(r => {
      if (r.dataset.bib === bib) {
        r.classList.add('highlight-access');
        setTimeout(() => r.classList.remove('highlight-access'), 1200);
      }
    });
  }

  function flashFrameCard(frameIndex, flashClass) {
    const card = document.getElementById(`frame-card-${frameIndex}`);
    if (card) {
      card.classList.add(flashClass);
      setTimeout(() => card.classList.remove(flashClass), 1200);
    }
  }

  // ============================================================================
  // RIGHT PANEL: LIVE OS MEMORY TABLES & VISUALIZATION
  // ============================================================================
  function renderSegmentTable() {
    const tbody = $('segmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = mmu.segmentTable.map(seg => `
      <tr>
        <td><strong>#${seg.id}</strong></td>
        <td><span style="font-family:var(--font-mono); color:var(--accent-purple); font-weight:700;">${seg.name}</span></td>
        <td><code>0x${seg.base.toString(16).toUpperCase()}</code></td>
        <td><code>0x${seg.limit.toString(16).toUpperCase()}</code></td>
        <td><span style="font-size:0.72rem; color:var(--text-muted);">${seg.protection}</span></td>
        <td><strong>${seg.recordCount}</strong></td>
        <td style="font-size:0.75rem; color:var(--text-dim);">${seg.description}</td>
      </tr>
    `).join('');
  }

  function renderPageTable() {
    const tbody = $('pageTableBody');
    if (!tbody) return;

    const entries = Array.from(mmu.pageTable.values());
    $('pageTableCount').textContent = entries.length;

    tbody.innerHTML = entries.map(pte => {
      const isValid = pte.valid === 1;
      const validBadge = isValid
        ? `<span class="status-badge status-valid">1 (RAM)</span>`
        : `<span class="status-badge status-invalid">0 (Disk)</span>`;

      const frameVal = isValid && pte.frameNumber !== null
        ? `<strong style="color:var(--accent-cyan); font-family:var(--font-mono);">#${pte.frameNumber}</strong>`
        : `<span style="color:var(--text-dim); font-family:var(--font-mono);">—</span>`;

      const dirtyBadge = pte.dirty === 1
        ? `<span class="status-badge status-dirty">1 (M)</span>`
        : `<span style="color:var(--text-dim); font-family:var(--font-mono);">0</span>`;

      const refBadge = pte.referenced === 1
        ? `<strong style="color:var(--accent-green); font-family:var(--font-mono);">1</strong>`
        : `<span style="color:var(--text-dim); font-family:var(--font-mono);">0</span>`;

      return `
        <tr>
          <td><span style="font-family:var(--font-mono); font-weight:700; color:var(--accent-cyan);">#${pte.pageNumber}</span></td>
          <td><span class="bib-pill">${pte.bib}</span></td>
          <td><strong>${escapeHtml(pte.runnerName)}</strong></td>
          <td><span style="font-size:0.72rem; color:var(--text-muted);">${pte.category}</span></td>
          <td>${validBadge}</td>
          <td>${frameVal}</td>
          <td>${dirtyBadge}</td>
          <td>${refBadge}</td>
          <td><code style="font-size:0.7rem; color:var(--text-dim);">${pte.diskBlock}</code></td>
        </tr>
      `;
    }).join('');
  }

  function renderDiskSwapTable() {
    const tbody = $('diskSwapTableBody');
    if (!tbody) return;

    const swapped = Array.from(mmu.pageTable.values()).filter(pte => pte.valid === 0);
    $('diskPagesCount').textContent = swapped.length;

    if (swapped.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:10px;">All active pages are currently in RAM.</td></tr>`;
      return;
    }

    tbody.innerHTML = swapped.map(p => `
      <tr>
        <td><code style="color:var(--accent-cyan); font-size:0.75rem;">${p.diskBlock}</code></td>
        <td><strong style="font-family:var(--font-mono);">Page #${p.pageNumber}</strong></td>
        <td><span class="bib-pill">${p.bib}</span></td>
        <td>${escapeHtml(p.runnerName)}</td>
        <td><span style="font-size:0.72rem; color:var(--text-muted);">${p.category}</span></td>
        <td><span class="status-badge status-invalid">SWAPPED OUT</span></td>
      </tr>
    `).join('');
  }

  function renderFramesGrid() {
    const container = $('framesGridContainer');
    if (!container) return;

    $('framesOccupiedCount').textContent = mmu.frames.filter(f => f.status === 'OCCUPIED').length;
    $('framesTotalCount').textContent = mmu.frameCount;

    container.innerHTML = mmu.frames.map((frame, idx) => {
      const isOccupied = frame.status === 'OCCUPIED' && frame.runner;
      const runner = frame.runner;

      if (!isOccupied) {
        return `
          <div class="frame-card empty-frame" id="frame-card-${idx}">
            <div class="frame-header">
              <span class="frame-id">FRAME #${idx}</span>
              <span class="frame-addr">${frame.baseAddress}</span>
            </div>
            <div class="frame-content" style="padding:14px 0; text-align:center;">
              <span style="color:var(--text-dim); font-size:0.8rem; font-style:italic;">[ Unallocated / Free Frame ]</span>
            </div>
            <div class="frame-footer">
              <span>STATUS: EMPTY</span>
              <span>SLOT #${idx}</span>
            </div>
          </div>
        `;
      }

      let catClass = 'cat-5k';
      if (runner.category.includes('10K')) catClass = 'cat-10k';
      if (runner.category.includes('21K') || runner.category.includes('Half')) catClass = 'cat-21k';

      return `
        <div class="frame-card occupied" id="frame-card-${idx}">
          <div class="frame-header">
            <span class="frame-id">FRAME #${idx}</span>
            <span class="frame-addr">${frame.baseAddress}</span>
          </div>
          <div class="frame-content">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="bib-pill">${runner.bib}</span>
              <span class="category-tag ${catClass}" style="font-size:0.65rem;">${runner.category}</span>
            </div>
            <div class="frame-runner-name">${escapeHtml(runner.name)}</div>
            <div class="frame-meta">
              <span>Page #${frame.pageNumber}</span>
              <span>${runner.finishTime ? `<strong style="color:var(--accent-green);">${runner.finishTime}</strong>` : 'Running...'}</span>
            </div>
          </div>
          <div class="frame-footer">
            <span>Clock In: #${frame.loadedAt}</span>
            <span>Last Ref: #${frame.lastAccess}</span>
          </div>
        </div>
      `;
    }).join('');

    renderQueueOrder();
  }

  function renderQueueOrder() {
    const container = $('queueItemsContainer');
    const label = $('queueLabel');
    if (!container) return;

    if (mmu.policy === 'FIFO') {
      label.textContent = 'FIFO Queue (Oldest Entry ➔ Newest):';
      if (mmu.fifoQueue.length === 0) {
        container.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">RAM is empty</span>';
        return;
      }

      container.innerHTML = mmu.fifoQueue.map((vpn, idx) => {
        const isVictimCandidate = idx === 0;
        const pte = mmu.pageTable.get(vpn);
        const bib = pte ? pte.bib : `Page #${vpn}`;
        return `
          <span class="queue-chip ${isVictimCandidate ? 'victim-candidate' : ''}" title="${isVictimCandidate ? 'Next Victim under FIFO' : ''}">
            ${isVictimCandidate ? '⚠️ VICTIM: ' : ''}Page #${vpn} (${bib})
          </span>
          ${idx < mmu.fifoQueue.length - 1 ? '<span style="color:var(--text-dim);">➔</span>' : ''}
        `;
      }).join('');
    } else {
      label.textContent = 'LRU Stack (Least Recent ➔ Most Recent):';
      const occupied = mmu.frames.filter(f => f.status === 'OCCUPIED').sort((a, b) => a.lastAccess - b.lastAccess);

      if (occupied.length === 0) {
        container.innerHTML = '<span style="color:var(--text-dim); font-size:0.75rem;">RAM is empty</span>';
        return;
      }

      container.innerHTML = occupied.map((f, idx) => {
        const isVictimCandidate = idx === 0;
        return `
          <span class="queue-chip ${isVictimCandidate ? 'victim-candidate' : ''}" title="${isVictimCandidate ? 'Next Victim under LRU' : ''}">
            ${isVictimCandidate ? '⚠️ VICTIM: ' : ''}Frame #${f.frameId} (Page #${f.pageNumber} · Bib ${f.runner.bib})
          </span>
          ${idx < occupied.length - 1 ? '<span style="color:var(--text-dim);">➔</span>' : ''}
        `;
      }).join('');
    }
  }

  // MMU Event Listeners
  mmu.on('onStatsUpdate', (stats) => {
    $('statHits').textContent = stats.pageHits;
    $('statFaults').textContent = stats.pageFaults;
    $('statHitRate').textContent = stats.hitRate;
    $('statEvictions').textContent = stats.evictions;
    $('hudActivePolicyTag').textContent = `POLICY: ${stats.policy}`;
  });

  mmu.on('onLog', (entry) => {
    const consoleBox = $('mmuConsoleLogs');
    if (!consoleBox) return;

    let tagClass = 'log-tag';
    if (entry.tag.includes('HIT')) tagClass += ' log-tag-HIT';
    else if (entry.tag.includes('FAULT') || entry.tag.includes('TRAP')) tagClass += ' log-tag-FAULT';
    else if (entry.tag.includes('EVICT') || entry.tag.includes('VICTIM') || entry.tag.includes('DIRTY')) tagClass += ' log-tag-EVICT';
    else if (entry.tag.includes('SEG')) tagClass += ' log-tag-SEG';
    else if (entry.tag.includes('SWAP') || entry.tag.includes('FRAME')) tagClass += ' log-tag-SWAP';

    const logDiv = document.createElement('div');
    logDiv.className = 'log-line';
    logDiv.innerHTML = `<span class="log-time">[${entry.time}]</span><span class="${tagClass}">[${entry.tag}]</span><span class="log-msg">${escapeHtml(entry.message)}</span>`;
    consoleBox.prepend(logDiv);
  });

  // ============================================================================
  // HEAVY LOAD STRESS TEST SIMULATOR
  // ============================================================================
  function setupStressTest() {
    const btns = [$('btnHeavyLoad'), $('btnHeavyLoadTop')];
    btns.forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', runHeavyLoadTest);
    });
  }

  function runHeavyLoadTest() {
    if (isStressTesting) return;
    if (runners.length === 0) {
      showToast('Please register runners or seed demo runners first.', 'warning');
      return;
    }

    isStressTesting = true;
    showToast('Starting Heavy Load Test: Bursting lookups to demonstrate evictions...', 'warning');

    const sampleBibs = runners.map(r => r.bib);
    let step = 0;
    const totalSteps = 8;

    const interval = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(interval);
        isStressTesting = false;
        showToast('Heavy load test complete! Observe the hit rate & evictions count.', 'success');
        return;
      }

      const randomBib = sampleBibs[Math.floor(Math.random() * sampleBibs.length)];
      executeMmuLookup(randomBib);
      step++;
    }, 600);
  }

  // ============================================================================
  // FINISH TIME PROMPT
  // ============================================================================
  function promptRecordFinishTime(bib) {
    const runner = runners.find(r => r.bib === bib);
    if (!runner) return;

    const time = prompt(`Enter finish time for ${runner.name} (hh:mm:ss, e.g. 00:27:35):`, runner.finishTime || '00:25:00');
    if (time === null) return;

    runner.finishTime = time.trim();
    saveDatabase();
    mmu.markDirty(bib, runner);

    showToast(`Saved finish time for Bib ${bib}. Dirty Bit (M=1) activated in Page Table.`, 'success');
    renderRunnerList();
    renderPageTable();
    renderFramesGrid();

    const currentScanBib = $('scanResultBib');
    if (currentScanBib && currentScanBib.textContent === bib) {
      $('scanResultTime').textContent = runner.finishTime;
    }
  }

  // ============================================================================
  // PRINTABLE BIB MODAL
  // ============================================================================
  function openBibModal(bib) {
    const runner = runners.find(r => r.bib === bib);
    if (!runner) return;

    $('modalBibNumber').textContent = runner.bib;
    $('modalBibRunnerName').textContent = runner.name.toUpperCase();
    $('modalBibMatric').textContent = `NO. MATRIK: ${runner.matricNo || 'N/A'}`;

    const banner = $('modalBibCatBanner');
    banner.textContent = runner.category.toUpperCase();
    banner.className = 'bib-category-banner ' + (runner.category.includes('10K') ? 'bib-cat-10k' : runner.category.includes('21K') ? 'bib-cat-21k' : 'bib-cat-5k');

    $('modalBibCheckFormula').textContent = `CHECK DIGIT: VALID (MOD-10)`;

    // Render QR Code
    const qrBox = $('modalBibQrBox');
    const qrData = `CR2026:BIB=${runner.bib};NAME=${encodeURIComponent(runner.name)};MATRIC=${runner.matricNo}`;
    QRHelper.render(qrBox, qrData, { width: 108, height: 108 });

    $('bibModalBackdrop').classList.add('show');
  }

  function closeBibModal() {
    $('bibModalBackdrop').classList.remove('show');
  }

  // ============================================================================
  // PRINTABLE FINISHER CERTIFICATE MODAL
  // ============================================================================
  function openCertModal(bib) {
    const runner = runners.find(r => r.bib === bib);
    if (!runner) return;

    $('certRunnerName').textContent = runner.name;
    $('certRunnerMatric').textContent = `Matric No: ${runner.matricNo || 'N/A'}`;
    $('certBib').textContent = runner.bib;
    $('certCategory').textContent = runner.category;
    $('certFinishTime').textContent = runner.finishTime || '00:25:00';

    const sig = `CR-2026-HASH-0x${(calculateCheckDigit(parseInt(runner.bib, 10) || 1000) * 0x1A4F + 0x3E1).toString(16).toUpperCase()}`;
    $('certHashSignature').textContent = sig;

    // Render verification QR code on Certificate
    const qrBox = $('certQrCanvasBox');
    const verifyData = `CR-VERIFY:BIB=${runner.bib};TIME=${runner.finishTime || '00:25:00'};SIG=${sig}`;
    QRHelper.render(qrBox, verifyData, { width: 80, height: 80 });

    $('certModalBackdrop').classList.add('show');
  }

  function closeCertModal() {
    $('certModalBackdrop').classList.remove('show');
  }

  // ============================================================================
  // HOW TO DEMO MODAL
  // ============================================================================
  function openGuideModal() {
    $('guideModalBackdrop').classList.add('show');
  }

  function closeGuideModal() {
    $('guideModalBackdrop').classList.remove('show');
  }

  // ============================================================================
  // MODAL EVENT BINDINGS
  // ============================================================================
  function setupModals() {
    $('btnCloseBibModal').onclick = closeBibModal;
    $('btnCloseBibModal2').onclick = closeBibModal;
    $('btnPrintBib').onclick = () => window.print();

    $('btnCloseCertModal').onclick = closeCertModal;
    $('btnCloseCertModal2').onclick = closeCertModal;
    $('btnPrintCert').onclick = () => window.print();

    $('btnPresentationGuide').onclick = openGuideModal;
    $('btnCloseGuideModal').onclick = closeGuideModal;
    $('btnCloseGuideModal2').onclick = closeGuideModal;

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    });
  }

  // ============================================================================
  // MMU CONTROLS & CONFIGURATION
  // ============================================================================
  function setupMmuControls() {
    const policySelect = $('mmuPolicySelect');
    const frameSelect = $('mmuFrameCountSelect');
    const btnFlush = $('btnFlushRAM');
    const btnResetAll = $('btnResetAll');
    const btnClearLog = $('btnClearLog');

    if (policySelect) {
      policySelect.addEventListener('change', () => {
        mmu.setPolicy(policySelect.value);
        renderQueueOrder();
        showToast(`Page replacement algorithm set to [${policySelect.value}].`, 'info');
      });
    }

    if (frameSelect) {
      frameSelect.addEventListener('change', () => {
        mmu.setFrameCount(Number(frameSelect.value));
        renderFramesGrid();
        renderPageTable();
        renderDiskSwapTable();
        showToast(`Physical RAM frame capacity set to ${frameSelect.value} frames.`, 'info');
      });
    }

    if (btnFlush) {
      btnFlush.addEventListener('click', () => {
        mmu.resetRAM();
        renderFramesGrid();
        renderPageTable();
        renderDiskSwapTable();
        renderRunnerList();
        showToast('RAM flushed. All pages returned to Disk Swap space.', 'warning');
      });
    }

    if (btnResetAll) {
      btnResetAll.addEventListener('click', () => {
        if (confirm('Reset entire system back to default demo state?')) {
          runners = getDefaultRunners();
          saveDatabase();
          mmu.resetRAM();
          mmu.syncRunners(runners);
          renderRunnerList();
          renderQuickScanButtons();
          renderSegmentTable();
          renderPageTable();
          renderDiskSwapTable();
          renderFramesGrid();
          showToast('System reset complete! Ready for evaluation.', 'success');
        }
      });
    }

    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        const consoleBox = $('mmuConsoleLogs');
        if (consoleBox) consoleBox.innerHTML = '';
        showToast('Kernel log console cleared.', 'info');
      });
    }

    const btnToggleSeg = $('btnToggleSegView');
    if (btnToggleSeg) {
      btnToggleSeg.addEventListener('click', () => {
        const sec = $('segmentTableSection');
        if (sec) sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================================
  // INITIALIZATION ON DOM READY
  // ============================================================================
  function init() {
    loadDatabase();
    setupRegistrationForm();
    setupRunnerControls();
    setupScanner();
    setupStressTest();
    setupModals();
    setupMmuControls();

    renderRunnerList();
    renderSegmentTable();
    renderPageTable();
    renderDiskSwapTable();
    renderFramesGrid();

    mmu.log('KERNEL_BOOT', 'Community Run OS Virtual Memory Subsystem initialized.');
    mmu.log('SEGMENT_INIT', 'Loaded 5 Segments (SEG_5K, SEG_10K, SEG_21K, SEG_RESULTS, SEG_SYSTEM).');
    mmu.log('PAGING_INIT', `Demand Paging Unit active with ${mmu.frameCount} Physical Frames. Policy: ${mmu.policy}.`);
  }

  window.App = {
    triggerLookup: executeMmuLookup,
    openBibModal: openBibModal,
    openCertModal: openCertModal,
    promptTime: promptRecordFinishTime,
    deleteRunner: (bib) => {
      if (confirm(`Delete runner ${bib}?`)) {
        runners = runners.filter(r => r.bib !== bib);
        saveDatabase();
        mmu.syncRunners(runners);
        renderRunnerList();
        renderQuickScanButtons();
        renderPageTable();
        renderDiskSwapTable();
        renderFramesGrid();
        showToast(`Runner ${bib} deleted.`, 'info');
      }
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
