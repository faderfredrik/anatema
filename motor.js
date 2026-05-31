/**
 * PROJEKT ANATEMA V2 - Taktisk Spelmotor (motor.js)
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
// 0. RETROSÄKRAD LOGGFUNKTION
// ==========================================
function logSpelBatalj(msg) {
    const logBox = document.getElementById('hud-battle-log') || document.getElementById('disputation-log');
    if (logBox) {
        logBox.innerHTML += `<div class="log-entry">[RUNDA ${combatRound}] ${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }
}
window.logSpelBatalj = logSpelBatalj;

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
        grid.innerHTML += `<div class="heresy-card" onclick="valjHeresiUtmaning('${h.id}')"><h3>${h.name}</h3><p>Frontfigur: ${h.boss}</p></div>`;
    });
}

function valjHeresiUtmaning(heresyId) {
    currentHeresy = globalHeresier.find(h => String(h.id) === String(heresyId));
    selectedSquad = [];
    previewedTeolog = null;
    previewedKostnad = 0;
    const detailView = document.getElementById('char-detail-view');
    if (detailView) detailView.innerHTML = '<p class="placeholder-text">Välj en teolog...</p>';
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
        rosterGrid.innerHTML += `<div class="char-card ${isSelected}" onclick="klickaTeologSynod(${t.id}, ${kostnad})"><strong>${t.name}</strong><br>${kostnad} TK</div>`;
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
    const citatStr = t.citat && t.citat.length > 0 ? t.citat[Math.floor(Math.random() * t.citat.length)] : "För sanningen!";
    const redanISquad = selectedSquad.some(s => s.id === t.id);
    const utnyttjat = selectedSquad.reduce((sum, s) => sum + s.tkKostnad, 0);
    const harRad = (500 - utnyttjat) >= kostnad;
    const squadFull = selectedSquad.length >= 4;
    let knappStatus = "";
    let knappText = "+ LÄGG TILL I SQUAD";
    if (redanISquad) { knappStatus = "disabled"; knappText = "REDAN REKRYTERAD"; }
    else if (squadFull) { knappStatus = "disabled"; knappText = "FULL (MAX 4)"; }
    else if (!harRad) { knappStatus = "disabled"; knappText = "FÖR LITE TK"; }

    detailView.innerHTML = `
        <div class="inspector-card">
            <div class="inspector-header"><h2>${t.name}</h2><span>${t.klass}</span></div>
            <div class="inspector-quote"><p><em>"${citatStr}"</em></p></div>
            <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>STR:</strong> ${t.str}</div><div><strong>DEX:</strong> ${t.dex}</div>
                <div><strong>CON:</strong> ${t.con} <small>(HP: ${beraknadHP})</small></div><div><strong>INT:</strong> ${t.int}</div>
                <div><strong>WIS:</strong> ${t.wis}</div><div><strong>CHA:</strong> ${t.cha}</div>
            </div>
            <p style="margin-top:10px;"><strong>Förmåga:</strong> ${t.deHandlingNamn}</p>
            <button id="add-to-squad-btn" class="green-confirm-btn" style="margin-top:15px;" ${knappStatus} onclick="bekraftaRekrytering()">${knappText} (${kostnad} TK)</button>
        </div>`;
}

function bekraftaRekrytering() {
    if (!previewedTeolog) return;
    let utnyttjat = selectedSquad.reduce((sum, s) => sum + s.tkKostnad, 0);
    if (selectedSquad.length >= 4 || (500 - utnyttjat) < previewedKostnad) return;
    if (selectedSquad.some(s => s.id === previewedTeolog.id)) return;
    const statsHP = (previewedTeolog.con * 15) + 45;
    selectedSquad.push({ ...previewedTeolog, tkKostnad: previewedKostnad, maxHP: statsHP, currentHP: statsHP, currentDE: previewedTeolog.startDE, shieldPool: 0 });
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
        if (previewedTeolog && previewedTeolog.id === id) visaTeologDetaljer(previewedTeolog, previewedKostnad);
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
            slotsDisplay.innerHTML += `<div class="squad-slot-item filled" onclick="taBortFranSquad(${selectedSquad[i].id})"><strong>${selectedSquad[i].name}</strong> <span class="remove-trigger">×</span></div>`;
        } else {
            slotsDisplay.innerHTML += `<div class="squad-slot-item empty">[ TOM SQUADSLOT ]</div>`;
        }
    }
    const startBtn = document.getElementById('start-battle-confirm-btn');
    if (startBtn) startBtn.disabled = (selectedSquad.length === 0);
}

// ==========================================
// 4. STRIDSMOTOR & TURORDNING
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
    window.logSpelBatalj(`MÖTET HAR BÖRJAT! Strid mot villoläran: ${currentHeresy.name}.`);
    let foerstaEnhet = combatQueue[0];
    if (foerstaEnhet && !foerstaEnhet.isPlayer) {
        if (foerstaEnhet.id === "boss") setTimeout(exekveraBossTur, 1200);
        else if (foerstaEnhet.id === "lair") setTimeout(exekveraLairAction, 1200);
    }
}

function byggInitiativKedja() {
    combatQueue = [];
    let bossRoll = Math.floor(Math.random() * 20) + 1;
    combatQueue.push({ isPlayer: false, id: "boss", name: currentHeresy.boss, init: bossRoll + 2 });
    selectedSquad.forEach(t => {
        combatQueue.push({ isPlayer: true, id: t.id, name: t.name, init: (Math.floor(Math.random() * 20) + 1) + t.dex });
    });
    combatQueue.sort((a, b) => b.init - a.init);
    let lairIndex = combatQueue.findIndex(enhet => enhet.init < 20);
    let lairNode = { isPlayer: false, id: "lair", name: "FÖLJARNA", init: 20 };
    if (lairIndex === -1) combatQueue.push(lairNode);
    else combatQueue.splice(lairIndex, 0, lairNode);
    activeQueueIndex = 0;
}

function exekveraBossTur() {
    let levande = selectedSquad.filter(s => s.currentHP > 0);
    if (levande.length === 0) return;
    
    window.logSpelBatalj(`${currentHeresy.boss} dundrar ut skarpa kätterska argument mot hela synoden!`);
    
    levande.forEach(mltavla => {
        let skada = Math.floor(Math.random() * 4) + 4; 
        if (currentHeresy.id === "nyateism") skada += Math.floor(heresyFollowersPct / 15);
        
        if (mltavla.shieldPool > 0) {
            if (mltavla.shieldPool >= skada) {
                mltavla.shieldPool -= skada;
                skada = 0;
            } else {
                skada -= mltavla.shieldPool;
                mltavla.shieldPool = 0;
            }
        }
        
        mltavla.currentHP = Math.max(0, mltavla.currentHP - skada);
        if (skada > 0) {
            window.logSpelBatalj(` > ${mltavla.name} tapper ${skada} HP.`);
        } else {
            window.logSpelBatalj(` > Trons sköld absorberade argumentet för ${mltavla.name}!`);
        }
    });

    kontrolleraMatchSlut();
    nastaTur();
}

function exekveraLairAction() {
    window.logSpelBatalj(`Massornas dragkamp aktiveras!`);
    truppDisadvantage = false;
    truppParalyserad = false;
    if (heresyFollowersPct <= 35) {
        window.logSpelBatalj(`⚠️ ${currentHeresy.lairActions.drev}`);
        truppDisadvantage = true;
    } else if (heresyFollowersPct > 35 && heresyFollowersPct <= 75) {
        let xSkadaBase = Math.floor(heresyFollowersPct / 5) + 4; 
        let dynamicText = (currentHeresy.lairActions.han || "Truppen tar [X] HP.").replace("[X]", xSkadaBase);
        window.logSpelBatalj(`💥 ${dynamicText}`);
        selectedSquad.forEach(t => {
            if (t.currentHP > 0) {
                let nuvarandeSkada = xSkadaBase;
                if (t.shieldPool > 0) {
                    if (t.shieldPool >= nuvarandeSkada) { t.shieldPool -= nuvarandeSkada; nuvarandeSkada = 0; }
                    else { nuvarandeSkada -= t.shieldPool; t.shieldPool = 0; }
                }
                t.currentHP = Math.max(0, t.currentHP - nuvarandeSkada);
            }
        });
    } else {
        window.logSpelBatalj(`🚨 KATASTROF! ${currentHeresy.lairActions.tidsanda}`);
        truppParalyserad = true;
    }
    kontrolleraMatchSlut();
    nastaTur();
}

function hanteraSpelarHandling(handlingTyp, teologId) {
    let t = selectedSquad.find(s => s.id === teologId);
    if (!t || t.currentHP <= 0) return;
    if (truppParalyserad) { window.logSpelBatalj(`${t.name} är paralyserad och kan inte tala!`); nastaTur(); return; }
    let d20 = Math.floor(Math.random() * 20) + 1;
    if (truppDisadvantage) d20 = Math.min(d20, Math.floor(Math.random() * 20) + 1);
    if (d20 === 1) { window.logSpelBatalj(`[NAT 1] ${t.name} snubblar katastrofalt på orden!`); nastaTur(); return; }
    let isCrit = (d20 === 20);
    if (isCrit) window.logSpelBatalj(`[NAT 20] Perfekt replik! ${t.name} utropar: "${t.citat[0]}"`);

    if (handlingTyp === 'attack_laran') {
        if (currentHeresy.id === "pelagianism" && pHeresyLeg > 0) { window.logSpelBatalj(`[IMMUNITET] Skyddar deras Lära! Sänk LEGITIMITETEN först!`); nastaTur(); return; }
        let skada = ((t.klass === "Lärare") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1)) + t.int;
        if (isCrit) skada *= 2;
        if (currentHeresy.id === "trilingual" && pHeresyLeg > 30) skada = Math.max(1, Math.floor(skada * 0.25));
        pHeresyLar = Math.max(0, pHeresyLar - skada);
        window.logSpelBatalj(`${t.name} angriper Lärans kärna och gör ${skada} skada.`);
        if (currentHeresy.id === "donatism" && pHeresyStr > 0) { pHeresyStr = Math.min(pMaxStr, pHeresyStr + 5); window.logSpelBatalj(`Donatisterna stärker sin organisation (+5 STRUKTUR)!`); }
    } else if (handlingTyp === 'attack_struktur') {
        let skada = ((t.klass === "Apostel") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1)) + t.str;
        if (isCrit) skada *= 2;
        pHeresyStr = Math.max(0, pHeresyStr - skada);
        window.logSpelBatalj(`${t.name} sänker STRUKTUREN med ${skada} punkter.`);
    } else if (handlingTyp === 'attack_legitimer') {
        let skada = ((t.klass === "Herde") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1)) + t.wis;
        if (isCrit) skada *= 2;
        pHeresyLeg = Math.max(0, pHeresyLeg - skada);
        window.logSpelBatalj(`${t.name} sänker LEGITIMITETEN med ${skada}.`);
    } else if (handlingTyp === 'attack_foljare') {
        let effekt = ((t.klass === "Evangelist") ? (Math.floor(Math.random() * 6) + 1) : (Math.floor(Math.random() * 4) + 1)) + t.cha;
        if (currentHeresy.id === "gnosticism") effekt = Math.max(1, effekt - 4);
        if (isCrit) effekt *= 2;
        heresyFollowersPct = Math.max(0, heresyFollowersPct - effekt);
        window.logSpelBatalj(`${t.name} omvänder ${effekt}% av FÖLJARNA.`);
    } else if (handlingTyp === 'skills') {
        if (t.currentDE < t.deKostnad) { window.logSpelBatalj(`${t.name} saknar DE för ${t.deHandlingNamn}!`); return; }
        t.currentDE -= t.deKostnad;
        window.logSpelBatalj(`[SKILL] ${t.name} aktiverar signaturförmågan: "${t.deHandlingNamn}"!`);
        
        if (t.klass === "Lärare") {
            let dmg = 25 + (t.int * 3);
            pHeresyLar = Math.max(0, pHeresyLar - dmg);
            window.logSpelBatalj(` ⚡ En intellektuell dekonstruktion krossar heresiens kärna: Gör -${dmg} skada på LÄRAN.`);
        } else if (t.klass === "Evangelist") {
            let pct = 20 + (t.cha * 3);
            heresyFollowersPct = Math.max(0, heresyFollowersPct - pct);
            window.logSpelBatalj(` ⚡ Ett kraftfullt väckelseläger skakar om gatorna: Omvänder -${pct}% av FÖLJARNA.`);
        } else if (t.klass === "Herde") {
            let legDmg = 20 + (t.wis * 2);
            pHeresyLeg = Math.max(0, pHeresyLeg - legDmg);
            selectedSquad.filter(s => s.currentHP > 0).forEach(s => s.currentHP = Math.min(s.maxHP, s.currentHP + 15));
            window.logSpelBatalj(` ⚡ Herdens omsorg upprättar synoden (+15 HP) och underminerar moralen: -${legDmg} LEGITIMITET.`);
        } else if (t.klass === "Apostel") {
            let strDmg = 15 + (t.str * 2);
            pHeresyStr = Math.max(0, pHeresyStr - strDmg);
            selectedSquad.filter(s => s.currentHP > 0).forEach(s => s.shieldPool += 15);
            window.logSpelBatalj(` ⚡ Trons fasta grund befäster försvaret (+15 Sköld) och raserar nätverket: -${strDmg} STRUKTUR.`);
        }

    } else if (handlingTyp === 'defend') {
        if (t.klass === "Herde") {
            let heal = Math.floor(Math.random() * 6) + 1 + t.wis;
            selectedSquad.filter(s => s.currentHP > 0).forEach(s => s.currentHP = Math.min(s.maxHP, s.currentHP + heal));
            window.logSpelBatalj(`${t.name} utguter helande ord. Truppen återfår ${heal} HP.`);
        } else if (t.klass === "Apostel") {
            let skold = Math.floor(Math.random() * 8) + 1 + t.str;
            t.shieldPool += skold;
            window.logSpelBatalj(`${t.name} reser en Trons sköld som skyddar mot ${skold} skada.`);
        } else {
            t.currentHP = Math.min(t.maxHP, t.currentHP + 5);
            window.logSpelBatalj(`${t.name} samlar sig och helar 5 HP.`);
        }
    }
    kontrolleraMatchSlut();
    nastaTur();
}

function kontrolleraMatchSlut() {
    if (heresyFollowersPct >= 100) { alert("Kätterskt Game Over!"); location.reload(); }
    else if (pHeresyLar <= 0) { alert("Ortodoxin segrar!"); location.reload(); }
    else if (selectedSquad.every(s => s.currentHP <= 0)) { alert("Synoden föll!"); location.reload(); }
}

function nastaTur() {
    activeQueueIndex = (activeQueueIndex + 1) % combatQueue.length;
    if (activeQueueIndex === 0) {
        combatRound++;
        truppParalyserad = false; 
        if (currentHeresy.id === "valdensianism" || currentHeresy.id === "arianism") {
            let tillvaxt = Math.floor(combatRound * 1.5) + 3;
            heresyFollowersPct = Math.min(100, heresyFollowersPct + tillvaxt);
            window.logSpelBatalj(`Kätteriets inflytande på gatorna ökar naturligt med ${tillvaxt}%.`);
        }
    }
    
    // KORRIGERING: Om det är en spelares tur, men teologen är tystad (HP <= 0), hoppa automatiskt över kön direkt!
    let nuvarandeEnhet = combatQueue[activeQueueIndex];
    if (nuvarandeEnhet.isPlayer) {
        let teologCheck = selectedSquad.find(s => s.id === nuvarandeEnhet.id);
        if (!teologCheck || teologCheck.currentHP <= 0) {
            nastaTur();
            return;
        }
    }

    uppdateraUXGranssnitt();
    if (nuvarandeEnhet.id === "boss") setTimeout(exekveraBossTur, 1200);
    else if (nuvarandeEnhet.id === "lair") setTimeout(exekveraLairAction, 1200);
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

function uppdateraUXGranssnitt() {
    if (!currentHeresy) return;
    const elementMappning = { 'bar-laran': `${(pHeresyLar / pMaxLar) * 100}%`, 'bar-struktur': `${(pHeresyStr / pMaxStr) * 100}%`, 'bar-legitimitet': `${(pHeresyLeg / pMaxLeg) * 100}%`, 'hud-influence-fill': `${heresyFollowersPct}%` };
    for (let [id, widthVal] of Object.entries(elementMappning)) {
        const el = document.getElementById(id);
        if (el) el.style.width = widthVal;
    }
    const bossNameEl = document.getElementById('hud-boss-name');
    if (bossNameEl) bossNameEl.innerText = currentHeresy.boss.toUpperCase() + " (" + currentHeresy.name + ")";

    const rowsBox = document.getElementById('hud-squad-status-rows');
    if (rowsBox) {
        rowsBox.innerHTML = '';
        selectedSquad.forEach(t => {
            let statusPrefix = t.currentHP <= 0 ? "[TYSTAD] " : "";
            let hpPct = Math.max(0, (t.currentHP / t.maxHP) * 100);
            let shieldHTML = t.shieldPool > 0 ? `🛡️${t.shieldPool}` : '';
            
            let deSlotsHTML = '';
            let maxVisualSlots = Math.max(t.startDE, t.currentDE, 3); 
            for (let i = 0; i < maxVisualSlots; i++) {
                deSlotsHTML += (i < t.currentDE) ? '◆' : '◇';
            }

            rowsBox.innerHTML += `
                <div class="hud-party-row ${t.currentHP <= 0 ? 'dead' : ''}">
                    <div class="hud-party-name" title="${t.name}">${statusPrefix}${t.name}</div>
                    <div class="hud-shield-status">${shieldHTML}</div>
                    <div class="hud-hp-bar-container">
                        <div class="hud-hp-bar-fill" style="width: ${hpPct}%;"></div>
                        <div class="hud-hp-bar-label">${t.currentHP}/${t.maxHP}</div>
                    </div>
                    <div class="hud-de-status">${deSlotsHTML}</div>
                </div>`;
        });
    }
    
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
                    subActionsEl.style.display = 'grid'; subActionsEl.style.gridTemplateColumns = '1fr 1fr'; subActionsEl.style.gap = '6px';
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_laran', ${teolog.id})"><span>⚔️ Angrip Läran</span><span style="color:#ffff55;">INT: +${teolog.int}</span></button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_struktur', ${teolog.id})"><span>🔨 Sänk Struktur</span><span style="color:#ffff55;">STR: +${teolog.str}</span></button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_legitimer', ${teolog.id})"><span>⚖️ Sänk Legitimitet</span><span style="color:#ffff55;">WIS: +${teolog.wis}</span></button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_foljare', ${teolog.id})"><span>📢 Omvänd Följare</span><span style="color:#ffff55;">CHA: +${teolog.cha}</span></button>`;
                } else {
                    subActionsEl.style.display = 'grid'; subActionsEl.style.gridTemplateColumns = '1fr';
                    if (aktivSubMeny === 'skills') {
                        subActionsEl.innerHTML = `<button class="action-node-btn" onclick="hanteraSpelarHandling('skills', ${teolog.id})"><span>⚡ SIGNATUR: ${teolog.deHandlingNamn}</span><span style="color:#00ccff;">-${teolog.deKostnad} DE</span></button>`;
                    } else if (aktivSubMeny === 'defend') {
                        let label = "Samla tankarna (Hela 5 HP)";
                        if (teolog.klass === "Herde") label = "Helande ord (Hela truppen)";
                        else if (teolog.klass === "Apostel") label = "Trons sköld (Skapa absorpsköld)";
                        subActionsEl.innerHTML = `<button class="action-node-btn" onclick="hanteraSpelarHandling('defend', ${teolog.id})"><span>🛡️ ${label}</span><span style="color:#55ffff;">Mekanik: ${teolog.klass}</span></button>`;
                    } else if (aktivSubMeny === 'items') {
                        subActionsEl.innerHTML = `<div style="font-size:11px; color:#555; padding:8px; font-style:italic;">[ Saknar föremål i kistan just nu ]</div>`;
                    }
                }
            }
        } else {
            activeNameEl.innerText = "TUR: " + activeUnit.name.toUpperCase();
            activeNameEl.style.color = activeUnit.id === "lair" ? "#ff5555" : "#ffaa00";
            subActionsEl.style.display = 'grid'; subActionsEl.style.gridTemplateColumns = '1fr';
            subActionsEl.innerHTML = `<div style="font-size:11px; color:#ffff55; padding:8px; font-style:italic;">Heresin utför sitt drag...</div>`;
        }
    }
    ritaTidslinje();
}

window.registreraSpelare = registreraSpelare;
window.valjHeresiUtmaning = valjHeresiUtmaning;
window.filtreraMentalitet = filtreraMentalitet;
window.klickaTeologSynod = klickaTeologSynod;
window.bekraftaRekrytering = bekraftaRekrytering;
window.taBortFranSquad = taBortFranSquad;
window.initieraD20Strid = initieraD20Strid;
window.bytSubMeny = bytSubMeny;
window.hanteraSpelarHandling = hanteraSpelarHandling;
