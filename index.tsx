/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

// The Snap.svg library is loaded via a script tag in index.html,
// so we can declare it as a global for TypeScript.
declare const Snap: any;
declare const webkitSpeechRecognition: any;
declare const Chart: any;


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// All application javascript goes here
// No window.onload or DOMContentLoaded needed when script is at the end of the body.
// However, wrapping is a good practice for complex apps to ensure everything is ready.
document.addEventListener('DOMContentLoaded', function() {
    function DentalChart(this: any, paper: any) {
        this.paper = paper;
        this.teeth = {};
        this.selectedCondition = 'caries';
        this.dentitionMode = 'permanent';
        this.history = [];
        this.historyIndex = -1;

        this.conditions = {
            'pathology': { label: 'Pathology', items: { 'caries': { label: 'Caries', type: 'surface', className: 'caries', color: '#c91c1c', textColor: '#fff', keywords: ['caries', 'decay', 'dk'] }, 'fracture': { label: 'Fracture', type: 'whole', className: 'fracture', color: '#fed7aa', keywords: ['fracture', 'fractured', 'broken'] }, 'root-fragment': { label: 'Root Fragment', type: 'whole', className: 'root-fragment', color: '#fecaca', keywords: ['root', 'fragment'] }, } },
            'restorations': { label: 'Restorations', items: { 'amalgam': { label: 'Amalgam', type: 'surface', className: 'amalgam', color: '#9ca3af', keywords: ['amalgam', 'silver'] }, 'composite': { label: 'Composite', type: 'surface', className: 'composite', color: '#a5f3fc', keywords: ['composite', 'white', 'filling'] }, 'glass-ionomer': { label: 'Glass Ionomer', type: 'surface', className: 'glass-ionomer', color: '#fef08a', keywords: ['gi', 'glass'] }, 'gold': { label: 'Gold', type: 'surface', className: 'gold', color: '#facc15', keywords: ['gold'] }, 'crown': { label: 'Crown', type: 'whole', className: 'crown', color: '#fde047', keywords: ['crown'] }, 'sealant': { label: 'Sealant', type: 'surface', className: 'sealant', color: '#a7f3d0', keywords: ['sealant', 'fs'] }, } },
            'treatmentsAndStatus': { label: 'Status & Treatments', items: { 'missing': { label: 'Missing', type: 'whole', className: 'missing', color: '#e5e7eb', keywords: ['missing', 'extracted', 'clear', 'sound', 'reset'] }, 'to-be-extracted': { label: 'To Be Extracted', type: 'whole', className: 'to-be-extracted', color: '#fda4af', keywords: ['extract', 'tbe'] }, 'impacted': { label: 'Impacted', type: 'whole', className: 'impacted', color: '#e9d5ff', keywords: ['impacted'] }, 'unerupted': { label: 'Unerupted', type: 'whole', className: 'unerupted', color: '#bfdbfe', keywords: ['unerupted'] }, 'partially-erupted': { label: 'Partially Erupted', type: 'whole', className: 'partially-erupted', color: '#93c5fd', keywords: ['partially'] }, 'rct': { label: 'Root Canal', type: 'whole', className: 'rct', color: '#fecaca', keywords: ['rct', 'root canal', 'endo'] }, 'implant': { label: 'Implant', type: 'whole', className: 'implant', color: '#c4b5fd', keywords: ['implant'] }, 'bridge-pontic': { label: 'Bridge Pontic', type: 'whole', className: 'bridge-pontic', color: '#e5e7eb', keywords: ['pontic', 'bridge'] }, } },
        };
        
        const TOOTH_SIZE = 50, SURFACE_SIZE = TOOTH_SIZE / 3, TOOTH_SPACING = 5, MIDLINE_SPACING = 20, QUADRANT_SPACING_Y = 40, LABEL_OFFSET_Y = 18;
        const CHART_HEIGHT = (TOOTH_SIZE * 2) + QUADRANT_SPACING_Y + (LABEL_OFFSET_Y * 2);
        
        const sealantPattern = this.paper.path("M 0 5 L 10 5 M 5 0 L 5 10").attr({ fill: 'none', stroke: '#34d399', strokeWidth: 1 }).pattern(0, 0, 10, 10);
        sealantPattern.attr({ id: 'sealant-pattern' });

        this.drawTooth = function(q: number, n: number, x: number, y: number) {
            const id = `${q}${n}`, g = this.paper.g().attr({ id: `tooth-${id}`, class: 'tooth-group' });
            if (!this.teeth[id]) this.teeth[id] = { id: id, surfaces: {}, wholeToothState: null, isFilled: false };
            this.teeth[id].elements = { group: g, overlays: {} };
            const surf: any = {}, isPost = n >= (this.dentitionMode === 'permanent' ? 4 : 1), isUp = q <= (this.dentitionMode === 'permanent' ? 2 : 6), isRight = q === 1 || q === 4 || q === 5 || q === 8;
            const pos = { c: { x: x + SURFACE_SIZE, y: y + SURFACE_SIZE }, t: { x: x + SURFACE_SIZE, y: y }, b: { x: x + SURFACE_SIZE, y: y + SURFACE_SIZE * 2 }, l: { x: x, y: y + SURFACE_SIZE }, r: { x: x + SURFACE_SIZE * 2, y: y + SURFACE_SIZE } };
            surf[isPost ? 'O' : 'I'] = pos.c; surf[isRight ? 'D' : 'M'] = pos.l; surf[isRight ? 'M' : 'D'] = pos.r; surf['B'] = isUp ? pos.t : pos.b; surf[isUp ? 'P' : 'L'] = isUp ? pos.b : pos.t;
            for (const k in surf) {
                g.add(this.paper.rect(surf[k].x, surf[k].y, SURFACE_SIZE, SURFACE_SIZE, 3, 3).attr({ 'data-tooth-id': id, 'data-surface-id': k, 'class': 'tooth-surface sound' }));
                if (!this.teeth[id].surfaces[k]) this.teeth[id].surfaces[k] = { condition: 'sound', note: '' };
            }
            this.paper.text(x + TOOTH_SIZE / 2, isUp ? y + TOOTH_SIZE + LABEL_OFFSET_Y : y - LABEL_OFFSET_Y + 15, id).attr({ textAnchor: 'middle', fontSize: '12px', fontWeight: '600', fill: '#4b5563' });
        };

        this.draw = function() {
            this.paper.clear(); this.paper.append(sealantPattern); this.teeth = {};
            const uy = LABEL_OFFSET_Y, ly = uy + TOOTH_SIZE + QUADRANT_SPACING_Y; let cx = 0;
            if (this.dentitionMode === 'permanent') {
                const CHART_WIDTH = (TOOTH_SIZE * 8 + TOOTH_SPACING * 7) * 2 + MIDLINE_SPACING;
                this.paper.attr({ viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`});
                for (let i = 8; i >= 1; i--) { this.drawTooth(1, i, cx, uy); this.drawTooth(4, i, cx, ly); cx += TOOTH_SIZE + TOOTH_SPACING; }
                cx += MIDLINE_SPACING - TOOTH_SPACING;
                for (let i = 1; i <= 8; i++) { this.drawTooth(2, i, cx, uy); this.drawTooth(3, i, cx, ly); cx += TOOTH_SIZE + TOOTH_SPACING; }
            } else {
                const CHART_WIDTH = (TOOTH_SIZE * 5 + TOOTH_SPACING * 4) * 2 + MIDLINE_SPACING;
                this.paper.attr({ viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`});
                for (let i = 5; i >= 1; i--) { this.drawTooth(5, i, cx, uy); this.drawTooth(8, i, cx, ly); cx += TOOTH_SIZE + TOOTH_SPACING; }
                cx += MIDLINE_SPACING - TOOTH_SPACING;
                for (let i = 1; i <= 5; i++) { this.drawTooth(6, i, cx, uy); this.drawTooth(7, i, cx, ly); cx += TOOTH_SIZE + TOOTH_SPACING; }
            }
            if(this.history.length === 0) this.saveState();
        };
        
        this.getCondition = (key: string) => { for(const cat in this.conditions) if(this.conditions[cat].items[key]) return this.conditions[cat].items[key]; return null; };
        
        this.updateNoteIndicator = function(toothId: string, surfaceId: string | null = null) {
            const tooth = this.teeth[toothId];
            if (!tooth || !tooth.elements) return;

            const noteKey = surfaceId ? `note-${toothId}-${surfaceId}` : `note-${toothId}-whole`;
            
            // Remove existing indicator first
            if (tooth.elements.overlays[noteKey]) {
                tooth.elements.overlays[noteKey].remove();
                delete tooth.elements.overlays[noteKey];
            }

            const data = surfaceId ? tooth.surfaces[surfaceId] : tooth.wholeToothState;
            const condition = data?.condition;
            const note = data?.note;

            if (condition && condition !== 'sound' && (surfaceId || condition !== 'none')) {
                const bbox = tooth.elements.group.getBBox();
                let x, y;

                if (surfaceId) {
                    const surfaceEl = Snap(document.querySelector(`[data-tooth-id="${toothId}"][data-surface-id="${surfaceId}"]`));
                    if (!surfaceEl) return;
                    const surfaceBbox = surfaceEl.getBBox();
                    x = surfaceBbox.x2 - 8;
                    y = surfaceBbox.y + 2;
                } else {
                    x = bbox.x2 - 8;
                    y = bbox.y + 2;
                }
                
                // Document icon path
                const icon = this.paper.path("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z")
                    .attr({ transform: `T${x},${y}S0.5`, fillRule: 'evenodd', clipRule: 'evenodd' })
                    .addClass('note-indicator');
                icon.attr({ 'data-note-tooth-id': toothId });
                if(surfaceId) icon.attr('data-note-surface-id', surfaceId);
                
                if (note) {
                    icon.attr({ fill: '#f59e0b' }); // Filled amber if note exists
                } else {
                    icon.attr({ fill: '#9ca3af' }); // Gray if no note
                }
                tooth.elements.overlays[noteKey] = icon;
            }
        };

        this.applyCondition = function(toothId: string, surfaceId: string | null, conditionKey: string) {
            const tooth = this.teeth[toothId], condition = this.getCondition(conditionKey);
            if (!tooth || !condition) return;
            
            if (conditionKey === 'missing' && !surfaceId) {
                 this.clearWholeToothState(toothId);
                 Object.keys(tooth.surfaces).forEach(surfKey => {
                   const el = Snap(document.querySelector(`[data-tooth-id="${toothId}"][data-surface-id="${surfKey}"]`));
                   if(el) {
                       Object.values(this.conditions).forEach((c: any) => Object.values(c.items).forEach((i: any) => el.removeClass(i.className)));
                       tooth.surfaces[surfKey] = { condition: 'sound', note: '' };
                       el.addClass('sound');
                       this.updateNoteIndicator(toothId, surfKey);
                   }
                });
            } else if (condition.type === 'whole') {
                const isOff = tooth.wholeToothState?.condition === conditionKey;
                const newWholeState = isOff ? null : { condition: conditionKey, note: '' };

                if (tooth.wholeToothState) this.clearWholeToothState(toothId);
                tooth.wholeToothState = newWholeState;

                if (newWholeState) {
                    const conditionDetails = this.getCondition(newWholeState.condition);
                    if(conditionDetails) tooth.elements.group.addClass(conditionDetails.className);
                    const bbox = tooth.elements.group.getBBox();
                    if (newWholeState.condition === 'rct') tooth.elements.overlays.rct = this.paper.line(bbox.cx, bbox.y, bbox.cx, bbox.y2).addClass('overlay-marker rct-line');
                    if (newWholeState.condition === 'missing') tooth.elements.overlays.missing = this.paper.path(`M${bbox.x},${bbox.y}L${bbox.x2},${bbox.y2}M${bbox.x2},${bbox.y}L${bbox.x},${bbox.y2}`).addClass('overlay-marker missing-cross');
                    if (newWholeState.condition === 'to-be-extracted') tooth.elements.overlays.tbe = this.paper.path(`M${bbox.x+bbox.w*0.3},${bbox.y}L${bbox.x+bbox.w*0.3},${bbox.y2} M${bbox.x+bbox.w*0.7},${bbox.y}L${bbox.x+bbox.w*0.7},${bbox.y2}`).addClass('overlay-marker tbe-lines');
                    if (newWholeState.condition === 'unerupted') tooth.elements.overlays.unerupted = this.paper.circle(bbox.cx, bbox.cy, bbox.w * 0.6).addClass('overlay-marker unerupted-circle');
                    if (newWholeState.condition === 'partially-erupted') tooth.elements.overlays.partiallyErupted = this.paper.circle(bbox.cx, bbox.cy, bbox.w * 0.6).addClass('overlay-marker partially-erupted-circle');
                    if (newWholeState.condition === 'fracture') tooth.elements.overlays.fracture = this.paper.path(`M${bbox.x},${bbox.cy} L${bbox.x+bbox.w*0.3},${bbox.y} L${bbox.x+bbox.w*0.6},${bbox.y2} L${bbox.x2},${bbox.cy}`).addClass('overlay-marker fracture-line');
                    if (newWholeState.condition === 'root-fragment') tooth.elements.overlays.rootFragment = this.paper.path(`M${bbox.x},${bbox.y2}L${bbox.x2},${bbox.y}`).addClass('overlay-marker root-fragment-cross');
                    if (newWholeState.condition === 'bridge-pontic') tooth.elements.overlays.bridge = this.paper.line(bbox.x, bbox.cy, bbox.x2, bbox.cy).addClass('overlay-marker bridge-pontic-line');
                }
                updatePerioToothView(toothId, newWholeState?.condition === 'missing');
            } else if (condition.type === 'surface' && surfaceId) {
                const el = Snap(document.querySelector(`[data-tooth-id="${toothId}"][data-surface-id="${surfaceId}"]`));
                if(el) {
                    const surfaceData = tooth.surfaces[surfaceId];
                    const isOff = surfaceData.condition === conditionKey;
                    const newCondKey = isOff ? 'sound' : conditionKey;
                    
                    if (isOff) surfaceData.note = ''; // Clear note when condition is removed
                    surfaceData.condition = newCondKey;
                    
                    Object.values(this.conditions).forEach((c: any) => Object.values(c.items).forEach((i: any) => el.removeClass(i.className)));
                    el.addClass(this.getCondition(newCondKey)?.className || 'sound');
                }
            }
            this.updateNoteIndicator(toothId, surfaceId);
            this.saveState();
            calculateDMFT(); // Update DMFT score on any change
        };

        this.clearWholeToothState = function(toothId: string) {
            const tooth = this.teeth[toothId];
            if (!tooth || !tooth.elements || !tooth.wholeToothState) return;
            const oldCond = this.getCondition(tooth.wholeToothState.condition);
            if (oldCond) tooth.elements.group.removeClass(oldCond.className);
            for(const key in tooth.elements.overlays) {
                if (!key.startsWith('note-')) { // Don't remove note icons here
                    tooth.elements.overlays[key].remove();
                    delete tooth.elements.overlays[key];
                }
            }
            tooth.wholeToothState = null;
            this.updateNoteIndicator(toothId, null);
            updatePerioToothView(toothId, false);
        };
        
        this.renderFromState = function(state: any) {
            this.dentitionMode = state.dentitionMode || 'permanent';
            this.draw();
            setTimeout(() => {
                this.teeth = JSON.parse(JSON.stringify(state.teeth));
                for (const id in this.teeth) {
                    const toothGroup = document.getElementById(`tooth-${id}`);
                    if (!toothGroup) continue;
                    const data = this.teeth[id];
                    this.teeth[id].elements = { group: Snap(toothGroup), overlays: {} };
                    
                    if (data.wholeToothState) {
                        const tempState = data.wholeToothState.condition;
                        data.wholeToothState.condition = 'none'; // Will be set back by applyCondition
                        this.applyCondition(id, null, tempState);
                    }
                     // Restore notes and indicators
                    if (data.wholeToothState?.note) {
                        this.updateNoteIndicator(id, null);
                    }

                    for (const surf in data.surfaces) {
                        if (data.surfaces[surf]?.condition && data.surfaces[surf].condition !== 'sound') {
                            const tempState = data.surfaces[surf].condition;
                            data.surfaces[surf].condition = 'sound';
                            this.applyCondition(id, surf, tempState);
                        }
                        if (data.surfaces[surf]?.note) {
                            this.updateNoteIndicator(id, surf);
                        }
                    }
                }
                syncPerioChartMissingTeeth();
                calculateDMFT();
            }, 0);
        };

        this.saveState = function() {
            if (this.historyIndex < this.history.length - 1) this.history = this.history.slice(0, this.historyIndex + 1);
            const stateToSave: any = { teeth: JSON.parse(JSON.stringify(this.teeth)), dentitionMode: this.dentitionMode };
            for (const id in stateToSave.teeth) delete stateToSave.teeth[id].elements;
            this.history.push(stateToSave);
            this.historyIndex = this.history.length - 1;
            updateUndoRedoButtons();
        };
        this.undo = function() { if (this.historyIndex > 0) { this.historyIndex--; this.renderFromState(this.history[this.historyIndex]); } updateUndoRedoButtons(); };
        this.redo = function() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.renderFromState(this.history[this.historyIndex]); } updateUndoRedoButtons(); };
        
        this.updateSelectedConditionDisplay = function() {
            const condition = this.getCondition(this.selectedCondition);
            const display = document.getElementById('selected-condition-display') as HTMLDivElement;
            if(condition && display) {
                display.textContent = condition.label;
                display.style.backgroundColor = condition.color;
                display.style.color = condition.textColor || '#1f2937';
                display.style.borderColor = condition.textColor || '#1f2937';
            }
        };

        this.paper.click((e: MouseEvent) => { 
            const target = e.target as SVGElement;
            const noteToothId = target.getAttribute('data-note-tooth-id') || (target.closest('.note-indicator') as SVGElement)?.getAttribute('data-note-tooth-id');
            if (noteToothId) {
                const noteSurfaceId = target.getAttribute('data-note-surface-id') || (target.closest('.note-indicator') as SVGElement)?.getAttribute('data-note-surface-id');
                document.body.dispatchEvent(new CustomEvent('show-note-modal', { detail: { toothId: noteToothId, surfaceId: noteSurfaceId } }));
                return; 
            }
            
            const id = target.getAttribute('data-tooth-id'), surf = target.getAttribute('data-surface-id'); 
            if (id) this.applyCondition(id, surf, this.selectedCondition); 
        });
    }

    // --- App State ---
    let currentPatientData: any = getInitialPatientData();
    let inventoryData: any[] = [];
    let currentSchedulerDate = new Date();
    let currentSchedulerView = 'day'; // 'day', 'week', or 'month'
    let suggestionPopup: HTMLDivElement | null = null;
    let activeSuggestionInput: HTMLInputElement | null = null;
    let suggestionDebounceTimeout: any = null;

    const patientInfoFields = [
        'patient-name', 'patient-dob', 'patient-gender', 'patient-id', 'patient-id-passport', 'patient-phone',
        'patient-email', 'patient-address', 'patient-emergency-contact-name', 'patient-emergency-contact-number',
        'patient-occupation', 'patient-housing', 'patient-contact-method', 
        'med-aid-name', 'med-aid-number', 'med-aid-member', 'med-aid-member-id', 'referral-source',
        'cond-diabetes', 'cond-hypertension', 'cond-asthma', 'cond-epilepsy', 'cond-heart', 'history-systemic-other',
        'history-medications', 'history-surgeries', 
        'history-dental-treatments', 'history-oral-hygiene', 'history-pain', 'history-anxiety',
        'prev-dentist-name', 'prev-dentist-contact',
        'exam-face', 'exam-tmj', 'exam-lymph', 'exam-lesions', 'exam-saliva',
        'exam-tongue', 'exam-gingiva', 'exam-mucosa', 'exam-cancer-screening', 'exam-habits',
        'exam-malocclusion', 'exam-occlusion', 'exam-supernumerary',
        'invest-bitewings-date', 'invest-bitewings-details', 'invest-bitewings-findings', 'invest-bitewings-ref',
        'invest-panoramic-date', 'invest-panoramic-details', 'invest-panoramic-findings', 'invest-panoramic-ref',
        'invest-periapical-date', 'invest-periapical-details', 'invest-periapical-findings', 'invest-periapical-ref',
        'invest-photos-date', 'invest-photos-details', 'invest-photos-findings', 'invest-photos-ref',
        'invest-cbct-date', 'invest-cbct-details', 'invest-cbct-findings', 'invest-cbct-ref',
        'invest-lab-date', 'invest-lab-details', 'invest-lab-findings', 'invest-lab-ref',
        'treat-clinical-notes', 'treat-plan', 'treat-followup',
        'diag-differential', 'diag-definitive'
    ];
    
    // South African Tariff Codes + ICD-10
    const DENTAL_CODES = [
      { code: '8101', description: 'Consultation' },
      { code: '8107', description: 'Emergency after hours consultation' },
      { code: '8201', description: 'Intra-oral radiograph (periapical/bite-wing)' },
      { code: '8203', description: 'Panorex (OPG)' },
      { code: '8111', description: 'Scale and Polish' },
      { code: '8113', description: 'Topical fluoride application' },
      { code: '8115', description: 'Fissure sealant (per tooth)' },
      { code: '8303', description: 'Amalgam filling - 1 surface' },
      { code: '8305', description: 'Amalgam filling - 2 surfaces' },
      { code: '8343', description: 'Composite filling - 1 surface (anterior)' },
      { code: '8345', description: 'Composite filling - 2 surfaces (anterior)' },
      { code: '8349', description: 'Composite filling - 1 surface (posterior)' },
      { code: '8351', description: 'Composite filling - 2 surfaces (posterior)' },
      { code: '8401', description: 'Root canal therapy - single root' },
      { code: '8403', description: 'Root canal therapy - multi-rooted' },
      { code: '8501', description: 'Full acrylic denture (upper or lower)' },
      { code: '8703', description: 'Porcelain fused to metal crown' },
      { code: '8411', description: 'Extraction (uncomplicated)' },
      { code: '8413', description: 'Surgical extraction' },
      { code: 'K02.9', description: 'ICD-10: Dental caries, unspecified' },
      { code: 'K03.6', description: 'ICD-10: Deposits [accretions] on teeth' },
      { code: 'K04.1', description: 'ICD-10: Necrosis of pulp' },
      { code: 'K05.10', description: 'ICD-10: Chronic gingivitis, plaque induced' },
      { code: 'K08.1', description: 'ICD-10: Complete loss of teeth' }
    ];

    let xrayBase64: string | null = null;
    let xrayMimeType: string | null = null;
    let revenueChart: any, procedureChart: any;

    const chartPaper = Snap('#chart');
    if (!chartPaper) { console.error("Initialization failed."); return; }
    const dentalChart = new (DentalChart as any)(chartPaper);
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement, redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
    
    function getInitialPatientData() {
        return {
            patientInfo: {},
            perioData: {},
            treatmentPlan: [],
            procedureLog: [],
            appointmentLog: [],
            consentLog: [],
            billingLog: [],
            currentChart: null,
            snapshots: [],
        };
    }

    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const targetPanelId = button.id.replace('tab-', 'panel-');
            tabPanels.forEach(panel => {
                if (panel.id === targetPanelId) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
            if (targetPanelId === 'panel-patient-hub') {
                updatePatientHub();
            }
             if (targetPanelId === 'panel-practice-dashboard') {
                updatePracticeDashboard();
            }
             if (targetPanelId === 'panel-scheduler') {
                renderScheduler();
            }
            if(targetPanelId === 'panel-inventory'){
                renderInventory();
            }
        });
    });

    function setupConditionModal() {
        const conditionGrid = document.getElementById('condition-grid');
        if (!conditionGrid) return;
        conditionGrid.innerHTML = '';
        for (const catKey in dentalChart.conditions) {
            const cat = dentalChart.conditions[catKey];
            const section = document.createElement('div');
            section.innerHTML = `<h4 class="text-md font-semibold text-gray-700 mb-2">${cat.label}</h4>`;
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 gap-2';
            for (const itemKey in cat.items) {
                const item = cat.items[itemKey];
                const btn = document.createElement('button');
                btn.textContent = item.label;
                btn.dataset.condition = itemKey;
                btn.className = 'condition-btn w-full text-xs py-2 px-1 rounded-lg border';
                btn.style.backgroundColor = item.color;
                btn.style.color = item.textColor || '#1f2937';
                btn.style.borderColor = item.textColor || '#1f2937';
                btn.addEventListener('click', () => {
                    dentalChart.selectedCondition = itemKey;
                    dentalChart.updateSelectedConditionDisplay();
                    (document.getElementById('condition-select-modal') as HTMLDivElement).classList.add('hidden');
                });
                grid.appendChild(btn);
            }
            section.appendChild(grid);
            conditionGrid.appendChild(section);
        }
    }
    document.getElementById('change-condition-btn')?.addEventListener('click', () => (document.getElementById('condition-select-modal') as HTMLDivElement).classList.remove('hidden'));
    document.querySelectorAll('.modal-cancel').forEach(el => el.addEventListener('click', (e) => (e.target as HTMLElement).closest('.modal-overlay')?.classList.add('hidden')));

    const confirmModal = document.getElementById('confirmation-modal'); let confirmCallback: (() => void) | null = null;
    function showConfirm(text: string, callback: () => void) { 
        if (!confirmModal) return;
        const modalText = confirmModal.querySelector('#modal-text') as HTMLParagraphElement;
        const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;

        if (modalText) modalText.textContent = text; 
        confirmCallback = callback; 
        confirmModal.classList.remove('hidden'); 
        if (confirmBtn) confirmBtn.classList.remove('hidden');
    }
    document.getElementById('modal-confirm')?.addEventListener('click', () => { if (confirmCallback) confirmCallback(); confirmModal?.classList.add('hidden'); });

    // --- Main Save/Load/Action Logic ---
    document.getElementById('save-chart')?.addEventListener('click', () => {
        const patientId = currentPatientData.patientInfo['patient-id']?.trim();
        if (!patientId) {
            showConfirm("Please enter a Patient ID before saving.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
        savePatientData(patientId);
    });
    
     document.getElementById('save-outreach-chart')?.addEventListener('click', () => {
        const patientId = currentPatientData.patientInfo['patient-id']?.trim();
         if (!patientId) {
            showConfirm("Please enter a Patient ID / Identifier before saving.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
        savePatientData(patientId);
    });
    
    function savePatientData(patientId: string) {
        currentPatientData.currentChart = dentalChart.history[dentalChart.historyIndex];
        
        localStorage.setItem(`dentalPatientData-${patientId}`, JSON.stringify(currentPatientData));
        localStorage.setItem('lastPatientId', patientId);
        
        showConfirm(`All data for patient ${patientId} has been saved.`, () => {});
        const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
        if (confirmBtn) confirmBtn.classList.add('hidden');
    }


    document.getElementById('load-patient-btn')?.addEventListener('click', () => {
        const patientIdInput = document.getElementById('patient-id') as HTMLInputElement;
        if (!patientIdInput) return;
        const patientId = patientIdInput.value.trim();
        if (!patientId) {
            showConfirm("Please enter a Patient ID to load.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
        
        const dataJSON = localStorage.getItem(`dentalPatientData-${patientId}`);
        if (dataJSON) {
            loadData(dataJSON);
            showConfirm(`Successfully loaded data for patient ${patientId}.`, () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
        } else {
            showConfirm(`No data found for patient ID ${patientId}.`, () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
        }
    });
    
    function loadData(dataJSON: string) {
        if (!dataJSON) return;
        const data = JSON.parse(dataJSON);
        
        currentPatientData = { ...getInitialPatientData(), ...data };
        localStorage.setItem('lastPatientId', currentPatientData.patientInfo['patient-id']);


        // Render Patient Info
        if (currentPatientData.patientInfo) {
            patientInfoFields.forEach(id => {
                const el = document.getElementById(id) as HTMLInputElement;
                 if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = !!currentPatientData.patientInfo[id];
                    } else {
                        el.value = currentPatientData.patientInfo[id] || '';
                    }
                }
            });
            // Sync main fields to outreach quick fields
            const outreachName = document.getElementById('outreach-patient-name') as HTMLInputElement;
            if (outreachName) outreachName.value = currentPatientData.patientInfo['patient-name'] || '';
            const outreachId = document.getElementById('outreach-patient-id') as HTMLInputElement;
            if (outreachId) outreachId.value = currentPatientData.patientInfo['patient-id'] || '';
            const outreachDob = document.getElementById('outreach-patient-dob') as HTMLInputElement;
            if (outreachDob) outreachDob.value = currentPatientData.patientInfo['patient-dob'] || '';
            const outreachMedHx = document.getElementById('outreach-med-hx') as HTMLInputElement;
            if (outreachMedHx) outreachMedHx.value = currentPatientData.patientInfo['history-medications'] || '';
            const outreachDiabetes = document.getElementById('outreach-cond-diabetes') as HTMLInputElement;
            if (outreachDiabetes) outreachDiabetes.checked = !!currentPatientData.patientInfo['cond-diabetes'];
            const outreachHeart = document.getElementById('outreach-cond-heart') as HTMLInputElement;
            if (outreachHeart) outreachHeart.checked = !!currentPatientData.patientInfo['cond-heart'];
            const outreachMedAidName = document.getElementById('outreach-med-aid-name') as HTMLInputElement;
            if (outreachMedAidName) outreachMedAidName.value = currentPatientData.patientInfo['med-aid-name'] || '';
            const outreachMedAidNumber = document.getElementById('outreach-med-aid-number') as HTMLInputElement;
            if (outreachMedAidNumber) outreachMedAidNumber.value = currentPatientData.patientInfo['med-aid-number'] || '';
        }

        // Render Perio Chart
        if (currentPatientData.perioData) {
            Object.keys(currentPatientData.perioData).forEach(id => {
                const el = document.getElementById(id) as HTMLInputElement;
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = !!currentPatientData.perioData[id];
                    } else {
                        el.value = currentPatientData.perioData[id] || '';
                    }
                }
            });
            document.querySelectorAll('#perio-chart-container .perio-input').forEach(input => updatePerioInputStyle(input as HTMLInputElement));
            document.querySelectorAll('.perio-cell[data-cal-id]').forEach(cell => calculateCAL((cell as HTMLElement).dataset.calId as string));
            updatePerioScores();
        }
        
        // Render Tables
        renderTreatmentPlan();
        renderProcedureLog();
        renderScheduler();
        renderConsentLog();
        renderBillingLog();
        renderSnapshots();

        if (currentPatientData.currentChart) {
            dentalChart.history = [currentPatientData.currentChart];
            dentalChart.historyIndex = 0;
            dentalChart.renderFromState(currentPatientData.currentChart);
        }
        updateUndoRedoButtons();
        updatePatientHub();
    }
    
    document.getElementById('reset-chart')?.addEventListener('click', () => {
        showConfirm("This will clear all fields for a new patient. Unsaved data will be lost.", () => {
           resetAllData();
        });
    });

     document.getElementById('reset-outreach-chart')?.addEventListener('click', () => {
        showConfirm("This will clear the chart for a new outreach patient. Unsaved data will be lost.", () => {
           resetAllData();
        });
    });

    function resetAllData() {
        currentPatientData = getInitialPatientData();
         patientInfoFields.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            }
        });
        document.querySelectorAll('#perio-chart-container input').forEach(input => {
            const i = input as HTMLInputElement;
            if (i.type === 'checkbox') i.checked = false;
            else i.value = '';
            i.classList.remove('high-pd', 'recession', 'healthy-pd');
        });
        document.querySelectorAll('.perio-cal').forEach(calCell => {
            (calCell as HTMLDivElement).textContent = '';
        });
        
        renderTreatmentPlan();
        renderProcedureLog();
        renderScheduler();
        renderConsentLog();
        renderBillingLog();
        renderSnapshots();

        dentalChart.dentitionMode = 'permanent';
        dentalChart.draw();
        updatePerioScores();
        
        document.querySelectorAll('.dmft-input').forEach(input => {
            const el = input as HTMLInputElement;
            el.classList.remove('manual-override');
            el.value = '0';
        });
        calculateDMFT();

        // Clear outreach specific fields
        const outreachName = document.getElementById('outreach-patient-name') as HTMLInputElement;
        if (outreachName) outreachName.value = '';
        const outreachId = document.getElementById('outreach-patient-id') as HTMLInputElement;
        if (outreachId) outreachId.value = '';
        const outreachDob = document.getElementById('outreach-patient-dob') as HTMLInputElement;
        if (outreachDob) outreachDob.value = '';
        const outreachMedHx = document.getElementById('outreach-med-hx') as HTMLInputElement;
        if (outreachMedHx) outreachMedHx.value = '';
        const outreachDiabetes = document.getElementById('outreach-cond-diabetes') as HTMLInputElement;
        if (outreachDiabetes) outreachDiabetes.checked = false;
        const outreachHeart = document.getElementById('outreach-cond-heart') as HTMLInputElement;
        if (outreachHeart) outreachHeart.checked = false;
        const outreachMedAidName = document.getElementById('outreach-med-aid-name') as HTMLInputElement;
        if (outreachMedAidName) outreachMedAidName.value = '';
        const outreachMedAidNumber = document.getElementById('outreach-med-aid-number') as HTMLInputElement;
        if (outreachMedAidNumber) outreachMedAidNumber.value = '';
        updatePatientHub();
    }

    document.getElementById('toggle-dentition-btn')?.addEventListener('click', () => { 
        dentalChart.dentitionMode = dentalChart.dentitionMode === 'permanent' ? 'primary' : 'permanent'; 
        dentalChart.draw(); 
        dentalChart.saveState();
        initializePerioChart(dentalChart.dentitionMode);
    });

    undoBtn?.addEventListener('click', () => dentalChart.undo());
    redoBtn?.addEventListener('click', () => dentalChart.redo());
    function updateUndoRedoButtons() { 
        if (!undoBtn || !redoBtn) return;
        undoBtn.disabled = dentalChart.historyIndex <= 0; 
        redoBtn.disabled = dentalChart.historyIndex >= dentalChart.history.length - 1; 
    }

    // --- Snapshot Logic ---
    const snapshotSelect = document.getElementById('snapshot-select') as HTMLSelectElement;
    document.getElementById('save-snapshot-btn')?.addEventListener('click', () => {
        const now = new Date();
        const defaultName = `Snapshot - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        const name = prompt("Enter a name for this snapshot:", defaultName);
    
        if (name !== null) {
            const currentPerioData: any = {};
            document.querySelectorAll('#perio-chart-container input').forEach(input => {
                const i = input as HTMLInputElement;
                currentPerioData[i.id] = i.type === 'checkbox' ? i.checked : i.value;
            });
    
            const snapshot = {
                name: name,
                timestamp: now.toISOString(),
                state: dentalChart.history[dentalChart.historyIndex],
                perioData: currentPerioData
            };
            currentPatientData.snapshots.push(snapshot);
            renderSnapshots();
            if(snapshotSelect) snapshotSelect.value = snapshot.timestamp;
    
            showConfirm(`Snapshot "${name}" was saved successfully.`, () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
        }
    });

    snapshotSelect?.addEventListener('change', (e) => {
        const timestamp = (e.target as HTMLSelectElement).value;
        if (timestamp === "-1") {
            const latestState = dentalChart.history[dentalChart.history.length - 1];
            if(latestState) dentalChart.renderFromState(latestState);
        } else {
            const snapshot = currentPatientData.snapshots.find((s:any) => s.timestamp === timestamp);
            if (snapshot) {
                dentalChart.renderFromState(snapshot.state);
            }
        }
    });
    
     // --- Perio Comparison Logic ---
    const compareBtn = document.getElementById('compare-snapshots-btn');
    const comparisonModal = document.getElementById('comparison-modal');
    const compareSelect1 = document.getElementById('compare-select-1') as HTMLSelectElement;
    const compareSelect2 = document.getElementById('compare-select-2') as HTMLSelectElement;
    const comparisonContainer = document.getElementById('comparison-container');

    compareBtn?.addEventListener('click', () => {
        if (currentPatientData.snapshots.length < 2) {
            showConfirm("You need at least two saved snapshots to compare.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
        
        if (!compareSelect1 || !compareSelect2) return;
        compareSelect1.innerHTML = '';
        compareSelect2.innerHTML = '';
        currentPatientData.snapshots.forEach((s:any) => {
            const option1 = document.createElement('option');
            option1.value = s.timestamp;
            option1.textContent = s.name;
            compareSelect1.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = s.timestamp;
            option2.textContent = s.name;
            compareSelect2.appendChild(option2);
        });
        
        compareSelect1.selectedIndex = 1; // Default to second most recent
        compareSelect2.selectedIndex = 0; // Default to most recent

        updateComparisonView();
        comparisonModal?.classList.remove('hidden');
    });
    
    if (compareSelect1) compareSelect1.addEventListener('change', updateComparisonView);
    if (compareSelect2) compareSelect2.addEventListener('change', updateComparisonView);

    function updateComparisonView() {
        if (!comparisonContainer || !compareSelect1 || !compareSelect2) return;

        const snap1 = currentPatientData.snapshots.find((s:any) => s.timestamp === compareSelect1.value);
        const snap2 = currentPatientData.snapshots.find((s:any) => s.timestamp === compareSelect2.value);

        if (!snap1 || !snap2) return;

        const chart1HTML = generatePerioChart(snap1.state.dentitionMode, snap1.perioData);
        const chart2HTML = generatePerioChart(snap2.state.dentitionMode, snap2.perioData);

        comparisonContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="font-bold text-center mb-2">${snap1.name}</h4>
                    <div class="min-w-max">${chart1HTML}</div>
                </div>
                 <div>
                    <h4 class="font-bold text-center mb-2">${snap2.name}</h4>
                    <div class="min-w-max" id="comparison-chart-2">${chart2HTML}</div>
                </div>
            </div>
        `;
        
        const chart2Container = document.getElementById('comparison-chart-2');
        if (!chart2Container) return;

        chart2Container.querySelectorAll<HTMLInputElement>('.perio-input[type="number"]').forEach(input2 => {
            const value2 = input2.value ? parseInt(input2.value, 10) : NaN;
            const value1 = snap1.perioData[input2.id] ? parseInt(snap1.perioData[input2.id], 10) : NaN;

            const hasValue1 = !isNaN(value1);
            const hasValue2 = !isNaN(value2);
            
            if ((hasValue1 || hasValue2) && value1 !== value2) {
                 const diff = (hasValue2 ? value2 : 0) - (hasValue1 ? value1 : 0);
                 if (diff === 0) return;

                 const indicator = document.createElement('span');
                 indicator.className = 'comparison-change';

                 if (diff > 0) {
                     indicator.classList.add('change-worse');
                     indicator.textContent = `+${diff}`;
                 } else {
                     indicator.classList.add('change-better');
                     indicator.textContent = `${diff}`;
                 }
                 input2.parentElement?.appendChild(indicator);
            }
        });

        chart2Container.querySelectorAll<HTMLInputElement>('.perio-checkbox').forEach(input2 => {
            const checked2 = input2.checked;
            const checked1 = !!snap1.perioData[input2.id];

            if (checked2 && !checked1) { // New problem
                const cell = input2.parentElement;
                if (input2.id.includes('-bop-')) {
                    cell?.classList.add('bop-indicator');
                } else if (input2.id.includes('-pi-')) {
                    cell?.classList.add('pi-indicator');
                }
            }
        });
    }


    function renderSnapshots() {
        if (!snapshotSelect) return;
        snapshotSelect.innerHTML = '<option value="-1">Current Chart</option>';
        currentPatientData.snapshots.sort((a:any, b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        currentPatientData.snapshots.forEach((s:any) => {
            const option = document.createElement('option');
            option.value = s.timestamp;
            option.textContent = s.name;
            snapshotSelect.appendChild(option);
        });
    }

    // --- Periodontal Chart Logic ---
    function calculateCAL(baseId: string, container: Document | HTMLElement = document) {
        const pdInput = container.querySelector('#' + baseId.replace('-cal-', '-pd-')) as HTMLInputElement;
        const gmInput = container.querySelector('#' + baseId.replace('-cal-', '-gm-')) as HTMLInputElement;
        const calCell = container.querySelector(`[data-cal-id="${baseId}"]`) as HTMLDivElement;

        const pd = parseInt(pdInput?.value, 10) || 0;
        const gm = parseInt(gmInput?.value, 10) || 0;

        if (calCell && pdInput && gmInput) {
            if (pdInput.value || gmInput.value) {
                calCell.textContent = (pd + gm).toString();
            } else {
                calCell.textContent = '';
            }
        }
    }

    function updatePerioInputStyle(input: HTMLInputElement) {
        const value = parseInt(input.value, 10);
        const id = input.id;

        input.classList.remove('high-pd', 'recession', 'healthy-pd');

        if (id.includes('-pd-')) { // Probing Depth
            if (!isNaN(value)) {
                if (value > 3) {
                    input.classList.add('high-pd');
                } else if (value >= 1) {
                    input.classList.add('healthy-pd');
                }
            }
        } else if (id.includes('-gm-')) { // Gingival Margin
            if (!isNaN(value) && value > 0) {
                input.classList.add('recession');
            }
        }
    }
    
    function updatePerioToothView(toothId: string, isMissing: boolean) {
        const cells = document.querySelectorAll(`.perio-cell[data-tooth-id="${toothId}"]`);
        cells.forEach(cell => {
            cell.classList.toggle('missing', isMissing);
        });
        updatePerioScores();
    }

    function syncPerioChartMissingTeeth() {
        if (!dentalChart.teeth) return;
        Object.keys(dentalChart.teeth).forEach(toothId => {
            const isMissing = dentalChart.teeth[toothId].wholeToothState?.condition === 'missing';
            updatePerioToothView(toothId, isMissing);
        });
    }
    
    function updatePerioScores() {
        const bopCheckboxes = document.querySelectorAll('.perio-checkbox[id*="-bop-"]');
        const piCheckboxes = document.querySelectorAll('.perio-checkbox[id*="-pi-"]');
        
        let bopSites = 0, bopPresent = 0;
        bopCheckboxes.forEach(cb => {
            if (!(cb as HTMLElement).closest('.missing')) {
                bopSites++;
                if ((cb as HTMLInputElement).checked) bopPresent++;
            }
        });

        let piSites = 0, piPresent = 0;
        piCheckboxes.forEach(cb => {
            if (!(cb as HTMLElement).closest('.missing')) {
                piSites++;
                if ((cb as HTMLInputElement).checked) piPresent++;
            }
        });

        const bopScore = bopSites > 0 ? Math.round((bopPresent / bopSites) * 100) : 0;
        const piScore = piSites > 0 ? Math.round((piPresent / piSites) * 100) : 0;

        const bopScoreEl = document.getElementById('bop-score');
        const piScoreEl = document.getElementById('pi-score');
        if (bopScoreEl) bopScoreEl.textContent = `${bopScore}%`;
        if (piScoreEl) piScoreEl.textContent = `${piScore}%`;
    }


    const perioContainer = document.getElementById('perio-chart-container');
    perioContainer?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.id && currentPatientData.perioData) {
            currentPatientData.perioData[target.id] = target.type === 'checkbox' ? target.checked : target.value;
        }

        if (target.classList.contains('perio-input')) {
            updatePerioInputStyle(target);
            const baseId = target.id.replace('-pd-', '-cal-').replace('-gm-', '-cal-');
            calculateCAL(baseId);
        }
        if (target.classList.contains('perio-checkbox')) {
            updatePerioScores();
        }
    });
    
    perioContainer?.addEventListener('keyup', (e) => {
        const target = e.target as HTMLInputElement;
        // Check if it's a number input and the key is a digit.
        if (target.matches('.perio-input[type="number"]') && /^\d$/.test(e.key)) {
            const allInputs = Array.from(perioContainer.querySelectorAll('.perio-input:not([type="text"])')) as HTMLInputElement[];
            let currentIndex = allInputs.indexOf(target);
            if (currentIndex > -1) {
                let nextIndex = currentIndex + 1;
                // Find the next available input that isn't in a missing tooth
                while (nextIndex < allInputs.length) {
                    const nextInput = allInputs[nextIndex];
                    if (!nextInput.closest('.missing')) {
                        nextInput.focus();
                        nextInput.select();
                        return; // Exit after focusing
                    }
                    nextIndex++; // Skip the missing one and try the next
                }
            }
        }
    });


    function generatePerioChart(mode: string, data: any = {}) {
        const tempContainer = document.createElement('div');
        const permanent = {
            q1: [18, 17, 16, 15, 14, 13, 12, 11], q2: [21, 22, 23, 24, 25, 26, 27, 28],
            q4: [48, 47, 46, 45, 44, 43, 42, 41], q3: [31, 32, 33, 34, 35, 36, 37, 38]
        };
        const primary = {
            q5: [55, 54, 53, 52, 51], q6: [61, 62, 63, 64, 65],
            q8: [85, 84, 83, 82, 81], q7: [71, 72, 73, 74, 75]
        };
        
        const teethConfig = mode === 'permanent' ? permanent : primary;
        const upperTeeth = 'q1' in teethConfig ? [...teethConfig.q1, ...teethConfig.q2] : [...teethConfig.q5, ...teethConfig.q6];
        const lowerTeeth = 'q4' in teethConfig ? [...teethConfig.q4, ...teethConfig.q3] : [...teethConfig.q8, ...teethConfig.q7];

        const createHeaderRow = (teeth: number[]) => teeth.map(t => `<div class="perio-cell perio-tooth-header" style="grid-column: span 3;" data-tooth-id="${t}">${t}</div>`).join('');
        const createInputRow = (label: string, type: string, aspect: string, teeth: number[]) => {
            let cells = `<div class="perio-cell perio-label">${label}</div>`;
            teeth.forEach(toothId => {
                for (let i = 1; i <= 3; i++) {
                    const id = `perio-${type}-${toothId}-${aspect}${i}`;
                    const value = data[id] || '';
                    cells += `<div class="perio-cell" data-tooth-id="${toothId}"><input type="number" id="${id}" value="${value}" class="perio-input" min="0" max="20"></div>`;
                }
            });
            return cells;
        };
         const createCalRow = (label: string, aspect: string, teeth: number[]) => {
            let cells = `<div class="perio-cell perio-label">${label}</div>`;
            teeth.forEach(toothId => {
                for (let i = 1; i <= 3; i++) {
                    const id = `perio-cal-${toothId}-${aspect}${i}`;
                    cells += `<div class="perio-cell perio-cal" data-cal-id="${id}" data-tooth-id="${toothId}"></div>`;
                }
            });
            return cells;
        };
        const createCheckboxRow = (label: string, type: string, aspect: string, teeth: number[]) => {
             let cells = `<div class="perio-cell perio-label">${label}</div>`;
             teeth.forEach(toothId => {
                for (let i = 1; i <= 3; i++) {
                    const id = `perio-${type}-${toothId}-${aspect}${i}`;
                    const checked = data[id] ? 'checked' : '';
                    cells += `<div class="perio-cell perio-bop-cell" data-tooth-id="${toothId}"><input type="checkbox" id="${id}" class="perio-checkbox" ${checked}></div>`;
                }
            });
            return cells;
        };
        const createSingleInputRow = (label: string, type: string, teeth: number[]) => {
            let cells = `<div class="perio-cell perio-label">${label}</div>`;
            teeth.forEach(toothId => {
                const id = `perio-${type}-${toothId}`;
                 const value = data[id] || '';
                cells += `<div class="perio-cell" style="grid-column: span 3;" data-tooth-id="${toothId}"><input type="text" value="${value}" id="${id}" class="perio-input"></div>`;
            });
            return cells;
        };

        const buildArch = (teeth: number[], isUpper: boolean) => {
            const gridCols = `grid-template-columns: auto repeat(${teeth.length * 3}, minmax(0, 1fr));`;
            const lingualLabel = isUpper ? 'LINGUAL/PALATAL' : 'LINGUAL';
            return `
                <div class="perio-grid" style="${gridCols}">
                    <div class="perio-cell perio-label">BUCCAL</div>${createHeaderRow(teeth)}
                    ${createSingleInputRow('Mobility', 'mobility', teeth)}
                    ${createSingleInputRow('Implant', 'implant', teeth)}
                    ${createSingleInputRow('Furcation', 'furcation-b', teeth)}
                    ${createInputRow('Gingival Margin', 'gm', 'b', teeth)}
                    ${createInputRow('Probing Depth', 'pd', 'b', teeth)}
                    ${createCalRow('CAL', 'b', teeth)}
                    ${createCheckboxRow('BOP', 'bop', 'b', teeth)}
                    ${createCheckboxRow('PI', 'pi', 'b', teeth)}
                    
                    <div class="perio-cell perio-label" style="grid-column: 1 / -1; background-color: #9ca3af; height: 2px; padding: 0;"></div>

                    ${createCheckboxRow('PI', 'pi', 'l', teeth)}
                    ${createCheckboxRow('BOP', 'bop', 'l', teeth)}
                    ${createCalRow('CAL', 'l', teeth)}
                    ${createInputRow('Probing Depth', 'pd', 'l', teeth)}
                    ${createInputRow('Gingival Margin', 'gm', 'l', teeth)}
                    ${createSingleInputRow('Furcation', 'furcation-l', teeth)}
                    <div class="perio-cell perio-label">${lingualLabel}</div>${createHeaderRow(teeth)}
                </div>
            `;
        };
        
        tempContainer.innerHTML = buildArch(upperTeeth, true) + '<div class="my-4"></div>' + buildArch(lowerTeeth, false);
        
        if (Object.keys(data).length > 0) {
             tempContainer.querySelectorAll('.perio-input').forEach(input => updatePerioInputStyle(input as HTMLInputElement));
             tempContainer.querySelectorAll('.perio-cell[data-cal-id]').forEach(cell => calculateCAL((cell as HTMLElement).dataset.calId!, tempContainer));
        }
        
        return tempContainer.innerHTML;
    }

    function initializePerioChart(mode: string) {
        const container = document.getElementById('perio-chart-container');
        if (container) {
            container.innerHTML = generatePerioChart(mode);
            syncPerioChartMissingTeeth();
        }
    }

    // --- Treatment Plan Logic ---
    const addToPlanBtn = document.getElementById('add-to-plan-btn');
    const treatmentPlanBody = document.getElementById('treatment-plan-body') as HTMLTableSectionElement;

    function renderTreatmentPlan() {
        if (!treatmentPlanBody) return;
        treatmentPlanBody.innerHTML = '';
        if (!currentPatientData.treatmentPlan || currentPatientData.treatmentPlan.length === 0) {
            treatmentPlanBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 p-4">No items in the treatment plan.</td></tr>';
            return;
        }

        currentPatientData.treatmentPlan.forEach((rowData: any, index: number) => {
            const row = treatmentPlanBody.insertRow();
            row.dataset.index = index.toString();
            row.innerHTML = `
                <td class="px-4 py-2 text-sm">${rowData.tooth}</td>
                <td class="px-4 py-2 text-sm">${rowData.code || ''}</td>
                <td class="px-4 py-2 text-sm">${rowData.procedure}</td>
                <td class="px-4 py-2 text-center whitespace-nowrap">
                    <button class="generate-handout-btn text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600" title="Generate Patient Handout"><i class="fas fa-file-alt"></i> Handout</button>
                    <button class="log-completed-btn text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ml-2">Log as Completed</button>
                    <button class="remove-plan-item-btn text-red-500 hover:text-red-700 ml-2"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }

    if(treatmentPlanBody) {
        treatmentPlanBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (!button) return;
    
            const row = button.closest('tr');
            if (!row || !row.dataset.index) return;
            
            const index = parseInt(row.dataset.index, 10);
            const item = currentPatientData.treatmentPlan[index];
    
            if (button.classList.contains('remove-plan-item-btn')) {
                showConfirm(`Are you sure you want to remove "${item.procedure}" from the treatment plan?`, () => {
                    currentPatientData.treatmentPlan.splice(index, 1);
                    renderTreatmentPlan();
                });
            } else if (button.classList.contains('log-completed-btn')) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging...';
        
                let aiNote = '';
                try {
                    const prompt = `You are a dental assistant AI. A planned procedure has been completed. Based on the procedure description, generate a concise, standard clinical note. Procedure: "${item.procedure} on tooth ${item.tooth}".`;
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                    });
                    aiNote = response.text;
                } catch (error) {
                    console.error("AI note generation failed:", error);
                    aiNote = "AI note generation failed."; // Provide fallback text
                }
                
                currentPatientData.procedureLog.push({ 
                    date: new Date().toISOString().split('T')[0], 
                    tooth: item.tooth,
                    code: item.code || '',
                    procedure: item.procedure,
                    clinician: '',
                    notes: aiNote,
                    billed: false
                });
                renderProcedureLog();
                
                currentPatientData.treatmentPlan.splice(index, 1);
                renderTreatmentPlan();
            } else if (button.classList.contains('generate-handout-btn')) {
                generateAndShowHandout(`Handout for ${item.procedure}`, [item], false);
            }
        });
    }

    addToPlanBtn?.addEventListener('click', () => {
        const toothInput = document.getElementById('plan-tooth-input') as HTMLInputElement;
        const codeInput = document.getElementById('plan-code-input') as HTMLInputElement;
        const procedureInput = document.getElementById('plan-procedure-input') as HTMLInputElement;
    
        const tooth = toothInput.value.trim();
        const code = codeInput.value.trim();
        const procedure = procedureInput.value.trim();
    
        if (!tooth || !procedure) {
            showConfirm("Please enter both a tooth/area and a procedure.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
    
        currentPatientData.treatmentPlan.push({ tooth, code, procedure });
        renderTreatmentPlan();
    
        // Clear inputs after adding
        toothInput.value = '';
        codeInput.value = '';
        procedureInput.value = '';
    });
    
    // --- AI Plan Generation ---
    document.getElementById('generate-ai-plan-btn')?.addEventListener('click', async () => {
        const planTextarea = document.getElementById('treat-plan') as HTMLTextAreaElement;
        const generateBtn = document.getElementById('generate-ai-plan-btn') as HTMLButtonElement;
        
        if (!planTextarea || !generateBtn) return;
        planTextarea.value = "Gathering patient data...";
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
        const problems: string[] = [];
        Object.values(dentalChart.teeth).forEach((tooth: any) => {
            if (tooth.wholeToothState?.condition && tooth.wholeToothState.condition !== 'none' && tooth.wholeToothState.condition !== 'missing' && tooth.wholeToothState.condition !== 'implant') {
                const condition = dentalChart.getCondition(tooth.wholeToothState.condition);
                if (condition) {
                    problems.push(`- ${condition.label} on tooth #${tooth.id}`);
                }
            }
            Object.entries(tooth.surfaces).forEach(([surface, surfaceData]: [string, any]) => {
                const conditionKey = surfaceData.condition;
                if (conditionKey !== 'sound' && !['amalgam', 'composite', 'glass-ionomer', 'gold', 'sealant'].includes(conditionKey as string) ) {
                     const conditionInfo = dentalChart.getCondition(conditionKey);
                     if (conditionInfo) {
                        problems.push(`- ${conditionInfo.label} on tooth #${tooth.id}, surface ${surface}`);
                     }
                }
            });
        });
    
        if (problems.length === 0) {
            planTextarea.value = "No immediate restorative needs detected based on the chart. Recommend routine prophylaxis and maintenance.";
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Plan';
            return;
        }
        
        planTextarea.value = "Generating AI-powered treatment plan...";
    
        try {
            const prompt = `You are a dental assistant AI. Based on the following list of diagnosed problems from a patient's dental chart, generate a prioritized, phased treatment plan. Be concise and professional.
            
    Diagnosed Problems:
    ${problems.join('\n')}
    
    Generate a treatment plan with phases (e.g., Phase 1: Urgent Care, Phase 2: Restorative, Phase 3: Maintenance).`;
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
    
            planTextarea.value = response.text;
        } catch (error) {
            console.error("AI plan generation failed:", error);
            planTextarea.value = "Error generating treatment plan. Please try again.";
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Plan';
        }
    });
    
    // --- Procedure Log Logic ---
    const procedureLogBody = document.getElementById('procedure-log-body') as HTMLTableSectionElement;

    function renderProcedureLog() {
        if (!procedureLogBody) return;
        procedureLogBody.innerHTML = '';

        if (!currentPatientData.procedureLog || currentPatientData.procedureLog.length === 0) {
            procedureLogBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 p-4">No procedures have been logged.</td></tr>';
            return;
        }

        currentPatientData.procedureLog.forEach((data: any, index: number) => {
            const row = procedureLogBody.insertRow();
            row.dataset.index = index.toString();
            row.innerHTML = `
                <td class="px-4 py-2"><input type="date" value="${data.date || ''}" data-prop="date" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.tooth || ''}" data-prop="tooth" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.code || ''}" data-prop="code" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.procedure || ''}" data-prop="procedure" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.clinician || ''}" data-prop="clinician" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.notes || ''}" data-prop="notes" class="w-full border-gray-300 shadow-sm text-sm"></td>
                <td class="px-4 py-2 text-center whitespace-nowrap">
                    <button class="generate-handout-btn text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600" title="Generate Patient Handout"><i class="fas fa-file-alt"></i> Handout</button>
                    ${!data.billed ? 
                        `<button class="bill-procedure-btn text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ml-2" title="Add to Billing"><i class="fas fa-dollar-sign"></i> Bill</button>` :
                        `<span class="text-xs text-green-600 font-semibold ml-2" title="This procedure has been added to the billing ledger."><i class="fas fa-check-circle"></i> Billed</span>`
                    }
                    <button class="remove-procedure-btn text-red-500 hover:text-red-700 ml-2"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }

    document.getElementById('add-procedure-btn')?.addEventListener('click', () => {
        currentPatientData.procedureLog.push({ date: new Date().toISOString().split('T')[0], tooth: '', code: '', procedure: '', clinician: '', notes: '', billed: false });
        renderProcedureLog();
    });

    if (procedureLogBody) {
        procedureLogBody.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const row = target.closest('tr');
            const prop = target.dataset.prop;
            if (row?.dataset.index && prop) {
                const index = parseInt(row.dataset.index, 10);
                currentPatientData.procedureLog[index][prop] = target.value;
            }
        });
    
        procedureLogBody.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (!button) return;
    
            const row = button.closest('tr');
            if (!row || !row.dataset.index) return;
            const index = parseInt(row.dataset.index, 10);
            const item = currentPatientData.procedureLog[index];
    
            if (button.classList.contains('remove-procedure-btn')) {
                showConfirm(`Are you sure you want to delete the logged procedure "${item.procedure}"?`, () => {
                    currentPatientData.procedureLog.splice(index, 1);
                    renderProcedureLog();
                });
            } else if (button.classList.contains('bill-procedure-btn')) {
                showBillProcedureModal(item, index);
            } else if (button.classList.contains('generate-handout-btn')) {
                generateAndShowHandout(`Handout for ${item.procedure}`, [item], false);
            }
        });
    }

    function showBillProcedureModal(item: any, index: number) {
        const modal = document.getElementById('billing-from-procedure-modal') as HTMLDivElement;
        const descriptionEl = document.getElementById('bill-proc-description') as HTMLParagraphElement;
        const feeInput = document.getElementById('bill-proc-fee') as HTMLInputElement;
        const indexInput = document.getElementById('bill-proc-index') as HTMLInputElement;
    
        if (!modal || !descriptionEl || !feeInput || !indexInput) return;
    
        descriptionEl.textContent = `${item.code} - ${item.procedure}`;
        feeInput.value = '';
        indexInput.value = index.toString();
    
        modal.classList.remove('hidden');
        feeInput.focus();
    }

    document.getElementById('save-billing-from-procedure-btn')?.addEventListener('click', () => {
        const feeInput = document.getElementById('bill-proc-fee') as HTMLInputElement;
        const indexInput = document.getElementById('bill-proc-index') as HTMLInputElement;
        const modal = document.getElementById('billing-from-procedure-modal') as HTMLDivElement;
    
        if (!feeInput || !indexInput || !modal) return;
        const index = parseInt(indexInput.value, 10);
        const fee = parseFloat(feeInput.value) || 0;
    
        if (isNaN(index) || fee <= 0) {
            showConfirm("Please enter a valid fee.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
    
        const item = currentPatientData.procedureLog[index];
        if (item) {
            currentPatientData.billingLog.push({
                date: item.date,
                code: item.code,
                description: item.procedure,
                charge: fee,
                credit: 0
            });
            item.billed = true;
    
            renderBillingLog();
            renderProcedureLog();
            modal.classList.add('hidden');
        }
    });

    document.getElementById('suggest-fee-btn')?.addEventListener('click', async () => {
        const indexInput = document.getElementById('bill-proc-index') as HTMLInputElement;
        const feeInput = document.getElementById('bill-proc-fee') as HTMLInputElement;
        const suggestBtn = document.getElementById('suggest-fee-btn') as HTMLButtonElement;
        
        if (!indexInput || !feeInput || !suggestBtn) return;
        const index = parseInt(indexInput.value, 10);
        if (isNaN(index)) return;
    
        const item = currentPatientData.procedureLog[index];
        if (!item || !item.procedure) return;
    
        suggestBtn.disabled = true;
        suggestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        feeInput.placeholder = 'AI is thinking...';
    
        try {
            const prompt = `You are a dental billing expert for a private practice in Johannesburg, South Africa.
    Based on the procedure with tariff code "${item.code}" and description "${item.procedure}", suggest a single, reasonable, average private practice fee in South African Rand (ZAR). Avoid specialist or high-end pricing.
    Return ONLY a single number representing the fee. For example: 850.50`;
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            
            const suggestedFee = parseFloat(response.text.replace(/[^0-9.]/g, ''));
            if (!isNaN(suggestedFee)) {
                feeInput.value = suggestedFee.toFixed(2);
            } else {
                feeInput.placeholder = 'Could not suggest fee';
            }
    
        } catch (error) {
            console.error("AI fee suggestion failed:", error);
            feeInput.placeholder = 'Error suggesting fee';
        } finally {
            suggestBtn.disabled = false;
            suggestBtn.innerHTML = '<i class="fas fa-magic"></i>';
        }
    });

    
    // --- Admin Log Logic ---
    const addConsentBtn = document.getElementById('add-consent-btn');
    const consentLogBody = document.getElementById('consent-log-body') as HTMLTableSectionElement;

    function renderConsentLog() {
        if (!consentLogBody) return;
        consentLogBody.innerHTML = '';
        if (!currentPatientData.consentLog || currentPatientData.consentLog.length === 0) {
            consentLogBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 p-4">No consent forms have been logged.</td></tr>';
            return;
        }

        currentPatientData.consentLog.forEach((data: any, index: number) => {
            const row = consentLogBody.insertRow();
            row.dataset.index = index.toString();
            row.innerHTML = `
                <td class="px-4 py-2"><input type="date" value="${data.date || ''}" data-prop="date" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2"><input type="text" value="${data.title || ''}" data-prop="title" class="w-full border-gray-300 rounded-md shadow-sm text-sm"></td>
                <td class="px-4 py-2">
                    <select class="w-full border-gray-300 rounded-md shadow-sm text-sm" data-prop="status">
                        <option ${ (data.status === 'Signed') ? 'selected' : '' }>Signed</option>
                        <option ${ (data.status === 'Pending') ? 'selected' : '' }>Pending</option>
                    </select>
                </td>
                <td class="px-4 py-2 text-center"><button class="remove-consent-btn text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
            `;
        });
    }
    
    if (consentLogBody) {
        consentLogBody.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement | HTMLSelectElement;
            const row = target.closest('tr');
            const prop = target.dataset.prop;
            if (row?.dataset.index && prop) {
                const index = parseInt(row.dataset.index, 10);
                currentPatientData.consentLog[index][prop] = target.value;
            }
        });
    
        consentLogBody.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.remove-consent-btn');
            if (button) {
                const row = button.closest('tr');
                if(row?.dataset.index) {
                    const index = parseInt(row.dataset.index, 10);
                    const item = currentPatientData.consentLog[index];
                     showConfirm(`Are you sure you want to delete the consent form "${item.title}"?`, () => {
                        currentPatientData.consentLog.splice(index, 1);
                        renderConsentLog();
                     });
                }
            }
        });
    }

    addConsentBtn?.addEventListener('click', () => {
        currentPatientData.consentLog.push({ date: new Date().toISOString().split('T')[0], title: '', status: 'Pending' });
        renderConsentLog();
    });

    // --- Billing Logic ---
    const billingLogBody = document.getElementById('billing-log-body') as HTMLTableSectionElement;
    const totalBalanceEl = document.getElementById('total-balance');

    function renderBillingLog() {
        if (!billingLogBody || !totalBalanceEl) return;
        billingLogBody.innerHTML = '';
        let runningBalance = 0;

        if (!currentPatientData.billingLog || currentPatientData.billingLog.length === 0) {
            billingLogBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 p-4">No billing items have been added.</td></tr>';
            totalBalanceEl.textContent = `R 0.00`;
            const hubBalanceEl = document.getElementById('hub-balance');
            if (hubBalanceEl) hubBalanceEl.textContent = `R 0.00`;
            return;
        }
        
        currentPatientData.billingLog.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        currentPatientData.billingLog.forEach((item: any, index: number) => {
            const charge = parseFloat(item.charge) || 0;
            const credit = parseFloat(item.credit) || 0;
            runningBalance += charge - credit;
    
            const row = billingLogBody.insertRow();
            row.dataset.index = index.toString();
            row.innerHTML = `
                <td class="px-2 py-1 text-sm">${item.date || ''}</td>
                <td class="px-2 py-1 text-sm">${item.code || ''}</td>
                <td class="px-2 py-1 text-sm">${item.description || ''}</td>
                <td class="px-2 py-1 text-right text-sm">${charge > 0 ? `R ${charge.toFixed(2)}` : ''}</td>
                <td class="px-2 py-1 text-right text-sm text-green-600">${credit > 0 ? `R ${credit.toFixed(2)}` : ''}</td>
                <td class="px-2 py-1 text-right font-medium text-sm">R ${runningBalance.toFixed(2)}</td>
                <td class="px-2 py-1 text-center"><button class="remove-billing-item-btn text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
            `;
        });
    
        totalBalanceEl.textContent = `R ${runningBalance.toFixed(2)}`;
        const hubBalanceEl = document.getElementById('hub-balance');
        if (hubBalanceEl) hubBalanceEl.textContent = `R ${runningBalance.toFixed(2)}`;
    }
    
    if (billingLogBody) {
        billingLogBody.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.remove-billing-item-btn');
            if (button) {
                const index = button.closest('tr')?.dataset.index;
                if (index) {
                    const item = currentPatientData.billingLog[parseInt(index, 10)];
                    showConfirm(`Are you sure you want to delete the billing item "${item.description}"?`, () => {
                        currentPatientData.billingLog.splice(parseInt(index), 1);
                        renderBillingLog();
                    });
                }
            }
        });
    }

    // Modal logic for adding a new charge (billing item)
    document.getElementById('add-billing-item-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('billing-item-modal') as HTMLDivElement;
        if (!modal) return;
        (document.getElementById('item-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
        (document.getElementById('item-code') as HTMLInputElement).value = '';
        (document.getElementById('item-description') as HTMLInputElement).value = '';
        (document.getElementById('item-fee') as HTMLInputElement).value = '';
        modal.classList.remove('hidden');
    });

    document.getElementById('save-billing-item-btn')?.addEventListener('click', () => {
        const newItem = {
            date: (document.getElementById('item-date') as HTMLInputElement).value,
            code: (document.getElementById('item-code') as HTMLInputElement).value,
            description: (document.getElementById('item-description') as HTMLInputElement).value,
            charge: parseFloat((document.getElementById('item-fee') as HTMLInputElement).value) || 0,
            credit: 0
        };
        currentPatientData.billingLog.push(newItem);
        renderBillingLog();
        const modal = document.getElementById('billing-item-modal') as HTMLDivElement;
        if (modal) modal.classList.add('hidden');
    });

    // Modal logic for recording a payment
    document.getElementById('record-payment-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('payment-modal') as HTMLDivElement;
        if (!modal) return;
        (document.getElementById('payment-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
        (document.getElementById('payment-amount') as HTMLInputElement).value = '';
        (document.getElementById('payment-method') as HTMLSelectElement).value = 'Credit Card';
        (document.getElementById('payment-notes') as HTMLTextAreaElement).value = '';
        modal.classList.remove('hidden');
    });

    document.getElementById('save-payment-btn')?.addEventListener('click', () => {
        const method = (document.getElementById('payment-method') as HTMLSelectElement).value;
        const notes = (document.getElementById('payment-notes') as HTMLTextAreaElement).value;
        const newPayment = {
            date: (document.getElementById('payment-date') as HTMLInputElement).value,
            code: '',
            description: `Payment - ${method}${notes ? ` (${notes})` : ''}`,
            charge: 0,
            credit: parseFloat((document.getElementById('payment-amount') as HTMLInputElement).value) || 0
        };
        currentPatientData.billingLog.push(newPayment);
        renderBillingLog();
        const modal = document.getElementById('payment-modal') as HTMLDivElement;
        if (modal) modal.classList.add('hidden');
    });
    
    document.getElementById('generate-statement-btn')?.addEventListener('click', () => {
        const statementModal = document.getElementById('statement-modal');
        const statementContent = document.getElementById('statement-content');
        const patientName = (document.getElementById('patient-name') as HTMLInputElement)?.value || 'N/A';
        const patientId = (document.getElementById('patient-id') as HTMLInputElement)?.value || 'N/A';
        
        if (!statementModal || !statementContent) return;

        let itemsHtml = '';
        let runningBalance = 0;
        currentPatientData.billingLog.forEach((item:any) => {
            const charge = parseFloat(item.charge) || 0;
            const credit = parseFloat(item.credit) || 0;
            runningBalance += charge - credit;
            itemsHtml += `
                <tr class="border-b">
                    <td class="py-2 px-4">${item.date}</td>
                    <td class="py-2 px-4">${item.code}</td>
                    <td class="py-2 px-4">${item.description}</td>
                    <td class="py-2 px-4 text-right">${charge > 0 ? `R ${charge.toFixed(2)}` : ''}</td>
                    <td class="py-2 px-4 text-right">${credit > 0 ? `R ${credit.toFixed(2)}` : ''}</td>
                    <td class="py-2 px-4 text-right">R ${runningBalance.toFixed(2)}</td>
                </tr>
            `;
        });

        statementContent.innerHTML = `
            <div class="p-8">
                <div class="flex justify-between items-center border-b pb-4 mb-4">
                    <div>
                        <h2 class="text-2xl font-bold">Statement of Account</h2>
                        <p>S&P Smiles Co.</p>
                        <p>123 Dental St, Smile City</p>
                    </div>
                    <div class="text-right">
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="mb-6">
                    <h3 class="font-bold">Patient:</h3>
                    <p>${patientName}</p>
                    <p>ID: ${patientId}</p>
                </div>
                <table class="w-full text-left">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="py-2 px-4">Date</th>
                            <th class="py-2 px-4">Code</th>
                            <th class="py-2 px-4">Description</th>
                            <th class="py-2 px-4 text-right">Charge</th>
                            <th class="py-2 px-4 text-right">Credit</th>
                            <th class="py-2 px-4 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot class="font-bold">
                        <tr>
                            <td colspan="5" class="py-2 px-4 text-right">Total Balance Due:</td>
                            <td class="py-2 px-4 text-right">${totalBalanceEl?.textContent}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        statementModal.classList.remove('hidden');
    });
    
     document.getElementById('generate-referral-btn')?.addEventListener('click', () => {
        const referralModal = document.getElementById('referral-modal');
        const referralDate = document.getElementById('referral-date');
        const referralPatientName = document.getElementById('referral-patient-name');
        const referralPatientDob = document.getElementById('referral-patient-dob');

        const patientNameVal = (document.getElementById('patient-name') as HTMLInputElement)?.value || '';
        const patientDobVal = (document.getElementById('patient-dob') as HTMLInputElement)?.value || '';

        if(referralDate) referralDate.textContent = new Date().toLocaleDateString();
        if(referralPatientName) referralPatientName.textContent = patientNameVal;
        if(referralPatientDob) referralPatientDob.textContent = patientDobVal;
        referralModal?.classList.remove('hidden');
    });

    document.getElementById('print-referral-btn')?.addEventListener('click', () => {
        const referralModal = document.getElementById('referral-modal');
        referralModal?.classList.add('print-this-modal');
        window.print();
        referralModal?.classList.remove('print-this-modal');
    });

    document.getElementById('print-statement-btn')?.addEventListener('click', () => {
        const statementModal = document.getElementById('statement-modal');
        statementModal?.classList.add('print-this-modal');
        window.print();
        statementModal?.classList.remove('print-this-modal');
    });


    // --- AI Clinical Scribe Logic ---
    let isScribing = false;
    let scribeTimeout: any = null;
    let finalTranscript = '';
    const aiLog = document.getElementById('ai-log');

    function updateAiLog(text: string, type = 'ai') {
        if (!aiLog) return;
        const placeholder = aiLog.querySelector('.placeholder-log');
        if (placeholder) placeholder.remove();
        
        const p = document.createElement('p');
        p.textContent = text;
        p.className = `${type}-log`;
        aiLog.appendChild(p);
        aiLog.scrollTop = aiLog.scrollHeight;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        const micBtn = document.getElementById('ai-mic-btn') as HTMLButtonElement;
        const micBtnText = document.getElementById('ai-mic-btn-text');

        recognition.continuous = true;
        recognition.interimResults = true;

        micBtn?.addEventListener('click', () => {
            if (isScribing) {
                recognition.stop();
            } else {
                finalTranscript = '';
                recognition.start();
            }
        });

        recognition.onstart = () => {
            isScribing = true;
            micBtn?.classList.add('listening', 'bg-red-500');
            micBtn?.classList.remove('bg-green-500');
            if (micBtnText) micBtnText.innerHTML = '<i class="fas fa-stop"></i> Stop Scribing';
            updateAiLog("Scribe activated. Listening...", "ai");
        };

        recognition.onend = async () => {
            isScribing = false;
            micBtn?.classList.remove('listening', 'bg-red-500');
            micBtn?.classList.add('bg-green-500');
            if (micBtnText) micBtnText.innerHTML = '<i class="fas fa-microphone"></i> Start Scribing';
            updateAiLog("Scribe deactivated.", "ai");

            const commandToParse = finalTranscript.trim();
            if (commandToParse.length > 0) {
                finalTranscript = '';
                await parseScribeCommand(commandToParse);
            }
        };

        recognition.onerror = (e: any) => {
            updateAiLog(`Error: ${e.error}. Please ensure microphone access is allowed.`, "ai-error");
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + '. ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (!aiLog) return;
            let interimEl = aiLog.querySelector('.interim-log');
            if (!interimEl) {
                interimEl = document.createElement('p');
                interimEl.className = 'interim-log';
                aiLog.appendChild(interimEl);
            }
            interimEl.textContent = interimTranscript;
            if (!interimTranscript) interimEl.remove();
            

            clearTimeout(scribeTimeout);
            scribeTimeout = setTimeout(async () => {
                const commandToParse = finalTranscript.trim();
                if (commandToParse.length > 0) {
                    finalTranscript = '';
                    const interimEl = aiLog?.querySelector('.interim-log');
                    if (interimEl) interimEl.remove();
                    updateAiLog(commandToParse, 'user');
                    await parseScribeCommand(commandToParse);
                }
            }, 1500);
        };
    } else {
        const micBtn = document.getElementById('ai-mic-btn') as HTMLButtonElement
        if (micBtn) micBtn.disabled = true;
        updateAiLog("Voice recognition not supported by your browser.", "ai-error");
    }
    
    async function parseScribeCommand(command: string) {
        updateAiLog("AI is processing your dictation...", "ai");
    
        const dentitionMode = dentalChart.dentitionMode;
        const allConditions = Object.values(dentalChart.conditions).flatMap((cat: any) => Object.keys(cat.items));
        const fdiPermanent = "11-18, 21-28, 31-38, 41-48";
        const fdiPrimary = "51-55, 61-65, 71-75, 81-85";
        const validTeeth = dentitionMode === 'permanent' ? fdiPermanent : fdiPrimary;
    
        try {
            const prompt = `You are an expert dental clinical scribe AI. Parse the following clinical dictation into a structured JSON object. 
The dictation is: "${command}". 
The current dentition mode is ${dentitionMode}, so valid tooth numbers are in the range ${validTeeth}.
Your task is to identify three types of information:
1.  **Charting Actions**: Specific conditions on specific teeth (e.g., "occlusal caries on tooth 16").
2.  **Periodontal Readings**: Pocket depths for specific teeth and surfaces (e.g., "buccal pockets on tooth 11 are 3, 2, 3").
3.  **Clinical Note**: A coherent summary of all other dictated information, formatted as a clinical note.

Return ONLY the JSON object.`;
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            chartingActions: {
                                type: Type.ARRAY,
                                description: "A list of dental charting actions.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        toothId: { type: Type.STRING, description: 'A single valid tooth number.' },
                                        condition: { type: Type.STRING, description: `The condition key. Must be one of: ${allConditions.join(', ')}` },
                                        surfaces: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of surfaces (M, O, D, I, B, L, P).' },
                                    }
                                }
                            },
                            perioActions: {
                                type: Type.ARRAY,
                                description: "A list of periodontal pocket depth readings.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        toothId: { type: Type.STRING, description: 'A single valid tooth number.' },
                                        surface: { type: Type.STRING, description: 'The surface aspect, either "b" for buccal or "l" for lingual/palatal.' },
                                        readings: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "An array of exactly three pocket depth numbers." },
                                    }
                                }
                            },
                            clinicalNote: {
                                type: Type.STRING,
                                description: "A narrative clinical note summarizing the non-charting parts of the dictation."
                            }
                        }
                    }
                }
            });
    
            const jsonString = response.text.trim();
            const actions = JSON.parse(jsonString);
            let actionsTaken = false;
    
            // Process Charting Actions
            if (actions.chartingActions && actions.chartingActions.length > 0) {
                actions.chartingActions.forEach((action: any) => {
                    if (dentalChart.teeth[action.toothId] && dentalChart.getCondition(action.condition)) {
                        const conditionInfo = dentalChart.getCondition(action.condition);
                        if (conditionInfo.type === 'whole') {
                            dentalChart.applyCondition(action.toothId, null, action.condition);
                        } else if (action.surfaces && action.surfaces.length > 0) {
                            action.surfaces.forEach((surface: string) => dentalChart.applyCondition(action.toothId, surface.toUpperCase(), action.condition));
                        }
                        updateAiLog(`Action: Marked ${action.condition} on tooth ${action.toothId}.`, 'ai-action');
                        actionsTaken = true;
                    }
                });
            }
    
            // Process Perio Actions
            if (actions.perioActions && actions.perioActions.length > 0) {
                actions.perioActions.forEach((action: any) => {
                    if (action.readings && action.readings.length === 3) {
                        for (let i = 0; i < 3; i++) {
                            const inputId = `perio-pd-${action.toothId}-${action.surface}${i + 1}`;
                            const inputEl = document.getElementById(inputId) as HTMLInputElement;
                            if (inputEl) {
                                inputEl.value = action.readings[i].toString();
                                inputEl.dispatchEvent(new Event('input', { bubbles: true })); // Trigger updates
                            }
                        }
                        updateAiLog(`Action: Logged perio for tooth ${action.toothId} (${action.surface}): ${action.readings.join(', ')}.`, 'ai-action');
                        actionsTaken = true;
                    }
                });
            }
    
            // Process Clinical Note
            if (actions.clinicalNote && actions.clinicalNote.trim().length > 0) {
                const notesTextarea = document.getElementById('treat-clinical-notes') as HTMLTextAreaElement;
                if (notesTextarea) {
                    notesTextarea.value += (notesTextarea.value ? '\n' : '') + actions.clinicalNote;
                    notesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                    updateAiLog(`Action: Appended to clinical notes.`, 'ai-action');
                    actionsTaken = true;
                }
            }
    
            if (!actionsTaken) {
                updateAiLog("No specific clinical actions were identified in your dictation.", "ai");
            }
    
        } catch (error) {
            console.error("AI Scribe command failed:", error);
            updateAiLog("Sorry, I had trouble parsing that. Please try rephrasing.", "ai-error");
        }
    }

    function calculateDMFT(manualOverride = false) {
        if (!dentalChart || !dentalChart.teeth) return;
    
        // Outreach view elements
        const dElOutreach = document.getElementById('dmft-d') as HTMLInputElement;
        const mElOutreach = document.getElementById('dmft-m') as HTMLInputElement;
        const fElOutreach = document.getElementById('dmft-f') as HTMLInputElement;
        const tElOutreach = document.getElementById('dmft-total-outreach') as HTMLParagraphElement;
    
        // Comprehensive view elements
        const dElComp = document.getElementById('score-d');
        const mElComp = document.getElementById('score-m');
        const fElComp = document.getElementById('score-f');
        const tElComp = document.getElementById('score-dmft');
    
        if (manualOverride) {
            if(dElOutreach) dElOutreach.classList.add('manual-override');
            if(mElOutreach) mElOutreach.classList.add('manual-override');
            if(fElOutreach) fElOutreach.classList.add('manual-override');
            const total = (parseInt(dElOutreach?.value || '0', 10)) + (parseInt(mElOutreach?.value || '0', 10)) + (parseInt(fElOutreach?.value || '0', 10));
            if(tElOutreach) tElOutreach.textContent = total.toString();
            // also update comprehensive view from manual outreach input
            if(dElComp) dElComp.textContent = dElOutreach.value;
            if(mElComp) mElComp.textContent = mElOutreach.value;
            if(fElComp) fElComp.textContent = fElOutreach.value;
            if(tElComp) tElComp.textContent = total.toString();
            return;
        }
        
        if(dElOutreach) dElOutreach.classList.remove('manual-override');
        if(mElOutreach) mElOutreach.classList.remove('manual-override');
        if(fElOutreach) fElOutreach.classList.remove('manual-override');
    
        let missing = 0;
        const decayedTeeth = new Set();
        const filledTeeth = new Set();
    
        for (const toothId in dentalChart.teeth) {
            const tooth = dentalChart.teeth[toothId];
            let isDecayed = false;
            let isFilled = false;
            
            if (tooth.wholeToothState?.condition === 'missing' || tooth.wholeToothState?.condition === 'to-be-extracted') {
                missing++;
                continue; 
            }
    
            if (tooth.wholeToothState?.condition === 'caries' || tooth.wholeToothState?.condition === 'root-fragment' || tooth.wholeToothState?.condition === 'fracture') {
                isDecayed = true;
            } else {
                for (const surface in tooth.surfaces) {
                    if (tooth.surfaces[surface].condition === 'caries') {
                        isDecayed = true;
                        break;
                    }
                }
            }
    
            if (isDecayed) {
                decayedTeeth.add(toothId);
            }
    
            // A tooth can be both filled and decayed. DMFT counts decayed first.
            if (!isDecayed) {
                if (tooth.wholeToothState?.condition === 'crown' || tooth.wholeToothState?.condition === 'rct') {
                    isFilled = true;
                } else {
                    for (const surface in tooth.surfaces) {
                        const cond = tooth.surfaces[surface].condition;
                        if (['amalgam', 'composite', 'glass-ionomer', 'gold', 'sealant'].includes(cond)) {
                            isFilled = true;
                            break;
                        }
                    }
                }
                if(isFilled) {
                    filledTeeth.add(toothId);
                }
            }
        }
        
        const decayed = decayedTeeth.size;
        const filled = filledTeeth.size;
        const total = decayed + missing + filled;
    
        if(dElOutreach) dElOutreach.value = decayed.toString();
        if(mElOutreach) mElOutreach.value = missing.toString();
        if(fElOutreach) fElOutreach.value = filled.toString();
        if(tElOutreach) tElOutreach.textContent = total.toString();
    
        if(dElComp) dElComp.textContent = decayed.toString();
        if(mElComp) mElComp.textContent = missing.toString();
        if(fElComp) fElComp.textContent = filled.toString();
        if(tElComp) tElComp.textContent = total.toString();
    }
    
    function updatePatientHub() {
        const nameEl = document.getElementById('hub-name');
        const idEl = document.getElementById('hub-id');
        const ageEl = document.getElementById('hub-age');
        const nextApptEl = document.getElementById('hub-appointment');
        const balanceEl = document.getElementById('hub-balance');
        const alertsEl = document.getElementById('hub-alerts');
        const outstandingTreatmentEl = document.getElementById('hub-outstanding-treatment');
        const recentActivityEl = document.getElementById('hub-recent-activity');
    
        if (!nameEl || !ageEl || !nextApptEl || !balanceEl || !alertsEl || !idEl || !outstandingTreatmentEl || !recentActivityEl) {
            return;
        }
    
        const patientName = currentPatientData.patientInfo['patient-name'] || 'No Patient Loaded';
        nameEl.textContent = patientName;
        document.title = `${patientName} - Dental Chart`;
    
        idEl.textContent = currentPatientData.patientInfo['patient-id'] || '-';
    
        const dob = currentPatientData.patientInfo['patient-dob'];
        if (dob) {
            try {
                const birthDate = new Date(dob);
                if (!isNaN(birthDate.getTime())) {
                    const ageDifMs = Date.now() - birthDate.getTime();
                    const ageDate = new Date(ageDifMs);
                    ageEl.textContent = `${Math.abs(ageDate.getUTCFullYear() - 1970)} years old`;
                } else {
                     ageEl.textContent = 'Invalid DOB';
                }
            } catch (e) {
                 ageEl.textContent = 'Invalid DOB';
            }
        } else {
            ageEl.textContent = 'DOB not set';
        }
    
        const today = new Date();
        today.setHours(0,0,0,0);
        const futureAppointments = (currentPatientData.appointmentLog || [])
            .filter((a: any) => new Date(a.date) >= today && a.status === 'Scheduled')
            .sort((a: any, b: any) => new Date(a.date + 'T' + a.startTime).getTime() - new Date(b.date + 'T' + b.startTime).getTime());
        
        if (futureAppointments.length > 0) {
            const nextAppt = futureAppointments[0];
            const apptDate = new Date(nextAppt.date + 'T' + nextAppt.startTime);
            nextApptEl.innerHTML = `<p class="text-gray-700">${apptDate.toLocaleDateString()} at ${apptDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${nextAppt.reason}</p>`;
        } else {
            nextApptEl.innerHTML = '<p class="text-gray-700">No upcoming appointments</p>';
        }
        
        let runningBalance = 0;
        if (currentPatientData.billingLog && currentPatientData.billingLog.length > 0) {
            currentPatientData.billingLog.forEach((item: any) => {
                const charge = parseFloat(item.charge) || 0;
                const credit = parseFloat(item.credit) || 0;
                runningBalance += charge - credit;
            });
        }
        balanceEl.textContent = `R ${runningBalance.toFixed(2)}`;
        
        const alerts: string[] = [];
        const conditions: {[key: string]: string} = {
            'cond-diabetes': 'Diabetes', 'cond-hypertension': 'Hypertension', 'cond-asthma': 'Asthma',
            'cond-epilepsy': 'Epilepsy', 'cond-heart': 'Heart Condition'
        };
        for (const key in conditions) {
            if (currentPatientData.patientInfo[key]) alerts.push(conditions[key]);
        }
        if (currentPatientData.patientInfo['history-systemic-other']) alerts.push(currentPatientData.patientInfo['history-systemic-other']);
        if (currentPatientData.patientInfo['history-anxiety']) alerts.push('Dental Anxiety');
        
        if (alerts.length > 0) {
            alertsEl.innerHTML = alerts.map(alert => `<li>${alert}</li>`).join('');
        } else {
            alertsEl.innerHTML = '<li>No significant medical conditions reported.</li>';
        }

        if (currentPatientData.treatmentPlan && currentPatientData.treatmentPlan.length > 0) {
            outstandingTreatmentEl.innerHTML = currentPatientData.treatmentPlan
                .slice(0, 3) // show top 3
                .map((item: any) => `<li>${item.procedure} on tooth ${item.tooth}</li>`)
                .join('');
        } else {
            outstandingTreatmentEl.innerHTML = '<li>None</li>';
        }

        if (currentPatientData.procedureLog && currentPatientData.procedureLog.length > 0) {
            const recentProcedures = [...currentPatientData.procedureLog].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            recentActivityEl.innerHTML = recentProcedures
                .slice(0, 3) // show top 3 recent
                .map((item: any) => `<li>${item.date}: ${item.procedure}</li>`)
                .join('');
        } else {
            recentActivityEl.innerHTML = '<li>No procedures logged.</li>';
        }
    }

    function updatePracticeDashboard() {
        const revenueCanvas = document.getElementById('revenue-chart-canvas') as HTMLCanvasElement;
        const procedureCanvas = document.getElementById('procedure-chart-canvas') as HTMLCanvasElement;
        const totalPatientsEl = document.getElementById('kpi-total-patients');
        const totalRevenueEl = document.getElementById('kpi-total-revenue');
        const avgRevenueEl = document.getElementById('kpi-avg-revenue');
        const noShowRateEl = document.getElementById('kpi-no-show-rate');
        const procedurePlaceholder = document.getElementById('procedure-chart-placeholder');
    
        if (!revenueCanvas || !procedureCanvas || !totalPatientsEl || !totalRevenueEl || !avgRevenueEl || !noShowRateEl || !procedurePlaceholder) return;
    
        let allPatientsData: any[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('dentalPatientData-')) {
                try {
                    allPatientsData.push(JSON.parse(localStorage.getItem(key)!));
                } catch(e) { console.error(`Failed to parse patient data for key ${key}`, e); }
            }
        }
    
        totalPatientsEl.textContent = allPatientsData.length.toString();
    
        let totalRevenue = 0;
        let noShowAppointments = 0;
        let totalAppointments = 0;
        const procedureCounts: { [key: string]: number } = {};
    
        allPatientsData.forEach(patient => {
            if (patient.billingLog) patient.billingLog.forEach((item: any) => { totalRevenue += parseFloat(item.charge) || 0; });
            if (patient.appointmentLog) {
                patient.appointmentLog.forEach((appt: any) => { 
                    totalAppointments++;
                    if (appt.status === 'No-Show') noShowAppointments++;
                });
            }
            if (patient.procedureLog) patient.procedureLog.forEach((proc: any) => {
                const procName = proc.procedure.split(' - ')[0]; 
                procedureCounts[procName] = (procedureCounts[procName] || 0) + 1;
            });
        });
    
        totalRevenueEl.textContent = `R ${totalRevenue.toFixed(2)}`;
        
        const avgRevenue = allPatientsData.length > 0 ? totalRevenue / allPatientsData.length : 0;
        avgRevenueEl.textContent = `R ${avgRevenue.toFixed(2)}`;
    
        const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;
        noShowRateEl.textContent = `${noShowRate.toFixed(0)}%`;
    
        const revenueData: { [key: string]: number } = {};
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
        allPatientsData.forEach(patient => {
            if (patient.billingLog) patient.billingLog.forEach((item: any) => {
                if(!item.date) return;
                const itemDate = new Date(item.date);
                if (itemDate >= sixMonthsAgo) {
                    const month = itemDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                    revenueData[month] = (revenueData[month] || 0) + (parseFloat(item.charge) || 0);
                }
            });
        });
        
        const sortedRevenueMonths = Object.keys(revenueData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const revenueLabels = sortedRevenueMonths;
        const revenueValues = sortedRevenueMonths.map(month => revenueData[month]);
    
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(revenueCanvas, {
            type: 'line',
            data: { labels: revenueLabels, datasets: [{ label: 'Monthly Revenue', data: revenueValues, backgroundColor: 'rgba(54, 162, 235, 0.2)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, tension: 0.2 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    
        const sortedProcedures = Object.entries(procedureCounts).sort(([,a],[,b]) => b-a).slice(0, 10);
        
        if (sortedProcedures.length === 0) {
            procedureCanvas.classList.add('hidden');
            procedurePlaceholder.classList.remove('hidden');
        } else {
            procedureCanvas.classList.remove('hidden');
            procedurePlaceholder.classList.add('hidden');
            const procedureLabels = sortedProcedures.map(p => p[0]);
            const procedureValues = sortedProcedures.map(p => p[1]);
        
            if (procedureChart) procedureChart.destroy();
            procedureChart = new Chart(procedureCanvas, {
                type: 'bar',
                data: { labels: procedureLabels, datasets: [{ label: 'Top 10 Procedures', data: procedureValues, backgroundColor: 'rgba(75, 192, 192, 0.2)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }] },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
            });
        }
    }

    // --- AI Procedure & Code Suggestion Logic ---
    function hideSuggestionPopup() {
        if (suggestionPopup) {
            suggestionPopup.classList.add('hidden');
        }
        activeSuggestionInput = null;
    }

    function positionSuggestionPopup(targetInput: HTMLInputElement) {
        if (!suggestionPopup) return;
        const rect = targetInput.getBoundingClientRect();
        suggestionPopup.style.left = `${rect.left}px`;
        suggestionPopup.style.top = `${rect.bottom + window.scrollY}px`;
        suggestionPopup.style.width = `${rect.width}px`;
        suggestionPopup.classList.remove('hidden');
    }

    async function getAiProcedureSuggestions(inputText: string, toothContext: string | null) {
        const problems: string[] = [];
        Object.values(dentalChart.teeth).forEach((tooth: any) => {
            if (tooth.wholeToothState?.condition && tooth.wholeToothState.condition !== 'none' && !['missing', 'implant'].includes(tooth.wholeToothState.condition)) {
                const condition = dentalChart.getCondition(tooth.wholeToothState.condition);
                if (condition) problems.push(`${condition.label} on tooth #${tooth.id}`);
            }
            Object.entries(tooth.surfaces).forEach(([surface, surfaceData]: [string, any]) => {
                const conditionKey = surfaceData.condition;
                if (conditionKey !== 'sound' && !['amalgam', 'composite', 'glass-ionomer', 'gold', 'sealant'].includes(conditionKey)) {
                     const conditionInfo = dentalChart.getCondition(conditionKey);
                     if (conditionInfo) problems.push(`${conditionInfo.label} on tooth #${tooth.id}, surface ${surface}`);
                }
            });
        });

        const prompt = `You are a dental procedure suggestion AI. A user is typing a procedure for a patient with these clinical findings:
    - ${problems.join('\n- ') || 'No specific findings charted.'}
    ${toothContext ? `The user is focused on tooth/area: ${toothContext}.` : ''}
    The user has typed: "${inputText}".
    Suggest up to 5 common, relevant procedure names that are related to the user's input and the clinical findings.
    Return a valid JSON array of strings. For example: ["Composite Restoration - 2 Surf Posterior", "Amalgam Restoration - 1 Surf"]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        return JSON.parse(response.text);
    }
    
    async function getAiCodeSuggestions(procedureText: string) {
        if (!procedureText) return [];
        const prompt = `You are a dental coding AI for South Africa. A user has entered the procedure: "${procedureText}".
    Suggest up to 5 relevant South African dental tariff codes.
    Return a valid JSON array of objects, each with a "code" and "description" key.
    Example: [{"code": "8349", "description": "Composite filling - 1 surface (posterior)"}]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            code: { type: Type.STRING },
                            description: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text);
    }


    function renderSuggestions(suggestions: any[], targetInput: HTMLInputElement) {
        if (!suggestionPopup || suggestions.length === 0) {
            hideSuggestionPopup();
            return;
        }

        suggestionPopup.innerHTML = '';
        const isCodeSuggestion = typeof suggestions[0] === 'object';
        const row = targetInput.closest('tr') || targetInput.closest('.grid') || targetInput.closest('.space-y-4');

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'block w-full text-left px-3 py-2 text-sm hover:bg-gray-100';
            
            if (isCodeSuggestion) {
                btn.innerHTML = `<span class="font-semibold">${suggestion.code}</span> - ${suggestion.description}`;
                btn.onclick = () => {
                    targetInput.value = suggestion.code;
                    if(row) {
                        const procInput = row.querySelector('input[data-prop="procedure"], #item-description, #plan-procedure-input') as HTMLInputElement;
                        if(procInput) procInput.value = suggestion.description;
                    }
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    hideSuggestionPopup();
                    targetInput.focus();
                };
            } else {
                 btn.textContent = suggestion;
                 btn.onclick = () => {
                    targetInput.value = suggestion;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    hideSuggestionPopup();
                    targetInput.focus();
                };
            }
            suggestionPopup.appendChild(btn);
        });

        positionSuggestionPopup(targetInput);
    }

    async function handleProcedureInput(e: Event) {
        const input = e.target as HTMLInputElement;
        
        if (input.value.length < 3) {
            hideSuggestionPopup();
            return;
        }

        activeSuggestionInput = input;
        clearTimeout(suggestionDebounceTimeout);

        suggestionDebounceTimeout = setTimeout(async () => {
            if (activeSuggestionInput !== input || input.value.length < 3) return;
            if (!suggestionPopup) return;

            positionSuggestionPopup(input);
            suggestionPopup.innerHTML = `<div class="p-2 text-sm text-gray-500"><i><i class="fas fa-spinner fa-spin mr-2"></i>Getting AI suggestions...</i></div>`;
            
            const row = input.closest('tr') || input.closest('.grid');
            let toothContext = null;
            if (row) {
                const toothInput = row.querySelector('input[data-prop="tooth"], #plan-tooth-input') as HTMLInputElement;
                if(toothInput) toothContext = toothInput.value.trim();
            }
            
            try {
                const suggestions = await getAiProcedureSuggestions(input.value, toothContext);
                if (activeSuggestionInput === input) {
                    renderSuggestions(suggestions, input);
                }
            } catch (error) {
                console.error("AI Suggestion Failed:", error);
                if (activeSuggestionInput === input && suggestionPopup) {
                    suggestionPopup.innerHTML = `<div class="p-2 text-sm text-red-500">Error loading suggestions.</div>`;
                    positionSuggestionPopup(input);
                }
            }
        }, 700);
    }

    async function handleCodeInput(e: Event) {
        const input = e.target as HTMLInputElement;
        activeSuggestionInput = input;
        if (!suggestionPopup) return;
        
        positionSuggestionPopup(input);
        suggestionPopup.innerHTML = `<div class="p-2 text-sm text-gray-500"><i><i class="fas fa-spinner fa-spin mr-2"></i>Getting AI suggestions...</i></div>`;

        const row = input.closest('tr') || input.closest('.grid') || input.closest('.space-y-4');
        let procedureContext = '';
        if(row){
             const procInput = row.querySelector('input[data-prop="procedure"], #plan-procedure-input, #item-description') as HTMLInputElement;
             if(procInput) procedureContext = procInput.value.trim();
        }

        if(!procedureContext) {
            hideSuggestionPopup();
            return;
        }

        try {
            const suggestions = await getAiCodeSuggestions(procedureContext);
            if (activeSuggestionInput === input) {
                renderSuggestions(suggestions, input);
            }
        } catch (error) {
            console.error("AI Code Suggestion Failed:", error);
             if (activeSuggestionInput === input && suggestionPopup) {
                suggestionPopup.innerHTML = `<div class="p-2 text-sm text-red-500">Error loading suggestions.</div>`;
                positionSuggestionPopup(input);
            }
        }
    }

    // --- Scheduler Logic ---
    function updateViewButtons() {
        document.getElementById('day-view-btn')?.classList.toggle('active', currentSchedulerView === 'day');
        document.getElementById('week-view-btn')?.classList.toggle('active', currentSchedulerView === 'week');
        document.getElementById('month-view-btn')?.classList.toggle('active', currentSchedulerView === 'month');
    }

    function renderMonthView(date: Date) {
        const calendarContainer = document.getElementById('calendar-container');
        if (!calendarContainer) return;

        calendarContainer.innerHTML = '';
        const monthGrid = document.createElement('div');
        monthGrid.id = 'month-view-grid';
        
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'month-day-header text-center font-semibold p-2 bg-gray-100';
            headerCell.textContent = day;
            monthGrid.appendChild(headerCell);
        });

        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();

        for (let i = 0; i < startDayOfWeek; i++) {
            const cell = document.createElement('div');
            cell.className = 'month-day-cell other-month';
            monthGrid.appendChild(cell);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'month-day-cell';
            const cellDate = new Date(year, month, day);
            if (cellDate.getTime() === today.getTime()) {
                cell.classList.add('today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'month-day-number';
            dayNumber.textContent = day.toString();
            cell.appendChild(dayNumber);
            
            const cellDateString = cellDate.toISOString().split('T')[0];
            const appointmentsForDay = currentPatientData.appointmentLog.filter((a: any) => a.date === cellDateString);

            if (appointmentsForDay.length > 0) {
                const apptList = document.createElement('ul');
                apptList.className = 'month-appt-list';
                appointmentsForDay.slice(0, 2).forEach((appt: any) => {
                    const li = document.createElement('li');
                    li.textContent = `${appt.startTime} ${appt.reason}`;
                    li.className = `month-appointment-dot status-${appt.status.replace(/ /g, '-')}`;
                    li.dataset.id = appt.id;
                    apptList.appendChild(li);
                });
                if (appointmentsForDay.length > 2) {
                     const li = document.createElement('li');
                    li.textContent = `+${appointmentsForDay.length - 2} more`;
                    li.className = 'month-appt-more text-xs';
                    apptList.appendChild(li);
                }
                cell.appendChild(apptList);
            }

            cell.addEventListener('click', () => {
                currentSchedulerView = 'day';
                currentSchedulerDate = cellDate;
                renderScheduler();
            });
            monthGrid.appendChild(cell);
        }
        
        calendarContainer.appendChild(monthGrid);
    }
    
    function showAppointmentModal(appointmentId: string | null = null, date: string | null = null, startTime: string | null = null) {
        const modal = document.getElementById('appointment-modal') as HTMLDivElement;
        if (!modal) return;
        
        const titleEl = document.getElementById('appointment-modal-title') as HTMLElement;
        const idInput = document.getElementById('appointment-id') as HTMLInputElement;
        const reasonInput = document.getElementById('appointment-reason') as HTMLInputElement;
        const notesTextarea = document.getElementById('appointment-notes') as HTMLTextAreaElement;
        const durationSelect = document.getElementById('appointment-duration') as HTMLSelectElement;
        const statusSelect = document.getElementById('appointment-status') as HTMLSelectElement;
        const deleteBtn = document.getElementById('delete-appointment-btn') as HTMLButtonElement;
        const patientInput = document.getElementById('appointment-patient') as HTMLInputElement;
        const dateInput = document.getElementById('appointment-date') as HTMLInputElement;
        const startTimeInput = document.getElementById('appointment-start-time') as HTMLInputElement;


        if(titleEl) titleEl.textContent = appointmentId ? 'Edit Appointment' : 'New Appointment';
        if(idInput) idInput.value = '';
        if(reasonInput) reasonInput.value = '';
        if(notesTextarea) notesTextarea.value = '';
        if(durationSelect) durationSelect.value = '60';
        if(statusSelect) statusSelect.value = 'Scheduled';
        if(deleteBtn) deleteBtn.classList.add('hidden');
        if(patientInput) patientInput.value = currentPatientData.patientInfo['patient-name'] || 'Current Patient';

        if (appointmentId) {
            const appointment = currentPatientData.appointmentLog.find((a: any) => a.id === appointmentId);
            if (appointment) {
                if(idInput) idInput.value = appointment.id;
                if(dateInput) dateInput.value = appointment.date;
                if(startTimeInput) startTimeInput.value = appointment.startTime;
                if(durationSelect) durationSelect.value = appointment.duration;
                if(reasonInput) reasonInput.value = appointment.reason;
                if(notesTextarea) notesTextarea.value = appointment.notes;
                if(statusSelect) statusSelect.value = appointment.status;
                if(deleteBtn) deleteBtn.classList.remove('hidden');
            }
        } else {
            if(dateInput) dateInput.value = date || new Date().toISOString().split('T')[0];
            if (startTimeInput) {
                 startTimeInput.value = startTime || '09:00';
            }
        }
        modal.classList.remove('hidden');
    }

    document.getElementById('save-appointment-btn')?.addEventListener('click', () => {
        const id = (document.getElementById('appointment-id') as HTMLInputElement).value;
        const appointmentData = {
            id: id || `appt-${Date.now()}`,
            date: (document.getElementById('appointment-date') as HTMLInputElement).value,
            startTime: (document.getElementById('appointment-start-time') as HTMLInputElement).value,
            duration: (document.getElementById('appointment-duration') as HTMLInputElement).value || '30',
            reason: (document.getElementById('appointment-reason') as HTMLInputElement).value,
            notes: (document.getElementById('appointment-notes') as HTMLTextAreaElement).value,
            status: (document.getElementById('appointment-status') as HTMLSelectElement).value,
        };

        if (!appointmentData.date || !appointmentData.startTime || !appointmentData.reason) {
            showConfirm("Please fill in the date, start time, and reason for the appointment.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }

        if (id) {
            const index = currentPatientData.appointmentLog.findIndex((a: any) => a.id === id);
            if (index > -1) {
                currentPatientData.appointmentLog[index] = appointmentData;
            }
        } else {
            currentPatientData.appointmentLog.push(appointmentData);
        }
        
        renderScheduler();
        updatePatientHub();
        (document.getElementById('appointment-modal') as HTMLDivElement)?.classList.add('hidden');
    });

    document.getElementById('delete-appointment-btn')?.addEventListener('click', () => {
        const id = (document.getElementById('appointment-id') as HTMLInputElement).value;
        if (id) {
            showConfirm("Are you sure you want to delete this appointment?", () => {
                const index = currentPatientData.appointmentLog.findIndex((a: any) => a.id === id);
                if (index > -1) {
                    currentPatientData.appointmentLog.splice(index, 1);
                }
                renderScheduler();
                updatePatientHub();
                (document.getElementById('appointment-modal') as HTMLDivElement)?.classList.add('hidden');
            });
        }
    });

    document.getElementById('prev-period-btn')?.addEventListener('click', () => {
        if (currentSchedulerView === 'day') currentSchedulerDate.setDate(currentSchedulerDate.getDate() - 1);
        else if (currentSchedulerView === 'week') currentSchedulerDate.setDate(currentSchedulerDate.getDate() - 7);
        else currentSchedulerDate.setMonth(currentSchedulerDate.getMonth() - 1);
        renderScheduler();
    });

    document.getElementById('next-period-btn')?.addEventListener('click', () => {
        if (currentSchedulerView === 'day') currentSchedulerDate.setDate(currentSchedulerDate.getDate() + 1);
        else if (currentSchedulerView === 'week') currentSchedulerDate.setDate(currentSchedulerDate.getDate() + 7);
        else currentSchedulerDate.setMonth(currentSchedulerDate.getMonth() + 1);
        renderScheduler();
    });
    
    document.getElementById('today-btn')?.addEventListener('click', () => {
        currentSchedulerDate = new Date();
        renderScheduler();
    });

    document.getElementById('day-view-btn')?.addEventListener('click', () => {
        currentSchedulerView = 'day';
        renderScheduler();
    });

    document.getElementById('week-view-btn')?.addEventListener('click', () => {
        currentSchedulerView = 'week';
        renderScheduler();
    });

    document.getElementById('month-view-btn')?.addEventListener('click', () => {
        currentSchedulerView = 'month';
        renderScheduler();
    });

    function renderScheduler() {
        const schedulerDate = document.getElementById('scheduler-date');
        if (!schedulerDate) return;

        updateViewButtons();

        switch (currentSchedulerView) {
            case 'day':
                schedulerDate.textContent = currentSchedulerDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                renderDayView(currentSchedulerDate);
                break;
            case 'week':
                const startOfWeek = new Date(currentSchedulerDate);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                schedulerDate.textContent = `${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                renderWeekView(currentSchedulerDate);
                break;
            case 'month':
                schedulerDate.textContent = currentSchedulerDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                renderMonthView(currentSchedulerDate);
                break;
        }
    }

    function renderDayView(date: Date) {
        const calendarContainer = document.getElementById('calendar-container');
        if (!calendarContainer) return;

        calendarContainer.innerHTML = `<div id="day-view-grid"><div id="time-column"></div><div id="calendar-column" class="day-column"></div></div>`;
        const timeColumn = document.getElementById('time-column');
        const calendarColumn = document.getElementById('calendar-column');
        if (!timeColumn || !calendarColumn) return;

        const startHour = 8;
        const endHour = 17;
        const totalSlots = (endHour - startHour) * 4; // 15-minute slots

        for (let i = 0; i < totalSlots; i++) {
            const hour = startHour + Math.floor(i / 4);
            const minute = (i % 4) * 15;
            
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            if (minute === 0) {
                timeSlot.textContent = `${hour}:00`;
            }
            timeColumn.appendChild(timeSlot);

            const calendarSlot = document.createElement('div');
            calendarSlot.className = 'calendar-slot';
            calendarSlot.dataset.time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            calendarSlot.addEventListener('click', () => showAppointmentModal(null, date.toISOString().split('T')[0], calendarSlot.dataset.time));
            calendarColumn.appendChild(calendarSlot);
        }

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayString = dayStart.toISOString().split('T')[0];
        
        currentPatientData.appointmentLog
            .filter((appt: any) => appt.date === dayString)
            .forEach((appt: any) => {
                const [hour, minute] = appt.startTime.split(':').map(Number);
                const startMinutes = (hour * 60) + minute;
                const topOffset = ((startMinutes - (startHour * 60)) / 15) * 15; // 15px per slot
                const height = (parseInt(appt.duration, 10) / 15) * 15;

                const apptBlock = document.createElement('div');
                apptBlock.className = `appointment-block status-${appt.status.replace(/ /g, '-')}`;
                apptBlock.style.top = `${topOffset}px`;
                apptBlock.style.height = `${height}px`;
                apptBlock.innerHTML = `
                    <p class="font-bold">${(document.getElementById('patient-name') as HTMLInputElement).value || 'Patient'}</p>
                    <p>${appt.reason}</p>
                    ${appt.notes ? '<i class="fas fa-file-alt appointment-note-icon"></i>' : ''}
                `;
                apptBlock.dataset.id = appt.id;
                apptBlock.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showAppointmentModal(appt.id);
                });
                calendarColumn.appendChild(apptBlock);
            });
    }

    function renderWeekView(date: Date) {
        const calendarContainer = document.getElementById('calendar-container');
        if (!calendarContainer) return;

        calendarContainer.innerHTML = `<div id="week-view-grid"><div id="time-column"></div></div>`;
        const weekGrid = document.getElementById('week-view-grid');
        const timeColumn = document.getElementById('time-column');
        if (!timeColumn || !weekGrid) return;

        const startHour = 8;
        const endHour = 17;
        const totalSlots = (endHour - startHour) * 4;

        for (let i = 0; i < totalSlots; i++) {
            const hour = startHour + Math.floor(i / 4);
            const minute = (i % 4) * 15;
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            if (minute === 0) {
                timeSlot.textContent = `${hour}:00`;
            }
            timeColumn.appendChild(timeSlot);
        }

        const startOfWeek = new Date(date);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + day);
            const dayString = currentDate.toISOString().split('T')[0];

            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column week-day-column';
            dayColumn.dataset.date = dayString;

            const header = document.createElement('div');
            header.className = 'week-day-header';
            header.textContent = currentDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            dayColumn.appendChild(header);

            for (let i = 0; i < totalSlots; i++) {
                 const hour = startHour + Math.floor(i / 4);
                 const minute = (i % 4) * 15;
                 const calendarSlot = document.createElement('div');
                 calendarSlot.className = 'calendar-slot';
                 calendarSlot.dataset.time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                 calendarSlot.addEventListener('click', () => showAppointmentModal(null, dayString, calendarSlot.dataset.time));
                 dayColumn.appendChild(calendarSlot);
            }
            
            currentPatientData.appointmentLog
                .filter((appt: any) => appt.date === dayString)
                .forEach((appt: any) => {
                    const [hour, minute] = appt.startTime.split(':').map(Number);
                    const startMinutes = (hour * 60) + minute;
                    const topOffset = ((startMinutes - (startHour * 60)) / 15) * 15 + 30; // 30px header offset
                    const height = (parseInt(appt.duration, 10) / 15) * 15;

                    const apptBlock = document.createElement('div');
                    apptBlock.className = `appointment-block status-${appt.status.replace(/ /g, '-')}`;
                    apptBlock.style.top = `${topOffset}px`;
                    apptBlock.style.height = `${height}px`;
                    apptBlock.innerHTML = `
                        <p class="font-bold text-xs">${(document.getElementById('patient-name') as HTMLInputElement).value || 'Patient'}</p>
                        <p class="text-xs">${appt.reason}</p>
                         ${appt.notes ? '<i class="fas fa-file-alt appointment-note-icon"></i>' : ''}
                    `;
                    apptBlock.dataset.id = appt.id;
                    apptBlock.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showAppointmentModal(appt.id);
                    });
                    dayColumn.appendChild(apptBlock);
                });


            weekGrid.appendChild(dayColumn);
        }
    }

// Fix: Add inventory management functionality, including the missing renderInventory function.
    // --- Inventory Management Logic ---
    function loadInventoryData() {
        const dataJSON = localStorage.getItem('dentalInventoryData');
        if (dataJSON) {
            inventoryData = JSON.parse(dataJSON);
        } else {
            // Some default data if none exists
            inventoryData = [
                { id: `inv-${Date.now()}-1`, name: 'Composite Resin A2', category: 'Restorative', quantity: 20, lowStockThreshold: 5, supplier: 'Dental Supplies Inc.' },
                { id: `inv-${Date.now()}-2`, name: 'Local Anesthetic Cartridges', category: 'Anesthetics', quantity: 85, lowStockThreshold: 20, supplier: 'Pharma Co.' },
            ];
        }
    }

    function saveInventoryData() {
        localStorage.setItem('dentalInventoryData', JSON.stringify(inventoryData));
    }

    function renderInventory() {
        const inventoryTableBody = document.getElementById('inventory-table-body') as HTMLTableSectionElement;
        if (!inventoryTableBody) return;

        inventoryTableBody.innerHTML = '';
        if (inventoryData.length === 0) {
            inventoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 p-4">No inventory items found. Add one to get started.</td></tr>';
            return;
        }

        inventoryData.sort((a, b) => a.name.localeCompare(b.name));

        inventoryData.forEach((item) => {
            const row = inventoryTableBody.insertRow();
            row.dataset.id = item.id;
            const isLowStock = item.quantity <= item.lowStockThreshold;
            row.className = isLowStock ? 'bg-yellow-100' : '';

            row.innerHTML = `
                <td class="px-4 py-2 text-sm font-medium">${item.name}</td>
                <td class="px-4 py-2 text-sm">${item.category || 'N/A'}</td>
                <td class="px-4 py-2 text-sm text-center">${item.quantity}</td>
                <td class="px-4 py-2 text-sm text-center">${item.lowStockThreshold}</td>
                <td class="px-4 py-2 text-sm">${item.supplier || 'N/A'}</td>
                <td class="px-4 py-2 text-center whitespace-nowrap">
                    <button class="edit-inventory-item-btn text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" title="Edit Item"><i class="fas fa-edit"></i> Edit</button>
                    <button class="remove-inventory-item-btn text-red-500 hover:text-red-700 ml-2"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }

    function showInventoryModal(itemId: string | null = null) {
        const modal = document.getElementById('inventory-item-modal') as HTMLDivElement;
        if (!modal) return;
        
        const titleEl = document.getElementById('inventory-modal-title') as HTMLElement;
        const idInput = document.getElementById('inventory-item-id') as HTMLInputElement;
        const nameInput = document.getElementById('inventory-item-name') as HTMLInputElement;
        const categoryInput = document.getElementById('inventory-item-category') as HTMLInputElement;
        const quantityInput = document.getElementById('inventory-item-quantity') as HTMLInputElement;
        const thresholdInput = document.getElementById('inventory-item-threshold') as HTMLInputElement;
        const supplierInput = document.getElementById('inventory-item-supplier') as HTMLInputElement;

        if (!titleEl || !idInput || !nameInput || !categoryInput || !quantityInput || !thresholdInput || !supplierInput) return;

        titleEl.textContent = itemId ? 'Edit Inventory Item' : 'New Inventory Item';
        idInput.value = '';
        nameInput.value = '';
        categoryInput.value = '';
        quantityInput.value = '';
        thresholdInput.value = '';
        supplierInput.value = '';

        if (itemId) {
            const item = inventoryData.find(i => i.id === itemId);
            if (item) {
                idInput.value = item.id;
                nameInput.value = item.name;
                categoryInput.value = item.category || '';
                quantityInput.value = item.quantity.toString();
                thresholdInput.value = item.lowStockThreshold.toString();
                supplierInput.value = item.supplier || '';
            }
        }
        modal.classList.remove('hidden');
    }

    document.getElementById('add-inventory-item-btn')?.addEventListener('click', () => {
        showInventoryModal(null);
    });

    document.getElementById('save-inventory-item-btn')?.addEventListener('click', () => {
        const id = (document.getElementById('inventory-item-id') as HTMLInputElement).value;
        const name = (document.getElementById('inventory-item-name') as HTMLInputElement).value;
        const quantity = parseInt((document.getElementById('inventory-item-quantity') as HTMLInputElement).value, 10);
        const lowStockThreshold = parseInt((document.getElementById('inventory-item-threshold') as HTMLInputElement).value, 10);

        if (!name || isNaN(quantity) || isNaN(lowStockThreshold)) {
            showConfirm("Please fill in at least Name, Quantity, and Low Stock Threshold with valid numbers.", () => {});
            const confirmBtn = document.getElementById('modal-confirm') as HTMLButtonElement;
            if (confirmBtn) confirmBtn.classList.add('hidden');
            return;
        }
        
        const itemData = {
            id: id || `inv-${Date.now()}`,
            name: name,
            category: (document.getElementById('inventory-item-category') as HTMLInputElement).value,
            quantity: quantity,
            lowStockThreshold: lowStockThreshold,
            supplier: (document.getElementById('inventory-item-supplier') as HTMLInputElement).value,
        };

        if (id) {
            const index = inventoryData.findIndex(i => i.id === id);
            if (index > -1) {
                inventoryData[index] = itemData;
            }
        } else {
            inventoryData.push(itemData);
        }
        
        saveInventoryData();
        renderInventory();
        (document.getElementById('inventory-item-modal') as HTMLDivElement)?.classList.add('hidden');
    });

    const inventoryTableBody = document.getElementById('inventory-table-body');
    if(inventoryTableBody) {
        inventoryTableBody.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (!button) return;
            
            const row = button.closest('tr');
            if (!row || !row.dataset.id) return;
            const itemId = row.dataset.id;
            const item = inventoryData.find(i => i.id === itemId);

            if (button.classList.contains('edit-inventory-item-btn')) {
                showInventoryModal(itemId);
            } else if (button.classList.contains('remove-inventory-item-btn')) {
                showConfirm(`Are you sure you want to delete "${item?.name}" from inventory?`, () => {
                    inventoryData = inventoryData.filter(i => i.id !== itemId);
                    saveInventoryData();
                    renderInventory();
                });
            }
        });
    }

    // --- X-Ray Analysis ---
    const xrayUpload = document.getElementById('xray-file-input') as HTMLInputElement;
    const xrayImage = document.getElementById('xray-preview-img') as HTMLImageElement;
    const xrayAnalysisText = document.getElementById('ai-radiograph-results') as HTMLDivElement;
    const analyzeXrayBtn = document.getElementById('analyze-xray-btn') as HTMLButtonElement;
    const xrayPlaceholder = document.getElementById('xray-placeholder') as HTMLDivElement;
    
    document.getElementById('select-xray-btn')?.addEventListener('click', () => xrayUpload?.click());

    xrayUpload?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (!event.target?.result) return;
                const base64String = (event.target.result as string).split(',')[1];
                xrayBase64 = base64String;
                xrayMimeType = file.type;

                if (xrayImage && xrayPlaceholder) {
                    xrayImage.src = event.target.result as string;
                    xrayImage.classList.remove('hidden');
                    xrayPlaceholder.classList.add('hidden');
                }
                
                if (analyzeXrayBtn) {
                    analyzeXrayBtn.disabled = false;
                }
                if (xrayAnalysisText) xrayAnalysisText.innerHTML = '<p class="text-gray-500">X-Ray loaded. Click "Analyze" to generate a report.</p>';
            };
            reader.readAsDataURL(file);
        }
    });

    analyzeXrayBtn?.addEventListener('click', async () => {
        if (!xrayBase64 || !xrayMimeType || !analyzeXrayBtn || !xrayAnalysisText) return;

        analyzeXrayBtn.disabled = true;
        analyzeXrayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        xrayAnalysisText.innerHTML = '<p class="text-gray-500">AI is analyzing the radiograph. This may take a moment...</p>';
        
        try {
            const prompt = `You are a dental radiologist AI. Analyze this dental radiograph. Identify potential areas of concern such as caries (using FDI tooth notation), bone loss, periapical pathology, or other anomalies. Provide a structured report. Be cautious and recommend clinical correlation.`;

            const imagePart = {
                inlineData: {
                  data: xrayBase64,
                  mimeType: xrayMimeType,
                },
              };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [ {text: prompt}, imagePart] },
            });
            xrayAnalysisText.innerHTML = response.text.replace(/\n/g, '<br>');

        } catch (error) {
            console.error("X-Ray analysis failed:", error);
            xrayAnalysisText.innerHTML = '<p class="text-red-500">Analysis failed. Please check the console for details.</p>';
        } finally {
            if (analyzeXrayBtn) {
                analyzeXrayBtn.disabled = false;
                analyzeXrayBtn.innerHTML = '<i class="fas fa-magic"></i> Analyze with AI';
            }
        }
    });

    document.querySelectorAll('.dmft-input').forEach(input => {
        input.addEventListener('input', () => calculateDMFT(true));
    });

    // --- Handout Logic ---
    async function generateAndShowHandout(title: string, procedures: { procedure: string, code?: string, tooth?: string }[], combined: boolean) {
        const modal = document.getElementById('patient-handout-modal');
        const titleEl = document.getElementById('handout-modal-title');
        const contentEl = document.getElementById('handout-modal-content');
        if (!modal || !titleEl || !contentEl) return;
        
        titleEl.textContent = title;
        contentEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating AI handout...';
        modal.classList.remove('hidden');
    
        try {
            const procedureList = procedures.map(p => `- ${p.procedure}${p.tooth ? ` on tooth ${p.tooth}` : ''}`).join('\n');
            const prompt = `You are a dental assistant AI. Generate a patient-friendly post-procedure handout.
            ${combined ? 'The patient had the following procedures today:' : 'The patient had the following procedure:'}
            ${procedureList}
            
            The handout should include:
            1. A simple, reassuring title.
            2. A brief, easy-to-understand explanation of what was done.
            3. A section on "What to Expect" (e.g., numbness, sensitivity).
            4. A section on "Post-Procedure Care" (e.g., diet, oral hygiene, pain management).
            5. A section on "When to Call Us" with clear warning signs.
            Format the output using Markdown.`;
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const { marked } = await import('marked');
            contentEl.innerHTML = marked.parse(response.text);
        } catch (error) {
            console.error("Handout generation failed:", error);
            contentEl.textContent = 'Error generating handout.';
        }
    }

    document.getElementById('generate-combined-handout-btn')?.addEventListener('click', () => {
        if (currentPatientData.procedureLog.length > 0) {
            generateAndShowHandout('Combined Post-Procedure Handout', currentPatientData.procedureLog, true);
        } else {
            showConfirm("No procedures have been logged to generate a handout.", () => {});
        }
    });

    document.getElementById('print-handout-btn')?.addEventListener('click', () => {
        const modalContent = document.getElementById('patient-handout-modal');
        modalContent?.classList.add('print-this-modal');
        window.print();
        modalContent?.classList.remove('print-this-modal');
    });

    // --- Note Modal Logic ---
    document.body.addEventListener('show-note-modal', (e: any) => {
        const { toothId, surfaceId } = e.detail;
        const modal = document.getElementById('note-modal') as HTMLDivElement;
        const title = modal.querySelector('#note-modal-title') as HTMLElement;
        const input = modal.querySelector('#condition-note-input') as HTMLTextAreaElement;
        const toothIdInput = modal.querySelector('#note-tooth-id') as HTMLInputElement;
        const surfaceIdInput = modal.querySelector('#note-surface-id') as HTMLInputElement;

        if (!modal || !title || !input || !toothIdInput || !surfaceIdInput) return;
        
        toothIdInput.value = toothId;
        surfaceIdInput.value = surfaceId || '';
        
        const tooth = dentalChart.teeth[toothId];
        let noteData;
        if (surfaceId) {
            title.textContent = `Note for Tooth ${toothId} / Surface ${surfaceId}`;
            noteData = tooth?.surfaces[surfaceId];
        } else {
            title.textContent = `Note for Tooth ${toothId}`;
            noteData = tooth?.wholeToothState;
        }

        input.value = noteData?.note || '';
        modal.classList.remove('hidden');
        input.focus();
    });

    document.getElementById('save-note-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('note-modal') as HTMLDivElement;
        const input = document.getElementById('condition-note-input') as HTMLTextAreaElement;
        const toothId = (document.getElementById('note-tooth-id') as HTMLInputElement).value;
        const surfaceId = (document.getElementById('note-surface-id') as HTMLInputElement).value;
        
        if (!toothId || !input || !modal) return;

        const tooth = dentalChart.teeth[toothId];
        if (surfaceId) {
            if (tooth.surfaces[surfaceId]) tooth.surfaces[surfaceId].note = input.value;
        } else {
            if (tooth.wholeToothState) tooth.wholeToothState.note = input.value;
        }
        
        dentalChart.updateNoteIndicator(toothId, surfaceId || null);
        dentalChart.saveState();
        modal.classList.add('hidden');
    });

    // --- Outreach & Dashboard Logic ---
    const outreachToggle = document.getElementById('outreach-toggle') as HTMLInputElement;
    outreachToggle?.addEventListener('change', () => {
        const isOutreachMode = outreachToggle.checked;
        document.getElementById('comprehensive-view')?.classList.toggle('hidden', isOutreachMode);
        document.getElementById('outreach-view-controls')?.classList.toggle('hidden', !isOutreachMode);
        document.getElementById('perio-chart-section')?.classList.toggle('hidden', isOutreachMode);
        document.getElementById('treatment-records-section')?.classList.toggle('hidden', isOutreachMode);
        const subtitle = document.getElementById('app-subtitle');
        if (subtitle) {
            subtitle.textContent = isOutreachMode ? 'Outreach Charting Mode' : 'Practice Management';
        }
    });

    // --- Final Initialization Calls ---
    dentalChart.draw();
    dentalChart.updateSelectedConditionDisplay();
    updateUndoRedoButtons();
    setupConditionModal();
    initializePerioChart('permanent');
    // Fix: Load inventory data on startup.
    loadInventoryData();

    // --- Universal/Delegated Event Listeners ---
    
    // Quick-fill buttons
    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.classList.contains('quick-btn')) {
            const targetId = target.dataset.target;
            if (targetId) {
                const textarea = document.getElementById(targetId) as HTMLTextAreaElement;
                if (textarea) {
                    const text = target.textContent || '';
                    if (textarea.value.length > 0 && !textarea.value.endsWith(' ') && text !== 'None' && text !== 'WNL') {
                        textarea.value += ', ';
                    }
                    textarea.value += text;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    });

    // Initialize Suggestion Popup
    suggestionPopup = document.getElementById('ai-procedure-suggestion-popup') as HTMLDivElement;
    if (suggestionPopup) {
        document.addEventListener('click', (e) => {
            if (activeSuggestionInput && !suggestionPopup.contains(e.target as Node) && e.target !== activeSuggestionInput) {
                hideSuggestionPopup();
            }
        });
    }

    // AI Suggestion Listeners (delegated for dynamic content)
    document.body.addEventListener('focusin', (e) => {
        const target = e.target as HTMLInputElement;
        const isProcedure = target.matches('#plan-procedure-input, #item-description, [data-prop="procedure"]');
        const isCode = target.matches('#plan-code-input, #item-code, [data-prop="code"]');
        
        if (isProcedure) {
            target.addEventListener('input', handleProcedureInput);
            target.addEventListener('blur', () => setTimeout(hideSuggestionPopup, 200));
        } else if (isCode) {
            handleCodeInput(e);
            target.addEventListener('blur', () => setTimeout(hideSuggestionPopup, 200));
        }
    });

    document.getElementById('print-chart-btn')?.addEventListener('click', () => {
        // Temporarily set to comprehensive view for printing if in outreach mode
        const isOutreach = outreachToggle.checked;
        if(isOutreach) outreachToggle.click();
        
        window.print();
        
        if(isOutreach) outreachToggle.click(); // Revert back
    });

    // --- Remaining Button Listeners ---
    document.getElementById('generate-ai-diagnosis-btn')?.addEventListener('click', async () => {
        const diffDiagEl = document.getElementById('diag-differential') as HTMLTextAreaElement;
        const defDiagEl = document.getElementById('diag-definitive') as HTMLTextAreaElement;
        const btn = document.getElementById('generate-ai-diagnosis-btn') as HTMLButtonElement;
        if (!diffDiagEl || !defDiagEl || !btn) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const problems = [];
        for (const tooth of Object.values(dentalChart.teeth) as any[]) {
            if (tooth.wholeToothState?.condition && !['missing', 'implant'].includes(tooth.wholeToothState.condition)) {
                problems.push(`- Whole tooth condition: ${dentalChart.getCondition(tooth.wholeToothState.condition)?.label} on tooth ${tooth.id}.`);
            }
            for (const surface in tooth.surfaces) {
                if (tooth.surfaces[surface].condition !== 'sound') {
                    const cond = dentalChart.getCondition(tooth.surfaces[surface].condition);
                    if (cond && !['amalgam', 'composite', 'glass-ionomer', 'gold', 'sealant'].includes(tooth.surfaces[surface].condition)) {
                        problems.push(`- Surface condition: ${cond.label} on tooth ${tooth.id}, surface ${surface}.`);
                    }
                }
            }
        }
        const examNotes = (document.getElementById('treat-clinical-notes') as HTMLTextAreaElement).value;

        try {
            const prompt = `You are a diagnostic AI for a dentist. Based on the following clinical findings, provide a differential diagnosis and a most likely definitive diagnosis.
            
    Charted Findings:
    ${problems.join('\n') || 'None'}

    Clinical Notes:
    ${examNotes || 'None'}

    Provide a concise differential diagnosis and a single definitive diagnosis.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            // This is a simplified parsing. A more robust solution would use JSON mode.
            const responseText = response.text;
            const diffMatch = responseText.match(/Differential Diagnosis:([\s\S]*?)(Definitive Diagnosis:|$)/i);
            const defMatch = responseText.match(/Definitive Diagnosis:([\s\S]*)/i);

            if (diffMatch) diffDiagEl.value = diffMatch[1].trim();
            if (defMatch) defDiagEl.value = defMatch[1].trim();
            if (!diffMatch && !defMatch) diffDiagEl.value = responseText;

        } catch (error) {
            console.error(error);
            diffDiagEl.value = "Error generating diagnosis.";
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Diagnosis';
        }
    });

    // Attempt to load last patient data on startup
    const lastPatientId = localStorage.getItem('lastPatientId');
    if (lastPatientId) {
        const lastPatientData = localStorage.getItem(`dentalPatientData-${lastPatientId}`);
        if (lastPatientData) {
            loadData(lastPatientData);
        }
    }
});
