/**
 * ==============================================================================
 * OPERATING SYSTEM VIRTUAL MEMORY SIMULATOR (MMU)
 * Group 3 OS Project: Memory Management & Virtual Memory
 * ==============================================================================
 *
 * Core Concepts Implemented:
 * 1. SEGMENTATION:
 *    - Logical Address = <Segment Selector, Offset>
 *    - Segment Table with Base, Limit, Protection, Description
 *    - Hardware Bounds Check: If Offset >= Limit, raises SIGSEGV
 *    - Linear Virtual Address = Base + Offset
 *
 * 2. DEMAND PAGING:
 *    - Linear Address decomposed into Virtual Page Number (VPN) & Page Offset
 *    - Dynamic Page Table: Valid/Invalid Bit (V), Frame Number (PFN), Dirty Bit (M),
 *      Reference Bit (R), Last Access Timestamp, Load Timestamp, Secondary Disk Block
 *    - True Page Fault Handling: Pages initially reside on simulated secondary storage (Disk/Swap).
 *      A lookup traps to the OS Kernel Page Fault Handler.
 *
 * 3. PAGE REPLACEMENT POLICIES (Configurable):
 *    - FIFO (First-In, First-Out): Oldest resident page is evicted.
 *    - LRU (Least Recently Used): Page with the oldest access timestamp is evicted.
 *    - Dirty bit checking: Modified pages are saved back to simulated disk upon eviction.
 *
 * 4. PHYSICAL RAM FRAMES:
 *    - Fixed pool of physical frames (3, 4, 5, or 6 frames)
 *    - Visualized frame state: Frame #, Resident Page, Bib & Runner Name, Timestamps
 *
 * 5. PERFORMANCE METRICS:
 *    - Page Faults, Page Hits, Hit Rate (%), Fault Rate (%), Total Accesses, Eviction Count
 * ==============================================================================
 */

class MemoryManagementUnit {
  /**
   * @param {Object} options Configuration parameters
   * @param {number} options.frameCount Number of physical frames in RAM (default: 4)
   * @param {string} options.policy 'LRU' or 'FIFO' (default: 'LRU')
   * @param {number} options.pageSize Bytes per page (default: 256)
   */
  constructor(options = {}) {
    this.frameCount = options.frameCount || 4;
    this.policy = options.policy || 'LRU';
    this.pageSize = options.pageSize || 256;

    // Simulation Clock (ticks on each memory reference)
    this.clock = 0;

    // 1. SEGMENT TABLE
    // Defined segments for the Community Run OS process:
    // Seg 0: 5K Runners Data Segment
    // Seg 1: 10K Runners Data Segment
    // Seg 2: 21K Runners Data Segment
    // Seg 3: Results & Timing Segment
    // Seg 4: Event Configuration / System Segment
    this.segmentTable = [
      {
        id: 0,
        name: 'SEG_5K_RUNNERS',
        category: '5K Fun Run',
        base: 0x1000,
        limit: 0x0800, // 2048 bytes (up to 8 pages)
        protection: 'Read/Write',
        description: '5K Category Runner Records & Bibs',
        recordCount: 0
      },
      {
        id: 1,
        name: 'SEG_10K_RUNNERS',
        category: '10K Challenge',
        base: 0x2000,
        limit: 0x0800, // 2048 bytes
        protection: 'Read/Write',
        description: '10K Category Runner Records & Bibs',
        recordCount: 0
      },
      {
        id: 2,
        name: 'SEG_21K_RUNNERS',
        category: '21K Half Marathon',
        base: 0x3000,
        limit: 0x0800, // 2048 bytes
        protection: 'Read/Write',
        description: '21K Category Runner Records & Bibs',
        recordCount: 0
      },
      {
        id: 3,
        name: 'SEG_TIMING_RESULTS',
        category: 'Results',
        base: 0x4000,
        limit: 0x0600, // 1536 bytes
        protection: 'Read/Write',
        description: 'Race Timing, Checkpoints & Finisher Logs',
        recordCount: 0
      },
      {
        id: 4,
        name: 'SEG_SYSTEM_CONFIG',
        category: 'System',
        base: 0x5000,
        limit: 0x0200, // 512 bytes
        protection: 'Read-Only',
        description: 'Race Metadata, Signatures & MMU Settings',
        recordCount: 1
      }
    ];

    // 2. PAGE TABLE
    // Map: pageNumber (VPN) -> PageTableEntry
    this.pageTable = new Map();

    // 3. PHYSICAL MEMORY FRAMES (RAM)
    // Array of frame objects: [ { frameId, pageNumber, runner, loadedAt, lastAccess, status } ]
    this.frames = [];
    this.initFrames();

    // 4. SECONDARY STORAGE (DISK SWAP SPACE)
    // Map: pageNumber -> { diskBlock, runner, lastUpdated }
    this.diskSwap = new Map();

    // 5. FIFO & LRU TRACKING
    this.fifoQueue = []; // Array of pageNumbers in order of allocation

    // 6. PERFORMANCE COUNTERS
    this.stats = {
      totalLookups: 0,
      pageHits: 0,
      pageFaults: 0,
      evictions: 0,
      segmentViolations: 0
    };

    // 7. EVENT LOGS
    this.logs = [];

    // Observer / Listener callbacks for UI reactivity
    this.listeners = {
      onAccessComplete: [],
      onLog: [],
      onStatsUpdate: []
    };
  }

  /**
   * Initialize Physical Frames
   */
  initFrames() {
    this.frames = [];
    for (let i = 0; i < this.frameCount; i++) {
      this.frames.push({
        frameId: i,
        baseAddress: `0x${(i * this.pageSize).toString(16).padStart(4, '0').toUpperCase()}`,
        status: 'FREE', // 'FREE' | 'OCCUPIED'
        pageNumber: null,
        runner: null,
        loadedAt: null,
        lastAccess: null,
        accessCount: 0
      });
    }
  }

  /**
   * Set physical frame capacity (e.g. 3, 4, 5, 6)
   */
  setFrameCount(count) {
    count = Math.max(2, Math.min(8, Number(count) || 4));
    if (count === this.frameCount) return;

    this.log('KERNEL_CONFIG', `Changing physical RAM frame capacity from ${this.frameCount} to ${count} frames.`);
    this.frameCount = count;

    // Reset memory state cleanly to re-align with new frame count
    this.resetRAM();
  }

  /**
   * Switch page replacement algorithm (FIFO or LRU)
   */
  setPolicy(policy) {
    if (policy !== 'FIFO' && policy !== 'LRU') return;
    this.policy = policy;
    this.log('POLICY_CHANGE', `Page replacement policy set to [${this.policy}].`);
    this.notifyStats();
  }

  /**
   * Clear physical RAM frames and stats (simulated system reboot)
   */
  resetRAM() {
    // Invalidate all page table entries pointing to RAM
    for (const [pageNumber, entry] of this.pageTable.entries()) {
      entry.valid = 0;
      entry.frameNumber = null;
      entry.referenced = 0;
    }

    this.initFrames();
    this.fifoQueue = [];
    this.stats.pageHits = 0;
    this.stats.pageFaults = 0;
    this.stats.totalLookups = 0;
    this.stats.evictions = 0;
    this.stats.segmentViolations = 0;

    this.log('SYSTEM_RESET', 'Physical RAM flushed. All pages invalidated and returned to Disk Swap space. Counters reset.');
    this.notifyStats();
  }

  /**
   * Completely register or synchronize a list of runners into the OS Virtual Memory.
   * Runner records are allocated to their corresponding Category Segment and secondary storage.
   */
  syncRunners(runnersList) {
    // Reset segment record counters
    this.segmentTable.forEach(seg => {
      if (seg.id < 3) seg.recordCount = 0;
    });

    const existingPages = new Set(this.pageTable.keys());
    const incomingPages = new Set();

    runnersList.forEach((runner, index) => {
      const pageNumber = this.getPageNumberForRunner(runner);
      incomingPages.add(pageNumber);

      // Determine segment by category
      const segment = this.getSegmentForCategory(runner.category);
      if (segment) segment.recordCount++;

      // Compute offset in segment: (recordIndex * 256 bytes)
      const offset = (runner.indexInCategory || 0) * 0x80;

      // Register or update Disk Swap storage
      const diskBlock = `BLK_0x${(0x1000 + pageNumber * 0x40).toString(16).toUpperCase()}`;
      this.diskSwap.set(pageNumber, {
        pageNumber,
        diskBlock,
        runner: { ...runner },
        lastUpdated: Date.now()
      });

      // If page table doesn't have it, create entry (initially INVALID / on disk)
      if (!this.pageTable.has(pageNumber)) {
        this.pageTable.set(pageNumber, {
          pageNumber,
          bib: runner.bib,
          runnerName: runner.name,
          category: runner.category,
          segmentId: segment ? segment.id : 0,
          segmentOffset: offset,
          valid: 0,          // 0 = On Disk, 1 = In Physical RAM
          frameNumber: null, // PFN
          dirty: 0,          // Modified in RAM
          referenced: 0,     // Access bit
          lastAccessTime: 0,
          loadTime: 0,
          diskBlock
        });
      } else {
        // Update runner name/data if existing
        const entry = this.pageTable.get(pageNumber);
        entry.runnerName = runner.name;
        entry.category = runner.category;
        entry.bib = runner.bib;

        // If in RAM, update runner data in frame as well
        if (entry.valid === 1 && entry.frameNumber !== null) {
          const frame = this.frames[entry.frameNumber];
          if (frame && frame.pageNumber === pageNumber) {
            frame.runner = { ...runner };
          }
        }
      }
    });

    // Clean up deleted runners
    for (const pageNumber of existingPages) {
      if (!incomingPages.has(pageNumber)) {
        const entry = this.pageTable.get(pageNumber);
        if (entry && entry.valid === 1 && entry.frameNumber !== null) {
          // Free the frame
          const frame = this.frames[entry.frameNumber];
          if (frame) {
            frame.status = 'FREE';
            frame.pageNumber = null;
            frame.runner = null;
          }
          const fifoIdx = this.fifoQueue.indexOf(pageNumber);
          if (fifoIdx !== -1) this.fifoQueue.splice(fifoIdx, 1);
        }
        this.pageTable.delete(pageNumber);
        this.diskSwap.delete(pageNumber);
      }
    }

    this.notifyStats();
  }

  /**
   * Helper: Map runner category to Segment Table Descriptor
   */
  getSegmentForCategory(category) {
    if (!category) return this.segmentTable[0];
    const cat = category.toLowerCase();
    if (cat.includes('10k')) return this.segmentTable[1];
    if (cat.includes('21k') || cat.includes('half')) return this.segmentTable[2];
    return this.segmentTable[0]; // Default 5K
  }

  /**
   * Compute a stable, virtual page number (VPN) for a runner based on bib
   */
  getPageNumberForRunner(runner) {
    if (!runner || !runner.bib) return 0;
    // Extract base bib numbers (e.g., "1001-6" -> 1001)
    const baseBib = parseInt(String(runner.bib).split('-')[0], 10);
    if (!isNaN(baseBib)) {
      // Map bib numbers to 0-based virtual page range:
      // 5K: 1001.. -> Page 0..
      // 10K: 2001.. -> Page 100..
      // 21K: 3001.. -> Page 200..
      if (baseBib >= 3000) return 200 + (baseBib - 3001);
      if (baseBib >= 2000) return 100 + (baseBib - 2001);
      if (baseBib >= 1000) return (baseBib - 1001);
      return baseBib;
    }
    return 0;
  }

  /**
   * Mark page as dirty when runner record is modified (e.g. finish time entered)
   */
  markDirty(bib, updatedRunner) {
    const pageNumber = this.getPageNumberForRunner({ bib });
    const entry = this.pageTable.get(pageNumber);
    if (entry) {
      entry.dirty = 1;
      this.log('PAGE_DIRTY', `Page #${pageNumber} (Bib ${bib}) marked DIRTY (M=1). Record modified in memory.`);
      if (entry.valid === 1 && entry.frameNumber !== null) {
        const frame = this.frames[entry.frameNumber];
        if (frame) frame.runner = { ...updatedRunner };
      }
    }
    // Also update disk swap copy directly
    if (this.diskSwap.has(pageNumber)) {
      const diskEntry = this.diskSwap.get(pageNumber);
      diskEntry.runner = { ...updatedRunner };
    }
    this.notifyStats();
  }

  // ============================================================================
  // CORE MMU OPERATION: ACCESS RUNNER BY BIB (Hardware & OS Simulation)
  // ============================================================================
  /**
   * Performs the complete Memory Management Unit hardware translation & demand paging:
   *
   * Step 1: Logical Address Translation (Segmentation Unit)
   *         Logical Address = <Segment Selector, Offset>
   *         Check if Offset < Limit. If false -> SIGSEGV!
   *         Compute Linear Virtual Address = Base + Offset
   *
   * Step 2: Virtual Paging Unit
   *         Decompose Linear Address into Virtual Page Number (VPN) & Offset
   *         Query Page Table
   *
   * Step 3: Check Valid Bit (V)
   *         - If V == 1 (PAGE HIT):
   *             Read directly from Physical Frame.
   *             Update LRU timestamp & Reference bit (R).
   *         - If V == 0 (PAGE FAULT):
   *             Trap to OS Kernel!
   *             Find free frame or trigger Replacement Policy (FIFO / LRU).
   *             If victim page is dirty (M==1), flush to disk swap.
   *             Load page from disk swap into selected frame.
   *             Update Page Table (V=1, PFN=frame, R=1, LoadTime, AccessTime).
   *
   * Step 4: Return fetched runner profile & execution trace
   */
  accessRunnerByBib(bib) {
    this.clock++;
    this.stats.totalLookups++;

    const trace = {
      timestamp: new Date().toLocaleTimeString(),
      clock: this.clock,
      bib: bib,
      logicalAddress: null,
      segment: null,
      linearVirtualAddress: null,
      vpn: null,
      pageOffset: null,
      isHit: false,
      isFault: false,
      evictedPage: null,
      evictedFrame: null,
      assignedFrame: null,
      physicalAddress: null,
      runner: null,
      executionSteps: []
    };

    const addStep = (tag, message, status = 'info') => {
      trace.executionSteps.push({ tag, message, status });
      this.log(tag, message);
    };

    // --------------------------------------------------------------------------
    // STEP 1: SEGMENTATION UNIT (Hardware Bounds & Base Translation)
    // --------------------------------------------------------------------------
    // Parse bib number to determine category segment
    const baseBib = parseInt(String(bib).split('-')[0], 10);
    let category = '5K Fun Run';
    if (baseBib >= 3000) category = '21K Half Marathon';
    else if (baseBib >= 2000) category = '10K Challenge';

    const segment = this.getSegmentForCategory(category);
    trace.segment = segment;

    // Model offset inside segment (e.g. index inside category * record size 128 bytes)
    const rawIndex = isNaN(baseBib) ? 0 : (baseBib % 1000);
    const offset = rawIndex * 0x80;
    const logicalAddress = `<Seg ${segment.id} (${segment.name}), Offset: 0x${offset.toString(16).padStart(4, '0').toUpperCase()}>`;
    trace.logicalAddress = logicalAddress;

    addStep('SEG_UNIT', `Resolving Logical Address ${logicalAddress} for Bib ${bib}.`);

    // SEGMENT BOUNDS CHECK (Protection mechanism)
    if (offset >= segment.limit) {
      this.stats.segmentViolations++;
      addStep('SIGSEGV', `SEGMENTATION FAULT! Offset 0x${offset.toString(16).toUpperCase()} exceeds Limit 0x${segment.limit.toString(16).toUpperCase()} for ${segment.name}. Access denied!`, 'danger');
      this.notifyStats();
      return { success: false, error: 'SEGMENTATION_FAULT', trace };
    }

    addStep('SEG_BOUNDS_OK', `Bounds Check PASSED: Offset 0x${offset.toString(16).toUpperCase()} < Limit 0x${segment.limit.toString(16).toUpperCase()}. Protection: ${segment.protection}.`, 'success');

    // Compute Linear Virtual Address = Base + Offset
    const linearVirtualAddress = segment.base + offset;
    trace.linearVirtualAddress = `0x${linearVirtualAddress.toString(16).padStart(4, '0').toUpperCase()}`;
    addStep('LINEAR_ADDR', `Calculated Linear Virtual Address: Base(0x${segment.base.toString(16).toUpperCase()}) + Offset(0x${offset.toString(16).toUpperCase()}) = ${trace.linearVirtualAddress}.`);

    // --------------------------------------------------------------------------
    // STEP 2: PAGING UNIT & PAGE TABLE LOOKUP
    // --------------------------------------------------------------------------
    const vpn = this.getPageNumberForRunner({ bib });
    const pageOffset = offset % this.pageSize;
    trace.vpn = vpn;
    trace.pageOffset = `0x${pageOffset.toString(16).padStart(2, '0').toUpperCase()}`;

    addStep('PTE_LOOKUP', `Paging Unit checking Page Table for Virtual Page Number (VPN) #${vpn} (Offset ${trace.pageOffset}).`);

    let pte = this.pageTable.get(vpn);
    if (!pte) {
      // Create new page entry if bib is fresh
      const diskBlock = `BLK_0x${(0x1000 + vpn * 0x40).toString(16).toUpperCase()}`;
      pte = {
        pageNumber: vpn,
        bib: bib,
        runnerName: 'Unknown Runner',
        category: category,
        segmentId: segment.id,
        segmentOffset: offset,
        valid: 0,
        frameNumber: null,
        dirty: 0,
        referenced: 0,
        lastAccessTime: 0,
        loadTime: 0,
        diskBlock
      };
      this.pageTable.set(vpn, pte);
    }

    // --------------------------------------------------------------------------
    // STEP 3: CHECK VALID BIT (HIT vs PAGE FAULT)
    // --------------------------------------------------------------------------
    if (pte.valid === 1 && pte.frameNumber !== null) {
      // ------------------------------------------------------------------------
      // CASE A: PAGE HIT!
      // ------------------------------------------------------------------------
      this.stats.pageHits++;
      trace.isHit = true;
      trace.assignedFrame = pte.frameNumber;

      const frame = this.frames[pte.frameNumber];
      frame.lastAccess = this.clock;
      frame.accessCount++;

      pte.referenced = 1;
      pte.lastAccessTime = this.clock;

      // Calculate Physical Address = (Frame # * PageSize) + Offset
      const physicalAddrInt = (pte.frameNumber * this.pageSize) + pageOffset;
      trace.physicalAddress = `0x${physicalAddrInt.toString(16).padStart(4, '0').toUpperCase()}`;
      trace.runner = frame.runner;

      addStep('PAGE_HIT', `PAGE HIT! Page #${vpn} (Bib ${bib}) is resident in Physical Frame #${pte.frameNumber}.`, 'success');
      addStep('PHYS_ACCESS', `Read directly from RAM at Physical Address ${trace.physicalAddress} [Frame #${pte.frameNumber} + Offset ${trace.pageOffset}]. Instant access without disk I/O.`);

    } else {
      // ------------------------------------------------------------------------
      // CASE B: PAGE FAULT! (Page on Disk / Swap)
      // ------------------------------------------------------------------------
      this.stats.pageFaults++;
      trace.isFault = true;

      addStep('PAGE_FAULT', `PAGE FAULT DETECTED! Page #${vpn} Valid Bit = 0. Page is currently not in Physical Memory!`, 'danger');
      addStep('OS_TRAP', `Hardware trapped to OS Kernel: Invoking Demand Paging Interrupt Handler (INT 14).`);

      // 1. Check for a FREE physical frame in RAM
      let selectedFrameIndex = this.frames.findIndex(f => f.status === 'FREE');

      if (selectedFrameIndex !== -1) {
        // Found an unoccupied frame
        addStep('FRAME_ALLOC', `Free Physical Frame #${selectedFrameIndex} found in RAM pool.`);
      } else {
        // 2. All frames are occupied -> Trigger PAGE REPLACEMENT ALGORITHM!
        addStep('FRAMES_FULL', `All ${this.frameCount} Physical Frames are occupied. Triggering Page Replacement Policy: [${this.policy}].`, 'warning');

        let victimPageIndex = null;
        let victimFrameIndex = null;

        if (this.policy === 'FIFO') {
          // FIFO: The page that entered memory first is evicted
          victimPageIndex = this.fifoQueue.shift();
          const victimPte = this.pageTable.get(victimPageIndex);
          victimFrameIndex = victimPte ? victimPte.frameNumber : 0;
          addStep('FIFO_VICTIM', `FIFO Policy selected Page #${victimPageIndex} (oldest loaded page in memory queue) for eviction.`, 'warning');
        } else {
          // LRU: The page with smallest lastAccessTime is evicted
          let oldestAccess = Infinity;
          let candidatePage = null;
          let candidateFrame = 0;

          for (let f = 0; f < this.frames.length; f++) {
            const frame = this.frames[f];
            if (frame.lastAccess < oldestAccess) {
              oldestAccess = frame.lastAccess;
              candidatePage = frame.pageNumber;
              candidateFrame = f;
            }
          }

          victimPageIndex = candidatePage;
          victimFrameIndex = candidateFrame;
          addStep('LRU_VICTIM', `LRU Policy selected Page #${victimPageIndex} (last accessed at clock tick #${oldestAccess}) for eviction.`, 'warning');
        }

        // Execute Eviction
        this.stats.evictions++;
        trace.evictedPage = victimPageIndex;
        trace.evictedFrame = victimFrameIndex;

        const victimEntry = this.pageTable.get(victimPageIndex);
        if (victimEntry) {
          // If Dirty bit is set, write back to disk swap space
          if (victimEntry.dirty === 1) {
            addStep('SWAP_OUT_DIRTY', `Victim Page #${victimPageIndex} has DIRTY bit = 1 (modified). Flushing data back to Disk Sector ${victimEntry.diskBlock} before freeing frame.`, 'warning');
            victimEntry.dirty = 0;
          } else {
            addStep('SWAP_OUT_CLEAN', `Victim Page #${victimPageIndex} is clean (unmodified). Dropping from frame without disk write.`);
          }

          victimEntry.valid = 0;
          victimEntry.frameNumber = null;
          victimEntry.referenced = 0;
        }

        selectedFrameIndex = victimFrameIndex;
      }

      // 3. Load the requested Page from Secondary Storage (Disk Swap) into selected Frame
      const diskData = this.diskSwap.get(vpn);
      const runnerData = diskData ? diskData.runner : { bib, name: `Runner ${bib}`, category };

      addStep('SWAP_IN', `Reading Page #${vpn} (Bib ${bib}) from Simulated Disk Storage (${pte.diskBlock}) into Physical Frame #${selectedFrameIndex}.`);

      // Update Physical Frame
      const frame = this.frames[selectedFrameIndex];
      frame.status = 'OCCUPIED';
      frame.pageNumber = vpn;
      frame.runner = runnerData;
      frame.loadedAt = this.clock;
      frame.lastAccess = this.clock;
      frame.accessCount = 1;

      // Update Page Table Entry
      pte.valid = 1;
      pte.frameNumber = selectedFrameIndex;
      pte.referenced = 1;
      pte.loadTime = this.clock;
      pte.lastAccessTime = this.clock;

      // Track in FIFO queue
      this.fifoQueue.push(vpn);

      trace.assignedFrame = selectedFrameIndex;
      trace.runner = runnerData;

      // Compute Physical Address
      const physicalAddrInt = (selectedFrameIndex * this.pageSize) + pageOffset;
      trace.physicalAddress = `0x${physicalAddrInt.toString(16).padStart(4, '0').toUpperCase()}`;

      addStep('PTE_UPDATED', `Page Table updated: Page #${vpn} -> Valid Bit = 1, Frame Number = #${selectedFrameIndex}.`);
      addStep('PAGED_IN_DONE', `Demand Paging complete! Physical Memory ready at ${trace.physicalAddress}. Profile loaded.`, 'success');
    }

    this.notifyStats();
    this.notifyAccess(trace);

    return {
      success: true,
      trace,
      runner: trace.runner
    };
  }

  // ============================================================================
  // LOGGING & OBSERVER NOTIFICATIONS
  // ============================================================================
  log(tag, message) {
    const time = new Date().toLocaleTimeString();
    const entry = { time, tag, message };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop(); // Keep last 200 logs

    this.listeners.onLog.forEach(fn => fn(entry));
  }

  notifyStats() {
    const total = this.stats.totalLookups;
    const hitRate = total > 0 ? ((this.stats.pageHits / total) * 100).toFixed(1) : '0.0';
    const faultRate = total > 0 ? ((this.stats.pageFaults / total) * 100).toFixed(1) : '0.0';

    const payload = {
      ...this.stats,
      hitRate: `${hitRate}%`,
      faultRate: `${faultRate}%`,
      frameCount: this.frameCount,
      policy: this.policy,
      occupiedFrames: this.frames.filter(f => f.status === 'OCCUPIED').length,
      virtualPagesCount: this.pageTable.size,
      diskSwapCount: this.diskSwap.size,
      fifoQueue: [...this.fifoQueue],
      frames: this.frames.map(f => ({ ...f }))
    };

    this.listeners.onStatsUpdate.forEach(fn => fn(payload));
  }

  notifyAccess(trace) {
    this.listeners.onAccessComplete.forEach(fn => fn(trace));
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
}

// Export for browser
window.MemoryManagementUnit = MemoryManagementUnit;
