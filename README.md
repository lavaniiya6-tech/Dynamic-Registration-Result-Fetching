GROUP 3 - Dynamic Registration & Result Fetching
Course: Operating Systems — Group 3 Project

## Group Details

| Name | Matric Number |
|------|---------------|
| [SARVENDRA REDDY A/L JAYA KUMAR] | [CN260280] |
| [LAVANIIYASHIREE S BANNERI SELVAN] | [260491] |
| [COURTENEY JILL BOBBY] | [CN260271] |
| [FLORENCE A/P PALANIAPPAN] | [CN260061] |

## System Overview

Community Run is a single-page web application that manages race registration, bib assignment, QR check-in, and finisher certificates — while demonstrating core operating system memory management concepts in real time.

Every registered runner is treated as a *process* whose record must be loaded into memory before it can be accessed. The simulator visualises what the OS does under the hood.

### OS Concepts Implemented

*Segmentation*
- Each bib number maps to a logical address of the form <segment, offset>, which the *MMU* translates to a physical frame address.
- The hardware address panel displays both the logical address and its resolved physical location.

*Demand Paging*
- Runner records are *not* loaded into RAM at startup. They reside on secondary storage (disk swap) until referenced.
- Accessing a runner triggers a *page fault* (INT 14): the MMU traps, the kernel allocates a free frame, loads the page from disk, sets the Valid Bit = 1, and updates the page table.
- A second access to the same runner produces a *page hit* — retrieved directly from RAM with zero disk I/O. Hit counter and hit rate update live.

*Page Replacement (FIFO / LRU)*
- Physical RAM is limited to *4 frames*. When all frames are full and a new page is referenced, the replacement policy selects a victim page and evicts it back to disk.
- Under *LRU*, the least recently used frame is chosen as the victim. The LRU timestamp and reference bit are updated on every access.
- An amber eviction indicator highlights the victim frame, with live updates to the page table and FIFO/LRU queue.

*Dirty Bit & Write-Back*
- Entering a runner's finish time sets the *Dirty Bit (M = 1)* on that page.
- If a dirty page is later evicted, the OS must flush the modified data back to disk before freeing the frame.

*Thrashing Demonstration*
- The *Heavy Load* button automates rapid lookups across many runners, forcing continuous page faults and frame churning — the classic thrashing scenario.

*Additional Features*
- Auto-assigned bib numbers using a *Modulo-10 check digit* for validation.
- QR code generation for bib cards and check-in.
- Printable A4 landscape finisher certificates.
- CSV export of the full runner database.

## How to Run

### Option 1: Live Demo (no installation)

Open the deployed site in any modern browser:
