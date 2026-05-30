/**
 * PROJEKT ANATEMA V2 - Komplett Spelmotor (motor.js)
 * Branch: anatema-v2
 */

// Globala speltillstånd
let globalTeologer = [];
let globalHeresier = [];
let currentHeresy = null;
let selectedSquad = [];
let combatQueue = [];
let activeQueueIndex = 0;
let combatRound = 1;
let playerName = "ANONYM";

// Stridsmätare (De 6 mekaniska pelarna)
let pHeresyLar = 0, pMaxLar = 0;
let pHeresyStr = 0, pMaxStr = 0;
let pHeresyLeg = 0, pMaxLeg = 0;
let heresyFollowersPct = 40; 

// Status-effekter från Lair Actions
let truppDisadvantage = false;
let truppParalyserad = false; 
let aktivSubMeny = "attack";

// Inspektören (Synodens tvåstegsval)
let previewedTeolog = null;
let previewedKostnad = 0;

// ==========================================
// 1. INITIALISERING OCH DATALADDNING
// ==========================================
async function laddaSpelData() {
    try {
        const teologerRes = await fetch('teologer.json');
        globalTeologer = await teologerRes.json();
        const heresierRes = await fetch('heresier.json');
        globalHeresier = await heresierRes.json();
        
        const enterBtn = document.getElementById('start-enter-btn');
        if (enterBtn) enterBtn.disabled = false;
        
        const statusTxt = document.getElementById('loading-status');
        if (statusTxt) statusTxt.innerText = "Kyrkofäderna har samlats. Tryck ovan för att börja.";
        
    } catch (error) {
        console.error("Kunde inte ladda JSON-filer:", error);
        const statusTxt = document.getElementById('loading-status');
        if (statusTxt) statusTxt.innerText = "Ett kätterskt fel uppstod vid laddning av speldata.";
    }
}
window.addEventListener('DOMContentLoaded', laddaSpelData);

// ==========================================
// 2. SKÄRMHANTERING & REGISTRERING
// ==========================================
function changeScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.remove('hidden');
}

function registreraSpelare() {
    let input = document.getElementById('player-name-input').value.trim();
    playerName = input ? input.toUpperCase() : "ANONYM APOLOGET";
    byggHeresiKort();
    changeScreen('screen-disputation');
}

function byggHeresiKort() {
    const grid = document.getElementById('heresy-selection-list');
    if (!grid) return;
    grid.innerHTML = '';
    globalHeresier.forEach(h => {
        grid.innerHTML += `
            <div class="heresy-card" onclick="valjHeresiUtmaning('${h.id}')">
                <h3>${h.name}</h3>
                <p>Frontfigur: ${h.boss}</p>
            </div>`;
    });
}

function valjHeresiUtmaning(heresyId) {
    currentHeresy = globalHeresier.find(h => String(h.id) === String(heresyId));
    selectedSquad = [];
    previewedTeolog = null;
    previewedKostnad = 0;
    
    const detailView = document.getElementById('char-detail-view');
    if (detailView) detailView.innerHTML = '<p class="placeholder-text">Välj en teolog till vänster för att granska deras D&D-stats och citat.</p>';
    
    uppdateraSynodUI();
    changeScreen('screen-synod');
    
    const forstaTab = document.querySelector('.tab-btn');
    if (forstaTab) forstaTab.click();
}

// ==========================================
// 3. SYNODENS GRÄNSSNITT (TVÅSTEGSVAL)
// ==========================================
function filtreraMentalitet(mentalitet, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const rosterGrid = document.getElementById('synod-roster-display');
    if (!rosterGrid) return;
    rosterGrid.innerHTML = '';
    
    globalTeologer.filter(t => t.mentalitet === mentalitet).forEach(t => {
        let isSelected = selectedSquad.some(s => s.id === t.id) ? "selected" : "";
        let kostnad = t.id * 2 + 50; 
        
        rosterGrid.innerHTML += `
            <div class="char-card ${isSelected}" onclick="klickaTeologSynod(${t.id}, ${kostnad})">
                <strong>${t.name}</strong><br>
                ${kostnad} TK
            </div>`;
    });
}

function klickaTeologSynod(id, kostnad) {
    const teologData = globalTeologer.find(t => t.id === id);
    if (!teologData) return;

    previewedTeolog = teologData;
    previewedKostnad = kostnad;
    visaTeologDetaljer(teologData, kostnad);
}

function visaTeologDetaljer(t, kostnad) {
    const detailView = document.getElementById('char-detail-view');
    if (!detailView) return;

    const beraknadHP = (t.con * 15) + 45;
    const citatStr = t.citat && t.citat.length > 0 
        ? t.citat[Math.floor(Math.random() * t.citat.length)] 
        : "För sanningen och ortodoxin!";
    
    const redanISquad = selectedSquad.some(s => s.id === t.id);
    const utnyttjat = selectedSquad.reduce((sum, s) => sum + s.tkKostnad, 0);
    const harRad = (500 - utnyttjat) >= kostnad;
    const squadFull = selectedSquad.length >= 4;

    let knappStatus = "";
    let knappText = "+ LÄGG TILL I SQUAD";

    if (redanISquad) { knappStatus = "disabled"; knappText = "REDAN REKRYTERAD"; }
    else if (squadFull) { knappStatus = "disabled"; knappText = "SYNODEN ÄR FULL (MAX 4)"; }
    else if (!harRad) { knappStatus = "disabled"; knappText = "FÖR LITE TK-BUDGET"; }

    detailView.innerHTML = `
        <div class="inspector-card">
            <div class="inspector-header">
                <h2>${t.name}</h2>
                <span class="badge-${t.klass.toLowerCase()}">${t.klass} (${t.roll})</span>
            </div>
            <div class="inspector-quote"><p><em>"${citatStr}"</em></p></div>
            <div class="inspector-stats-section">
                <h3>STENHÅRDA D&D STATS</h3>
                <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                    <div><strong>STR (Apostel):</strong> ${t.str}</div>
                    <div><strong>DEX (Initiativ):</strong> ${t.dex}</div>
                    <div><strong>CON (Fysik):</strong> ${t.con} <small>(HP: ${beraknadHP})</small></div>
                    <div><strong>INT (Lärare):</strong> ${t.int}</div>
                    <div><strong>WIS (Herde):</strong> ${t.wis}</div>
                    <div><strong>CHA (Evangelist):</strong> ${t.cha}</div>
                </div>
                <p><strong>Dogmatisk Energi (DE):</strong> Startar med ${t.startDE} DE.</p>
                <p><strong>Signaturförmåga:</strong> <em>${t.deHandlingNamn}</em></p>
                <p class="effekt-beskrivning"><small>${t.loggEffekt}</small></p>
            </div>
            <div class="inspector-actions" style="margin-top: 20px;">
                <button id="add-to-squad-btn" class="green-confirm-btn" ${knappStatus} onclick="bekraftaRekrytering()">
                    ${knappText} (${kostnad} TK)
                </button>
            </div>
        </div>`;
}

function bekraftaRekrytering() {
    if (!previewedTeolog) return;
    let utnyttjat = selectedSquad.reduce((sum, s) => sum + s.tkKostnad, 0);
    if (selectedSquad.length >= 4 || (500 - utnyttjat) < previewedKostnad) return;
    if (selectedSquad.some(s => s.id === previewedTeolog.id)) return;

    const statsHP = (previewedTeolog.con * 15) + 45;
    selectedSquad.push({ 
        ...previewedTeolog, 
        tkKostnad: previewedKostnad,
        maxHP: statsHP,
        currentHP: statsHP,
        currentDE: previewedTeolog.startDE,
        shieldPool: 0
    });

    uppdateraSynodUI();
    visaTeologDetaljer(previewedTeolog, previewedKostnad);
    const aktivTab = document.querySelector('.tab-btn.active');
    if (aktivTab) filtreraMentalitet(previewedTeolog.mentalitet, aktivTab);
}

function taBortFranSquad(id) {
    let index = selectedSquad.findIndex(s => s.id === id);
    if (index > -1) {
        let borttagen = selectedSquad[index];
        selectedSquad.splice(index, 1);
        uppdateraSynodUI();
        if (previewedTeolog && previewedTeolog.id === id) {
            visaTeologDetaljer(previewedTeolog, previewedKostnad);
        }
        const aktivTab = document.querySelector('.tab-btn.active');
        if (aktivTab) filtreraMentalitet(borttagen.mentalitet, aktivTab);
    }
}

function uppdateraSynodUI() {
    let utnyttjat = selectedSquad.reduce((sum, s) => sum + s.tkKostnad, 0);
    const budgetLabel = document.getElementById('TK-budget-label');
    if (budgetLabel) budgetLabel.innerText = `TK-Budget: ${500 - utnyttjat} / 500 TK`;
    
    const slotsDisplay = document.getElementById('squad-slots-display');
    if (!slotsDisplay) return;
    slotsDisplay.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        if (selectedSquad[i]) {
            slotsDisplay.innerHTML += `
                <div class="squad-slot-item filled" onclick="taBortFranSquad(${selectedSquad[i].id})">
                    <strong>${selectedSquad[i].name}</strong> <span class="remove-trigger">×</span>
                </div>`;
        } else {
            slotsDisplay.innerHTML += `<div class="squad-slot-item empty">[ TOM TEOLOGSLOT ]</div>`;
        }
    }
    const startBtn = document.getElementById('start-battle-confirm-btn');
    if (startBtn) startBtn.disabled = (selectedSquad.length === 0);
}

// ==========================================
// 4. STRIDSMOTOR & TUR-KICKSTART
// ==========================================
function initieraD20Strid() {
    if (selectedSquad.length === 0) return;

    pMaxLar = 150; pHeresyLar = pMaxLar;
    pMaxStr = 50; pHeresyStr = pMaxStr;
    pMaxLeg = 60; pHeresyLeg = pMaxLeg;
    heresyFollowersPct = 40; 
    combatRound = 1;
    truppDisadvantage = false;
    truppParalyserad = false;
    aktivSubMeny = "attack";
    
    selectedSquad.forEach(t => {
        let beraknatHP = (t.con * 15) + 45;
        t.maxHP = beraknatHP; t.currentHP = beraknatHP; t.currentDE = t.startDE; t.shieldPool = 0;
    });
    
    byggInitiativKedja();
    changeScreen('screen-battle');
    uppdateraUXGranssnitt();
    logSpelBatalj(`MÖTET HAR BÖRJAT! Strid mot villoläran: ${currentHeresy.name}.`);

    // KORRIGERING: Kickstarta om datorn (Boss eller Lair) hamnade allra först i kön runda 1!
    let foerstaEnhet = combatQueue[0];
    if (foerstaEnhet && !foerstaEnhet.isPlayer) {
        if (foerstaEnhet.id === "boss") {
            setTimeout(exekveraBossTur, 1200);
        } else if (foerstaEnhet.id === "lair") {
            setTimeout(exekveraLairAction, 1200);
        }
    }
}

function byggInitiativKedja() {
    combatQueue = [];
    
    let bossRoll = Math.floor(Math.random() * 20) + 1;
    let bossInit = bossRoll + 2;
    combatQueue.push({ isPlayer: false, id: "boss", name: currentHeresy.boss, init: bossInit });
    
    selectedSquad.forEach(t => {
        let spelarRoll = Math.floor(Math.random() * 20) + 1;
        let spelarInit = spelarRoll + t.dex;
        combatQueue.push({ isPlayer: true, id: t.id, name: t.name, init: spelarInit });
    });
    
    combatQueue.sort((a, b) => b.init - a.init);
    
    // Lair Action läggs till fast på 20 (men förlorar lika-läge)
    let lairIndex = combatQueue.findIndex(enhet => enhet.init < 20);
    let lairNode = { isPlayer: false, id: "lair", name: "FÖLJARNA (Lair)", init: 20 };
    
    if (lairIndex === -1) {
        combatQueue.push(lairNode);
    } else {
        combatQueue.splice(lairIndex, 0, lairNode);
    }
    
    activeQueueIndex = 0;
}

function exekveraBossTur() {
    let levandeApologeter = selectedSquad.filter(s => s.currentHP > 0);
    if (levandeApologeter.length === 0) return;
    
    let mltavla = levandeApologeter[Math.floor(Math.random() * levandeApologeter.length)];
    let skada = Math.floor(Math.random() * 6) + 6; 
    
    mltavla.currentHP = Math.max(0, mltavla.currentHP - skada);
    logSpelBatalj(`[BOSS TUR] ${currentHeresy.boss} attackerar med kätterska argument! ${mltavla.name} tappar ${skada} HP.`);
    
    kontrolleraMatchSlut();
    nastaTur();
}

function exekveraLairAction() {
    logSpelBatalj(`[LAIR PHASE] Massornas dragkamp aktiveras!`);
    truppDisadvantage = false;
    truppParalyserad = false;

    if (heresyFollowersPct <= 35) {
        logSpelBatalj(`⚠️ ${currentHeresy.lairActions.drev}`);
        truppDisadvantage = true;
    } else if (heresyFollowersPct > 35 && heresyFollowersPct <= 75) {
        let xSkada = Math.floor(heresyFollowersPct / 5) + 4; 
        let dynamicText = currentHeresy.lairActions.han.replace("[X]", xSkada);
        logSpelBatalj(`💥 ${dynamicText}`);
        
        selectedSquad.forEach(t => {
            if (t.currentHP > 0) {
                if (t.shieldPool > 0) {
                    if (t.shieldPool >= xSkada) { t.shieldPool -= xSkada; xSkada = 0; }
                    else { xSkada -= t.shieldPool; t.shieldPool = 0; }
                }
                t.currentHP = Math.max(0, t.currentHP - xSkada);
            }
        });
    } else {
        logSpelBatalj(`🚨 KATASTROF! ${currentHeresy.lairActions.tidsanda}`);
        truppParalyserad = true;
    }

    kontrolleraMatchSlut();
    nastaTur();
}

function hanteraSpelarHandling(handlingTyp, teologId) {
    let t = selectedSquad.find(s => s.id === teologId);
    if (!t || t.currentHP <= 0) return;

    if (truppParalyserad) {
        logSpelBatalj(`${t.name} är paralyserad av tidsandan och kan inte tala!`);
        nastaTur();
        return;
    }

    let rullning1 = Math.floor(Math.random() * 20) + 1;
    let rullning2 = Math.floor(Math.random() * 20) + 1;
    let d20 = rullning1;
    
    if (truppDisadvantage) {
        d20 = Math.min(rullning1, rullning2);
        logSpelBatalj(`[DISADVANTAGE] Rullar två tärningar (${rullning1}, ${rullning2}). Väljer: ${d20}`);
    }

    if (handlingTyp === 'attack') {
        if (d20 === 1) {
            logSpelBatalj(`[NAT 1] ${t.name} snubblar katastrofalt på orden!`);
            nastaTur(); return;
        }
        
        let isCrit = (d20 === 20);
        if (isCrit) logSpelBatalj(`[NAT 20] Perfekt replik! ${t.name} ryter: "${t.citat[0]}"`);

        if (t.klass === "Evangelist") {
            let effekt = Math.floor(Math.random() * 6) + 1 + t.cha; 
            if (isCrit) effekt *= 2;
            heresyFollowersPct = Math.max(0, heresyFollowersPct - effekt);
            logSpelBatalj(`${t.name} omvänder följare! Kätteriets grepp minskar med ${effekt}%.`);
        } else if (t.klass === "Lärare") {
            let skada = Math.floor(Math.random() * 8) + 1 + t.int; 
            if (isCrit) skada *= 2;
            pHeresyLar = Math.max(0, pHeresyLar - skada);
            logSpelBatalj(`${t.name} dekonstruerar villolärans kärna och gör ${skada} Logos-skada.`);
        } else {
            let skada = Math.floor(Math.random() * 6) + 1;
            pHeresyLar = Math.max(0, pHeresyLar - skada);
            logSpelBatalj(`${t.name} argumenterar stabilt för ${skada} skada.`);
        }
        
    } else if (handlingTyp === 'skills') {
        if (t.currentDE < t.deKostnad) {
            logSpelBatalj(`${t.name} saknar DE för att aktivera ${t.deHandlingNamn}!`);
            return; 
        }
        t.currentDE -= t.deKostnad;
        logSpelBatalj(`[SKILL] ${t.name} aktiverar: "${t.deHandlingNamn}"!`);
        
        if (t.id === 30) { 
            heresyFollowersPct = Math.max(0, heresyFollowersPct - 25);
        } else {
            pHeresyLar = Math.max(0, pHeresyLar - 20);
        }

    } else if (handlingTyp === 'defend') {
        if (t.klass === "Herde") {
            let heal = Math.floor(Math.random() * 6) + 1 + t.wis; 
            selectedSquad.filter(s => s.currentHP > 0).forEach(s => s.currentHP = Math.min(s.maxHP, s.currentHP + heal));
            logSpelBatalj(`${t.name} utguter helande ord. Truppen återfår ${heal} HP.`);
        } else if (t.klass === "Apostel") {
            let skold = Math.floor(Math.random() * 8) + 1 + t.str; 
            t.shieldPool += skold;
            logSpelBatalj(`${t.name} reser en Trons sköld som skyddar mot ${skold} skada.`);
        } else {
            t.currentHP = Math.min(t.maxHP, t.currentHP + 5);
            logSpelBatalj(`${t.name} samlar sig i bön och helar 5 HP.`);
        }
    }

    kontrolleraMatchSlut();
    nastaTur();
}

function kontrolleraMatchSlut() {
    if (heresyFollowersPct >= 100) {
        logSpelBatalj(`[KATASTROF] 100% av folket har förletts.`);
        alert("Kätterskt Game Over!");
        location.reload();
    } else if (pHeresyLar <= 0) {
        logSpelBatalj(`[SEGER] ${currentHeresy.name} är krossat!`);
        alert("Ortodoxin segrar!");
        location.reload();
    } else if (selectedSquad.every(s => s.currentHP <= 0)) {
        logSpelBatalj(`[NEDERLAG] Din synod har tystats.`);
        alert("Synoden föll!");
        location.reload();
    }
}

function nastaTur() {
    activeQueueIndex = (activeQueueIndex + 1) % combatQueue.length;
    if (activeQueueIndex === 0) {
        combatRound++;
        truppParalyserad = false; 
    }
    
    uppdateraUXGranssnitt();
    
    let nuvarandeEnhet = combatQueue[activeQueueIndex];
    if (nuvarandeEnhet.id === "boss") {
        setTimeout(exekveraBossTur, 1200);
    } else if (nuvarandeEnhet.id === "lair") {
        setTimeout(exekveraLairAction, 1200);
    }
}

function ritaTidslinje() {
    const box = document.getElementById('hud-timeline');
    if (!box) return;
    box.innerHTML = '';
    combatQueue.forEach((enhet, index) => {
        let nodeKlass = index === activeQueueIndex ? "timeline-node active" : "timeline-node";
        if (enhet.id === "lair") nodeKlass += " lair-node";
        box.innerHTML += `<div class="${nodeKlass}">${enhet.name.substring(0, 5).toUpperCase()}</div>`;
    });
}

function bytSubMeny(menyId) {
    aktivSubMeny = menyId;
    uppdateraUXGranssnitt();
    
    document.querySelectorAll('.chained-menu .c-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-nav-' + menyId);
    if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================
// 5. RENDERING OCH INTERN GRÄNSSNITTSBRYGGA
// ==========================================
function uppdateraUXGranssnitt() {
    if (!currentHeresy) return;
    
    // 1. Synka heresiens mätare
    const elementMappning = {
        'bar-laran': `${(pHeresyLar / pMaxLar) * 100}%`,
        'bar-struktur': `${(pHeresyStr / pMaxStr) * 100}%`,
        'bar-legitimitet': `${(pHeresyLeg / pMaxLeg) * 100}%`,
        'hud-influence-fill': `${heresyFollowersPct}%` 
    };
    for (let [id, widthVal] of Object.entries(elementMappning)) {
        const el = document.getElementById(id);
        if (el) el.style.width = widthVal;
    }
    
    const bossNameEl = document.getElementById('hud-boss-name');
    if (bossNameEl) bossNameEl.innerText = currentHeresy.boss.toUpperCase() + " (" + currentHeresy.name + ")";

    // 2. Synka partymätare
    const rowsBox = document.getElementById('hud-squad-status-rows');
    if (rowsBox) {
        rowsBox.innerHTML = '';
        selectedSquad.forEach(t => {
            let statusPrefix = t.currentHP <= 0 ? "[TYSTAD] " : "";
            rowsBox.innerHTML += `
                <div class="hud-party-row ${t.currentHP <= 0 ? 'dead' : ''}">
                    <div class="hud-party-name">${statusPrefix}${t.name} (${t.klass})</div>
                    <div class="hud-party-vitals">HP ${t.currentHP}/${t.maxHP} | DE ${t.currentDE}</div>
                </div>`;
        });
    }
    
    // 3. GENERERA JRPG-MENYKNAPPAR DYNAMISKT UTIFRÅN TUR OCH KLASS
    const activeNameEl = document.getElementById('hud-active-name');
    const subActionsEl = document.getElementById('hud-sub-actions');
    
    if (activeNameEl && subActionsEl && combatQueue.length > 0) {
        let activeUnit = combatQueue[activeQueueIndex];
        
        if (activeUnit.isPlayer) {
            let teolog = selectedSquad.find(s => s.id === activeUnit.id);
            if (teolog) {
                activeNameEl.innerText = "TUR: " + teolog.name.toUpperCase();
                activeNameEl.style.color = "#ffff55";
                
                subActionsEl.innerHTML = '';
                if (aktivSubMeny === 'attack') {
                    let label = "Standardargument";
                    if (teolog.klass === "Evangelist") label = "Pathos-vädjan (Vänd Följare)";
                    else if (teolog.klass === "Lärare") label = "Logos-argument (Skada Läran)";
                    
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack', ${teolog.id})">
                            <span>📜 ${label}</span>
                            <span style="color:#ffff55;">d20 + ${teolog.klass === "Evangelist" ? teolog.cha : teolog.int}</span>
                        </button>`;
                } else if (aktivSubMeny === 'skills') {
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('skills', ${teolog.id})">
                            <span>⚡ SIGNATUR: ${teolog.deHandlingNamn}</span>
                            <span style="color:#00ccff;">-${teolog.deKostnad} DE</span>
                        </button>`;
                } else if (aktivSubMeny === 'defend') {
                    let label = "Samla tankarna (Hela 5 HP)";
                    if (teolog.klass === "Herde") label = "Helande ord (Hela truppen)";
                    else if (teolog.klass === "Apostel") label = "Trons sköld (Absorbera skada)";
                    
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('defend', ${teolog.id})">
                            <span>🛡️ ${label}</span>
                            <span style="color:#55ffff;">Modifierare: ${teolog.klass === "Herde" ? teolog.wis : teolog.str}</span>
                        </button>`;
                } else if (aktivSubMeny === 'items') {
                    subActionsEl.innerHTML = `<div style="font-size:11px; color:#555; padding:8px; font-style:italic;">[ Saknar föremål i kistan just nu ]</div>`;
                }
            }
        } else {
            activeNameEl.innerText = "TUR: " + activeUnit.name.toUpperCase();
            activeNameEl.style.color = activeUnit.id === "lair" ? "#ff5555" : "#ffaa00";
            subActionsEl.innerHTML = `<div style="font-size:11px; color:#ffff55; padding:8px; font-style:italic;">Heresin utför sitt drag...</div>`;
        }
    }
    
    ritaTidslinje();
}

// Globalexponering för HTML
window.registreraSpelare = registreraSpelare;
window.valjHeresiUtmaning = valjHeresiUtmaning;
window.filtreraMentalitet = filtreraMentalitet;
window.klickaTeologSynod = klickaTeologSynod;
window.bekraftaRekrytering = bekraftaRekrytering;
window.taBortFranSquad = taBortFranSquad;
window.initieraD20Strid = initieraD20Strid;
window.bytSubMeny = bytSubMeny;
window.hanteraSpelarHandling = hanteraSpelarHandling;
