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

// Intern spårare för runda-rubriker
let lastLoggedRound = 0;

// ==========================================
// 0. RETROSÄKRAD OCH FORMATERAD LOGGFUNKTION
// ==========================================
function logSpelBatalj(msg, typ = 'neutral') {
    const logBox = document.getElementById('hud-battle-log') || document.getElementById('disputation-log');
    if (logBox) {
        if (combatRound !== lastLoggedRound) {
            logBox.innerHTML += `<div class="log-entry neutral" style="text-align: center; margin: 15px 0; font-weight: bold; border-bottom: 1px dashed #555; padding-bottom: 6px; color: #ffff55;">----- RUNDA ${combatRound} -----</div>`;
            lastLoggedRound = combatRound;
        }
        logBox.innerHTML += `<div class="log-entry ${typ}">${msg}</div>`;
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
// 4. STRIDSMOTOR & AKTIVERING
// ==========================================
function initieraD20Strid() {
    if (selectedSquad.length === 0) return;
    pMaxLar = 150; pHeresyLar = pMaxLar;
    pMaxStr = 50; pHeresyStr = pMaxStr;
    pMaxLeg = 60; pHeresyLeg = pMaxLeg;
    heresyFollowersPct = 40; 
    combatRound = 1;
    lastLoggedRound = 0; 
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
    window.logSpelBatalj(`MÖTET HAR BÖRJAT! Du konfronterar villoläran: ${currentHeresy.name}.`, 'neutral');
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
    
    window.logSpelBatalj(`${currentHeresy.boss} dundrar ut skarpa kätterska argument mot hela synoden!`, 'heresi');
    
    levande.forEach(mltavla => {
        let skada = Math.floor(Math.random() * 4) + 4; 
        if (currentHeresy.id === "nyateism") skada += Math.floor(heresyFollowersPct / 15);
        
        if (mltavla.shieldPool > 0) {
            if (mltavla.shieldPool >= skada) { mltavla.shieldPool -= skada; skada = 0; }
            else { skada -= mltavla.shieldPool; mltavla.shieldPool = 0; }
        }
        
        mltavla.currentHP = Math.max(0, mltavla.currentHP - skada);
        if (skada > 0) {
            window.logSpelBatalj(` > ${mltavla.name} tappar ${skada} HP.`, 'heresi');
        } else {
            window.logSpelBatalj(` > Trons sköld skyddade ${mltavla.name} helt mot argumentet!`, 'ortodox');
        }
    });

    kontrolleraMatchSlut();
    nastaTur();
}

function exekveraLairAction() {
    let dragkampText = "";
    if (heresyFollowersPct <= 20) {
        dragkampText = `Människor börjar tvivla på ${currentHeresy.boss} legitimitet. Heresins effekt är dämpad.`;
    } else if (heresyFollowersPct <= 40) {
        dragkampText = `Debatten väger svagt, men ortodoxins sanning håller massorna stabila.`;
    } else if (heresyFollowersPct <= 60) {
        dragkampText = `Heresins villolärosor sprids bland de osäkra i folkmassan.`;
    } else if (heresyFollowersPct <= 80) {
        dragkampText = `Heresin sprids med stor framgång och vilseleder allt fler själar!`;
    } else {
        dragkampText = `Ett heretiskt mörker sveper över massorna! Det andliga klimatet är kritiskt.`;
    }
    window.logSpelBatalj(dragkampText, 'heresi');

    truppDisadvantage = false;
    truppParalyserad = false;

    if (heresyFollowersPct <= 35) {
        window.logSpelBatalj(`⚠️ ${currentHeresy.lairActions.drev}`, 'heresi');
        window.logSpelBatalj(` Truppen drabbas av Disadvantage (Retorisk nackdel: tvingas välja det sämsta av två tärningsslag).`, 'heresi');
        truppDisadvantage = true;
    } else if (heresyFollowersPct > 35 && heresyFollowersPct <= 75) {
        let xSkadaBase = Math.floor(heresyFollowersPct / 5) + 4; 
        let dynamicText = (currentHeresy.lairActions.han || "Truppen tar [X] HP.").replace("[X]", xSkadaBase);
        window.logSpelBatalj(`💥 ${dynamicText}`, 'heresi');
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
        window.logSpelBatalj(`🚨 ${currentHeresy.lairActions.tidsanda}`, 'heresi');
        truppParalyserad = true;
    }
    kontrolleraMatchSlut();
    nastaTur();
}

// ==========================================
// 5. STRIDSHANDLINGAR (MED MÅLSÖKANDE DEFENDS)
// ==========================================
function hanteraSpelarHandling(handlingTyp, teologId) {
    let t = selectedSquad.find(s => s.id === teologId);
    if (!t || t.currentHP <= 0) return;

    if (truppParalyserad) { window.logSpelBatalj(`${t.name} är paralyserad av tidsandan och saknar röst!`, 'heresi'); nastaTur(); return; }

    // Steg 1: Logga vad som initieras
    if (handlingTyp === 'skills') {
        if (t.currentDE < t.deKostnad) { window.logSpelBatalj(`${t.name} saknar tillräcklig Dogmatisk Energi för att aktivera ${t.deHandlingNamn}!`, 'neutral'); return; }
        t.currentDE -= t.deKostnad;
        window.logSpelBatalj(`${t.name} använder: "${t.deHandlingNamn}"!`, 'ortodox');
    } else {
        let handlingsBeskrivning = "reser sig för att tala.";
        if (handlingTyp === 'attack_laran') handlingsBeskrivning = "angriper kätteriet.";
        else if (handlingTyp === 'attack_struktur') handlingsBeskrivning = "utmanar heresiens nätverk.";
        else if (handlingTyp === 'attack_legitimer') handlingsBeskrivning = "blottar heresiens moraliska brister.";
        else if (handlingTyp === 'attack_foljare') handlingsBeskrivning = "vänder sig till folkmassan.";
        // KORRIGERING: Tydligare, flytande försvarsannonseringar
        else if (handlingTyp === 'defend_olja') handlingsBeskrivning = "bereder en helig smörjelse.";
        else if (handlingTyp === 'defend_skold') handlingsBeskrivning = "reser ett andligt skyddsvärn.";
        
        window.logSpelBatalj(`${t.name} ${handlingsBeskrivning}`, 'neutral');
    }

    let rullning1 = Math.floor(Math.random() * 20) + 1;
    let rullning2 = Math.floor(Math.random() * 20) + 1;
    let d20 = rullning1;
    
    if (truppDisadvantage) {
        d20 = Math.min(rullning1, rullning2);
        window.logSpelBatalj(` > Retorisk nackdel tvingar fram två rullningar (${rullning1} och ${rullning2}). Väljer det lägsta: Slår ${d20}.`, 'neutral');
    }

    if (d20 === 1) { 
        if (handlingTyp === 'skills') {
            window.logSpelBatalj(` > Slår 1! En katastrofal miss under försöket att aktivera förmågan. ${t.name} snubblar helt på orden och den dogmatiska energin går förlorad i förvirringen.`, 'heresi');
        } else {
            window.logSpelBatalj(` > Slår 1! ${t.name} snubblar katastrofalt på orden och argumentet faller platt.`, 'heresi'); 
        }
        kontrolleraMatchSlut(); nastaTur(); return; 
    }

    let isCrit = (d20 === 20);
    if (isCrit) {
        window.logSpelBatalj(` > Slår 20! En perfekt replik, och utropar: "${t.citat[0] || 'För sanningen!'}"`, 'ortodox');
    }

    let harIkonoklastStraff = (currentHeresy.id === "ikonoklasmen" && pHeresyStr > 0 && (t.klass === "Lärare" || t.klass === "Herde"));

    // Attackvinklar
    if (handlingTyp === 'attack_laran') {
        if (currentHeresy.id === "pelagianism" && pHeresyLeg > 0) { window.logSpelBatalj(` > [IMMUNITET] Pelagius heliga anseende skyddar deras Lära! Du måste sänka deras LEGITIMITETEN först.`, 'heresi'); nastaTur(); return; }
        
        let basTarning = (t.klass === "Lärare") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let modifierare = t.int - (harIkonoklastStraff ? 2 : 0);
        let skada = basTarning + modifierare;
        if (isCrit) skada = ((t.klass === "Lärare") ? 8 : 4) + basTarning + modifierare + 5; 
        if (skada < 1) skada = 1;

        if (currentHeresy.id === "trilingual" && pHeresyLeg > 30) {
            skada = Math.max(1, Math.floor(skada * 0.25));
            window.logSpelBatalj(` > [MOTSTÅND] Uråldrig språklig status absorberar en del av skadan.`, 'heresi');
        }

        pHeresyLar = Math.max(0, pHeresyLar - skada);
        window.logSpelBatalj(` > Kärnan dekonstrueras med Logos och tillfogar ${skada} skada på Läran.`, 'ortodox');
        if (currentHeresy.id === "donatism" && pHeresyStr > 0) { pHeresyStr = Math.min(pMaxStr, pHeresyStr + 5); window.logSpelBatalj(` > Donatisterna utnyttjar situationen och stärker sin organisation (+5 STRUKTUR)!`, 'heresi'); }
        
    } else if (handlingTyp === 'attack_struktur') {
        let basTarning = (t.klass === "Apostel") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let skada = basTarning + t.str;
        if (isCrit) skada = ((t.klass === "Apostel") ? 8 : 4) + basTarning + t.str + 5;
        if (skada < 1) skada = 1;

        pHeresyStr = Math.max(0, pHeresyStr - skada);
        window.logSpelBatalj(` > Det heretiska nätverket raserar och sänker dess struktur med ${skada} punkter.`, 'ortodox');
        
    } else if (handlingTyp === 'attack_legitimer') {
        let basTarning = (t.klass === "Herde") ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 4) + 1);
        let modifierare = t.wis - (harIkonoklastStraff ? 2 : 0);
        let skada = basTarning + modifierare;
        if (isCrit) skada = ((t.klass === "Herde") ? 8 : 4) + basTarning + modifierare + 5;
        if (skada < 1) skada = 1;

        pHeresyLeg = Math.max(0, pHeresyLeg - skada);
        window.logSpelBatalj(` > Det kätterska anseendet krackelerar och sänker legitmiteten med ${skada} punkter.`, 'ortodox');
        
    } else if (handlingTyp === 'attack_foljare') {
        let basTarning = (t.klass === "Evangelist") ? (Math.floor(Math.random() * 6) + 1) : (Math.floor(Math.random() * 4) + 1);
        let effekt = basTarning + t.cha;
        if (currentHeresy.id === "gnosticism") effekt = Math.max(1, effekt - 4);
        if (isCrit) effekt = ((t.klass === "Evangelist") ? 6 : 4) + basTarning + t.cha + 5;
        if (effekt < 1) effekt = 1;

        heresyFollowersPct = Math.max(0, heresyFollowersPct - effekt);
        window.logSpelBatalj(` > Orden träffar rätt! En kraftfull väckelse skakar om gatorna och omvänder ${effekt}% av heresins följare.`, 'ortodox');
        
    } else if (handlingTyp === 'skills') {
        if (t.klass === "Lärare") {
            let dmg = 25 + (t.int * 3);
            pHeresyLar = Math.max(0, pHeresyLar - dmg);
            window.logSpelBatalj(` ⚡ En intellektuell dekonstruktion krossar heresiens kärna och tillfogar ${dmg} skada på Läran.`, 'ortodox');
        } else if (t.klass === "Evangelist") {
            let pct = 20 + (t.cha * 3);
            heresyFollowersPct = Math.max(0, heresyFollowersPct - pct);
            window.logSpelBatalj(` ⚡ En kraftfull väckelse skakar om gatorna och omvänder ${pct}% av heresins följare.`, 'ortodox');
        } else if (t.klass === "Herde") {
            let legDmg = 20 + (t.wis * 2);
            pHeresyLeg = Math.max(0, pHeresyLeg - legDmg);
            let levande = selectedSquad.filter(s => s.currentHP > 0);
            let sårbar = levande.reduce((min, curr) => curr.currentHP < min.currentHP ? curr : min, levande[0]);
            sårbar.currentHP = Math.min(sårbar.maxHP, sårbar.currentHP + 20);
            window.logSpelBatalj(` ⚡ Herdens omsorg underminerar heresiens moral (-${legDmg} Legitimitet) och smörjer ${sårbar.name === t.name ? 'sig själv' : sårbar.name} med Helig olja (+20 HP).`, 'ortodox');
        } else if (t.klass === "Apostel") {
            let strDmg = 15 + (t.str * 2);
            pHeresyStr = Math.max(0, pHeresyStr - strDmg);
            let levande = selectedSquad.filter(s => s.currentHP > 0);
            let sårbar = levande.reduce((min, curr) => curr.currentHP < min.currentHP ? curr : min, levande[0]);
            sårbar.shieldPool += 20;
            window.logSpelBatalj(` ⚡ Trons fasta grund raserar heresiens nätverk (-${strDmg} Struktur) och reser en Trons sköld framför ${sårbar.name} (+20 Sköld).`, 'ortodox');
        }

    // KORRIGERING: Två fristående och fullt skalbara bas-actions för Defend (Olja och Sköld)
    } else if (handlingTyp === 'defend_olja') {
        let levande = selectedSquad.filter(s => s.currentHP > 0);
        let sårbar = levande.reduce((min, curr) => curr.currentHP < min.currentHP ? curr : min, levande[0]);
        
        let basTarning = Math.floor(Math.random() * 6) + 1; // d6 bas
        let bonus = t.wis + (t.klass === "Herde" ? 5 : 0); // WIS-mod + Herde klassbonus
        let heal = basTarning + bonus;
        if (isCrit) heal = 6 + basTarning + bonus + 5; // Nat 20 maximerar tärningen
        if (heal < 1) heal = 1;

        sårbar.currentHP = Math.min(sårbar.maxHP, sårbar.currentHP + heal);
        let mottagare = (sårbar.id === t.id) ? "sig själv" : sårbar.name;
        window.logSpelBatalj(` > Smörjer ${mottagare} med Helig olja och återupprättar ${heal} HP.`, 'ortodox');

    } else if (handlingTyp === 'defend_skold') {
        let levande = selectedSquad.filter(s => s.currentHP > 0);
        let sårbar = levande.reduce((min, curr) => curr.currentHP < min.currentHP ? curr : min, levande[0]);

        let basTarning = Math.floor(Math.random() * 6) + 1; // d6 bas
        let bonus = t.str + (t.klass === "Apostel" ? 5 : 0); // STR-mod + Apostel klassbonus
        let skold = basTarning + bonus;
        if (isCrit) skold = 6 + basTarning + bonus + 5; // Nat 20 maximerar tärningen
        if (skold < 1) skold = 1;

        sårbar.shieldPool += skold;
        let mottagare = (sårbar.id === t.id) ? "sig själv" : sårbar.name;
        window.logSpelBatalj(` > Reser Trons sköld framför ${mottagare} som absorberar upp till ${skold} inkommande skada.`, 'ortodox');
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
            window.logSpelBatalj(`Kätteriets inflytande på gatorna ökar naturligt med ${tillvaxt}%.`, 'heresi');
        }
    }
    
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
                } else if (aktivSubMeny === 'defend') {
                    // KORRIGERING: Defend-menyn renderas nu som ett 2x2 JRPG-rutnät för Olja och Sköld
                    subActionsEl.style.display = 'grid'; subActionsEl.style.gridTemplateColumns = '1fr 1fr'; subActionsEl.style.gap = '6px';
                    subActionsEl.innerHTML = `
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('defend_olja', ${teolog.id})"><span>❤️ Helig olja</span><span style="color:#55ffff;">WIS: +${teolog.wis}${teolog.klass === 'Herde' ? ' +5' : ''}</span></button>
                        <button class="action-node-btn" onclick="hanteraSpelarHandling('defend_skold', ${teolog.id})"><span>🛡️ Trons sköld</span><span style="color:#55ffff;">STR: +${teolog.str}${teolog.klass === 'Apostel' ? ' +5' : ''}</span></button>`;
                } else {
                    subActionsEl.style.display = 'grid'; subActionsEl.style.gridTemplateColumns = '1fr';
                    if (aktivSubMeny === 'skills') {
                        subActionsEl.innerHTML = `<button class="action-node-btn" onclick="hanteraSpelarHandling('skills', ${teolog.id})"><span>⚡ SIGNATUR: ${teolog.deHandlingNamn}</span><span style="color:#00ccff;">-${teolog.deKostnad} DE</span></button>`;
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
