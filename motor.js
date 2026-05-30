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
    } else {
        console.log(`Anatema Systemlogg: ${msg}`);
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
// 4. STRIDSMOTOR & TURORDNING
// ==========================================
function initieraD20Strid() {
    try {
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
            if (foerstaEnhet.id === "boss") {
                setTimeout(exekveraBossTur, 1200);
            } else if (foerstaEnhet.id === "lair") {
                setTimeout(exekveraLairAction, 1200);
            }
        }
    } catch (err) {
        console.error(err);
        alert("Fel i disputations-uppstarten: " + err.message);
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
    try {
        let levandeApologeter = selectedSquad.filter(s => s.currentHP > 0);
        if (levandeApologeter.length === 0) return;
        
        let mltavla = levandeApologeter[Math.floor(Math.random() * levandeApologeter.length)];
        let skada = Math.floor(Math.random() * 6) + 6; 
        
        // Särskild passiv: Nyateismens skada skalar med mängden följare
        if (currentHeresy.id === "nyateism") {
            skada += Math.floor(heresyFollowersPct / 10);
        }
        
        mltavla.currentHP = Math.max(0, mltavla.currentHP - skada);
        window.logSpelBatalj(`[BOSS TUR] ${currentHeresy.boss} attackerar med kätterska argument! ${mltavla.name} tappar ${skada} HP.`);
        
        kontrolleraMatchSlut();
        nastaTur();
    } catch (err) {
        window.logSpelBatalj(`⚠️ FEL I BOSSTUR: ${err.message}`);
        nastaTur();
    }
}

function exekveraLairAction() {
    try {
        window.logSpelBatalj(`[LAIR PHASE] Massornas dragkamp aktiveras!`);
        truppDisadvantage = false;
        truppParalyserad = false;

        if (heresyFollowersPct <= 35) {
            window.logSpelBatalj(`⚠️ ${currentHeresy.lairActions.drev}`);
            truppDisadvantage = true;
        } else if (heresyFollowersPct > 35 && heresyFollowersPct <= 75) {
            let xSkadaBase = Math.floor(heresyFollowersPct / 5) + 4; 
            
            let råText = currentHeresy.lairActions.han || "Truppen tar [X] HP i skada.";
            let dynamicText = råText.replace("[X]", xSkadaBase);
            window.logSpelBatalj(`💥 ${dynamicText}`);
            
            selectedSquad.forEach(t => {
                if (t.currentHP > 0) {
                    let nuvarandeSkada = xSkadaBase;
                    if (t.shieldPool > 0) {
                        if (t.shieldPool >= nuvarandeSkada) { 
                            t.shieldPool -= nuvarandeSkada; 
                            nuvarandeSkada = 0; 
                        } else { 
                            nuvarandeSkada -= t.shieldPool; 
                            t.shieldPool = 0; 
                        }
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
    } catch (err) {
        window.logSpelBatalj(`⚠️ FEL I LAIR ACTION: ${err.message}`);
        nastaTur();
    }
}

// ==========================================
// 5. STRIDSHANDLINGAR (MED STRATEGISKA MÅL)
// ==========================================
function hanteraSpelarHandling(handlingTyp, teologId) {
    let t = selectedSquad.find(s => s.id === teologId);
    if (!t || t.currentHP <= 0) return;

    if (truppParalyserad) {
        window.logSpelBatalj(`${t.name} är paralyserad av tidsandan och kan inte tala!`);
        nastaTur(); return;
    }

    // D&D-TÄRNINGSMOTOR
    let rullning1 = Math.floor(Math.random() * 20) + 1;
    let rullning2 = Math.floor(Math.random() * 20) + 1;
    let d20 = rullning1;

    // Särskild passiv: Ikonoklasmen straffar Lärare/Herde om deras Struktur är aktiv
    let harIkonoklastStraff = (currentHeresy.id === "ikonoklasmen" && pHeresyStr > 0 && (t.klass === "Lärare" || t.klass === "Herde"));
    
    if (truppDisadvantage) {
        d20 = Math.min(rullning1, rullning2);
        window.logSpelBatalj(`[DISADVANTAGE] Rullar två tärningar (${rullning1}, ${rullning2}). Väljer: ${d20}`);
    }

    if (d20 === 1) {
        window.logSpelBatalj(`[NAT 1] ${t.name} snubblar katastrofalt på orden! Handlingen misslyckas.`);
        nastaTur(); return;
    }
    
    let isCrit = (d20 === 20);
    if (isCrit) window.logSpelBatalj(`[NAT 20] Perfekt replik! ${t.name} utropar: "${t.citat[0]}"`);

    // HÄR KÖRS DET NYA STRATEGISKA TARGET-SYSTEMET:
    if (handlingTyp === 'attack_laran') {
        // PASSIV KONTROLL: Pelagianismen blockerar Läran helt om de har Legitimitet kvar
        if (currentHeresy.id === "pelagianism" && pHeresyLeg > 0) {
            window.logSpelBatalj(`[IMMUNITET] Pelagius heliga anseende skyddar deras Lära! Du måste sänka deras LEGITIMITET först!`);
            nastaTur(); return;
        }

        let basTarning = (t.klass === "Lärare") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let modifierare = t.int - (harIkonoklastStraff ? 2 : 0);
        let skada = basTarning + modifierare;
        if (isCrit) skada = (basTarning * 2) + modifierare;
        if (skada < 1) skada = 1;

        // PASSIV KONTROLL: Det trilinguala heresiet motstår 75% av skadan vid hög legitimitet
        if (currentHeresy.id === "trilingual" && pHeresyLeg > 30) {
            skada = Math.max(1, Math.floor(skada * 0.25));
            window.logSpelBatalj(`[MOTSTÅND] Uråldrig språklig status absorberar skadan.`);
        }

        pHexLaransHP = pHeresyLar;
        pHeresyLar = Math.max(0, pHeresyLar - skada);
        window.logSpelBatalj(`${t.name} angriper Lärans kärna med Logos och gör ${skada} skada.`);

        // PASSIV KONTROLL: Donatismen bygger struktur när man skadar deras lära
        if (currentHeresy.id === "donatism" && pHeresyStr > 0) {
            pHeresyStr = Math.min(pMaxStr, pHeresyStr + 5);
            window.logSpelBatalj(`Donatisterna utnyttjar din attack för att stärka sin organisation (+5 STRUKTUR)!`);
        }

    } else if (handlingTyp === 'attack_struktur') {
        let basTarning = (t.klass === "Apostel") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let skada = basTarning + t.str;
        if (isCrit) skada = (basTarning * 2) + t.str;
        if (skada < 1) skada = 1;

        pHeresyStr = Math.max(0, pHeresyStr - skada);
        window.logSpelBatalj(`${t.name} saboterar heresiens nätverk och sänker STRUKTUREN med ${skada} punkter.`);

    } else if (handlingTyp === 'attack_legitimer') {
        let basTarning = (t.klass === "Herde") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let modifierare = t.wis - (harIkonoklastStraff ? 2 : 0);
        let skada = basTarning + modifierare;
        if (isCrit) skada = (basTarning * 2) + modifierare;
        if (skada < 1) skada = 1;

        pHeresyLeg = Math.max(0, pHeresyLeg - skada);
        window.logSpelBatalj(`${t.name} blottar heresiens moraliska brister och sänker LEGITIMITETEN med ${skada}.`);

    } else if (handlingTyp === 'attack_foljare') {
        let basTarning = (t.klass === "Evangelist") ? (Math.floor(Math.random() * 6) + 1) : (Math.floor(Math.random() * 4) + 1);
        
        // PASSIV KONTROLL: Gnosticismen ger permanent straff på apologeternas pathos-vädjanden
        let gnostikerStraff = (currentHeresy.id === "gnosticism") ? 4 : 0;
        let effekt = basTarning + t.cha - gnostikerStraff;
        if (isCrit) effekt = (basTarning * 2) + t.cha - gnostikerStraff;
        if (effekt < 1) effekt = 1;

        heresyFollowersPct = Math.max(0, heresyFollowersPct - effekt);
        window.logSpelBatalj(`${t.name} talar till folkmassan med Pathos och omvänder ${effekt}% av FÖLJARNA.`);

    } else if (handlingTyp === 'skills') {
        if (t.currentDE < t.deKostnad) {
            window.logSpelBatalj(`${t.name} saknar DE för att aktivera ${t.deHandlingNamn}!`);
            return; 
        }
        t.currentDE -= t.deKostnad;
        window.logSpelBatalj(`[SKILL] ${t.name} dundrar ut: "${t.deHandlingNamn}"!`);
        
        // Slå sönder lite av varje som en kraftfull JRPG-skill
        pHeresyLar = Math.max(0, pHeresyLar - 15);
        pHeresyStr = Math.max(0, pHeresyStr - 10);
        pHeresyLeg = Math.max(0, pHeresyLeg - 10);
        heresyFollowersPct = Math.max(0, heresyFollowersPct - 15);

    } else if (handlingTyp === 'defend') {
        if (t.klass === "Herde") {
            let heal = Math.floor(Math.random() * 6) + 1 + t.wis; 
            selectedSquad.filter(s => s.currentHP > 0).forEach(s => s.currentHP = Math.min(s.maxHP, s.currentHP + heal));
            window.logSpelBatalj(`${t.name} utguter helande ord. Truppen återfår ${heal} HP.`);
        } else if (t.klass === "Apostel") {
            let skold = Math.floor(Math.random() * 8) + 1 + t.str; 
            t.shieldPool += skold;
            window.logSpelBatalj(`${t.name} reser en Trons sköld som skyddar truppen mot ${skold} skada.`);
        } else {
            t.currentHP = Math.min(t.maxHP, t.currentHP + 5);
            window.logSpelBatalj(`${t.name} samlar sig i tyst bön och helar 5 HP.`);
        }
    }

    kontrolleraMatchSlut();
    nastaTur();
}

function kontrolleraMatchSlut() {
    if (heresyFollowersPct >= 100) {
        window.logSpelBatalj(`[KATASTROF] 100% av folket har förletts.`);
        alert("Kätterskt Game Over!");
        location.reload();
    } else if (pHeresyLar <= 0) {
        window.logSpelBatalj(`[SEGER] ${currentHeresy.name} är krossat!`);
        alert("Ortodoxin segrar!");
        location.reload();
    } else if (selectedSquad.every(s => s.currentHP <= 0)) {
        window.logSpelBatalj(`[NEDERLAG] Din synod har tystats.`);
        alert("Synoden föll!");
        location.reload();
    }
}

function nastaTur() {
    activeQueueIndex = (activeQueueIndex + 1) % combatQueue.length;
    if (activeQueueIndex === 0) {
        combatRound++;
        truppParalyserad = false; 

        // RUNDBASERAD EFFEKT: Valdensianismen & Arianismen sprider sitt inflytande exponentiellt över tid
        if (currentHeresy.id === "valdensianism" || currentHeresy.id === "arianism") {
            let tillvaxt = Math.floor(combatRound * 1.5) + 3;
            heresyFollowersPct = Math.min(100, heresyFollowersPct + tillvaxt);
            window.logSpelBatalj(`[TIDSANDA] ${currentHeresy.boss} slagord ekar på gatorna! Kätteriets inflytande ökar med ${tillvaxt}%.`);
        }
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
// 6. DYNAMISK JRPG RENDERING AV TARGETS
// ==========================================
function uppdateraUXGranssnitt() {
    if (!currentHeresy) return;
    
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
                
                // OM ANFALL VALTS: Rita ut det fullständiga 2x2 JRPG-rutnätet för strategiska val
                if (aktivSubMeny === 'attack') {
                    subActionsEl.style.display = 'grid';
                    subActionsEl.style.gridTemplateColumns = '1fr 1fr';
                    subActionsEl.style.gap = '6px';
                    
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_laran', ${teolog.id})">
                            <span>⚔️ Angrip Läran</span>
                            <span style="color:#ffff55;">INT: +${teolog.int}</span>
                        </button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_struktur', ${teolog.id})">
                            <span>🔨 Sänk Struktur</span>
                            <span style="color:#ffff55;">STR: +${teolog.str}</span>
                        </button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_legitimer', ${teolog.id})">
                            <span>⚖️ Sänk Legitimitet</span>
                            <span style="color:#ffff55;">WIS: +${teolog.wis}</span>
                        </button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('attack_foljare', ${teolog.id})">
                            <span>📢 Omvänd Följare</span>
                            <span style="color:#ffff55;">CHA: +${teolog.cha}</span>
                        </button>
                    `;
                } else {
                    // Återställ till standardlista vid andra menyer
                    subActionsEl.style.display = 'grid';
                    subActionsEl.style.gridTemplateColumns = '1fr';
                    
                    if (aktivSubMeny === 'skills') {
                        subActionsEl.innerHTML = `
                            <button class="action-node-btn" onclick="hanteraSpelarHandling('skills', ${teolog.id})">
                                <span>⚡ SIGNATUR: ${teolog.deHandlingNamn}</span>
                                <span style="color:#00ccff;">-${teolog.deKostnad} DE</span>
                            </button>`;
                    } else if (aktivSubMeny === 'defend') {
                        let label = "Samla tankarna (Hela 5 HP)";
                        if (teolog.klass === "Herde") label = "Helande ord (Hela truppen)";
                        else if (teolog.klass === "Apostel") label = "Trons sköld (Skapa absorpskold)";
                        
                        subActionsEl.innerHTML = `
                            <button class="action-node-btn" onclick="hanteraSpelarHandling('defend', ${teolog.id})">
                                <span>🛡️ ${label}</span>
                                <span style="color:#55ffff;">Mekanik: ${teolog.klass}</span>
                            </button>`;
                    } else if (aktivSubMeny === 'items') {
                        subActionsEl.innerHTML = `<div style="font-size:11px; color:#555; padding:8px; font-style:italic;">[ Saknar föremål i kistan just nu ]</div>`;
                    }
                }
            }
        } else {
            activeNameEl.innerText = "TUR: " + activeUnit.name.toUpperCase();
            activeNameEl.style.color = activeUnit.id === "lair" ? "#ff5555" : "#ffaa00";
            subActionsEl.style.display = 'grid';
            subActionsEl.style.gridTemplateColumns = '1fr';
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
