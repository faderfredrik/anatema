// --- GLOBAL STATE FOR ANATEMA V2 ---
let globalTeologer = [];
let globalHeresier = [];
let currentHeresy = null;
let selectedSquad = [];
let combatQueue = [];
let activeQueueIndex = 0;
let combatRound = 1;

// Spelvariabler baserade på de 6 stenhårda pelarna
let pHeresyLar = 0, pMaxLar = 0;
let pHeresyStr = 0, pMaxStr = 0;
let pHeresyLeg = 0, pMaxLeg = 0;
let heresyFollowersPct = 40; 
let truppDisadvantage = false;

// --- 1. LADDA IN DATA FRÅN JSON (SKAFFERIET) ---
async function laddaSpelData() {
    try {
        const teologerRes = await fetch('teologer.json');
        globalTeologer = await teologerRes.json();
        
        const heresierRes = await fetch('heresier.json');
        globalHeresier = await heresierRes.json();
        
        console.log("Skafferiet synkat! V2-motorn redo.");
        
        // Låser upp knappen på startskärmen så fort JSON-datan laddats klart!
        const enterBtn = document.getElementById('start-enter-btn');
        if (enterBtn) enterBtn.disabled = false;
        
        const statusTxt = document.getElementById('loading-status');
        if (statusTxt) statusTxt.innerText = "Kyrkofäderna har samlats. Tryck ovan för att börja.";
        
    } catch (error) {
        console.error("Kunde inte ladda JSON-filer:", error);
        const statusTxt = document.getElementById('loading-status');
        if (statusTxt) statusTxt.innerText = "FEL: Kunde inte ladda speldata. Kontrollera dina JSON-filer.";
    }
}

// Startar igång dataladdningen direkt när sidan öppnas
window.addEventListener('DOMContentLoaded', laddaSpelData);

// Hjälpfunktion för att rigga en teststrid mot Nyateismen med 4 slumpade teologer
function startaTestStrid() {
    currentHeresy = globalHeresier.find(h => h.id === "nyateism") || globalHeresier[0];
    
    // Vi plockar ut de 4 första teologerna som ett test-team
    let testTeam = globalTeologer.slice(0, 4);
    
    selectedSquad = testTeam.map(t => {
        return {
            ...t,
            currentHP: t.con * 15 + 40, // Räknar ut en rimlig HP baserat på CON-stat
            maxHP: t.con * 15 + 40,
            currentDE: t.startDE,
            shieldPool: t.id === 7 ? 12 : 0 // Ger Amma Synkletika 12 i sköld som i din skiss!
        };
    });
    
    // Rigga heresi-bars
    pMaxLar = 150; pHeresyLar = 150;
    heresyFollowersPct = 40;
    
    // Starta rundan och rita gränssnittet
    byggInitiativKedja();
    uppdateraUXGranssnitt();
}


// --- 2. DEN DOLDA D20-MOTORN ---
function rollD20(advantageState = "normal") {
    let roll1 = Math.floor(Math.random() * 20) + 1;
    let roll2 = Math.floor(Math.random() * 20) + 1;
    
    let finalDie = roll1;
    if (advantageState === "advantage") finalDie = Math.max(roll1, roll2);
    else if (advantageState === "disadvantage") finalDie = Math.min(roll1, roll2);
    
    return {
        dieValue: finalDie,
        isCrit: finalDie === 20,
        isFumble: finalDie === 1
    };
}

function rullaKlassEffekt(klass) {
    if (klass === "Lärare" || klass === "Apostel") {
        return Math.floor(Math.random() * 8) + 1; // 1d8
    } else {
        return Math.floor(Math.random() * 6) + 1; // 1d6
    }
}


// --- 3. RENDERINGSMOTORN (KOPPLING TILL index_v2.html) ---
function uppdateraUXGranssnitt() {
    if (!currentHeresy || selectedSquad.length === 0) return;
    
    // A. Uppdatera den transparenta statusbaren för följare (Anhängarna)
    const followersBar = document.getElementById('influence-bar-fill');
    if (followersBar) {
        followersBar.style.width = `${heresyFollowersPct}%`;
    }
    
    // B. Hämta den teolog som har turen just nu ur kön
    let aktivEnhet = combatQueue[activeQueueIndex];
    let aktivTeolog = null;
    
    if (aktivEnhet && aktivEnhet.isPlayer) {
        aktivTeolog = selectedSquad.find(s => s.id === aktivEnhet.id);
    }
    
    // C. Rita upp din Squad-statusruta (Högst upp till höger i HUD)
    const partyHud = document.getElementById('party-hud-display');
    if (partyHud) {
        partyHud.innerHTML = ''; // Rensar gamla rader
        
        selectedSquad.forEach(t => {
            let skoldText = t.shieldPool > 0 ? `🛡️ ${t.shieldPool}` : ``;
            let hpPct = (t.currentHP / t.maxHP) * 100;
            let dePct = (t.currentDE / t.startDE) * 100;
            
            // Kolla om denna teolog har turen just nu för att highlighta namnet
            let aktivStil = (aktivTeolog && aktivTeolog.id === t.id) ? "style='color:#ffff55; border-color:#ffff55; background:rgba(255,255,85,0.1);'" : "";
            
            partyHud.innerHTML += `
                <div class="party-row" ${aktivStil}>
                    <div class="party-shield-slot">${skoldText}</div>
                    <div class="party-name">${t.name}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${hpPct}%;"></div>
                        <span class="bar-text">HP ${t.currentHP}/${t.maxHP}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill de" style="width: ${dePct}%;"></div>
                        <span class="bar-text">DE ${t.currentDE}/${t.startDE}</span>
                    </div>
                </div>
            `;
        });
    }
    
    // D. Rita upp Chained Echoes-kommandon (Vänster i HUD)
    const titleLabel = document.getElementById('active-char-title');
    const subCommandsDisplay = document.getElementById('sub-commands-display');
    
    if (aktivTeolog) {
        if (titleLabel) titleLabel.innerText = `Aktiv: ${aktivTeolog.name} (${aktivTeolog.klass})`;
        
        // Vi fyller sub-menyn med karaktärens grundhandlingar och unika Skill automatiskt från JSON!
        if (subCommandsDisplay) {
            subCommandsDisplay.innerHTML = `
                <button class="skill-btn" onclick="executeAction('laran')"><span>📜 Logos (Kärnan)</span></button>
                <button class="skill-btn" onclick="executeAction('massorna')"><span>👥 Pathos (Följare)</span></button>
                <button class="skill-btn" onclick="executeAction('skill')">
                    <span>✨ ${aktivTeolog.deHandlingNamn}</span>
                    <span class="skill-cost">${aktivTeolog.deKostnad} DE</span>
                </button>
            `;
        }
    } else {
        if (titleLabel) titleLabel.innerText = `Aktiv: FIENDE (Agerar...)`;
        if (subCommandsDisplay) subCommandsDisplay.innerHTML = `<div style="font-size:11px; opacity:0.5; padding:10px;">Väntar på kätteriets motdrag...</div>`;
    }
}


// --- 4. STRIDSLOOP & INITIATIVORDNING ---
function byggInitiativKedja() {
    combatQueue = [];
    
    // Lägg till fiendebossen på dess fasta Lair Action-initiativ (20)
    combatQueue.push({ isPlayer: false, name: currentHeresy.boss, init: 20 });
    
    // Lägg till spelarens teologer baserat på deras dolda snabbhet (DEX + d20-slump i bakgrunden)
    selectedSquad.forEach(t => {
        let doldSnabbhet = t.dex + Math.floor(Math.random() * 5); // Enkel slumpmod för initiativet
        combatQueue.push({ isPlayer: true, id: t.id, name: t.name, init: doldSnabbhet });
    });
    
    // Sortera kön så att högst initiativ agerar först
    combatQueue.sort((a, b) => b.init - a.init);
    activeQueueIndex = 0;
    
    ritaTidslinje();
}

function ritaTidslinje() {
    const timelineDisplay = document.getElementById('timeline-display');
    if (timelineDisplay) {
        timelineDisplay.innerHTML = '';
        combatQueue.forEach((enhet, index) => {
            let nodeKlass = "timeline-node";
            if (index === activeQueueIndex) nodeKlass += " active";
            if (!enhet.isPlayer) nodeKlass += " lair";
            
            // Förkorta namnet till 3 bokstäver för retro-looken i tidslinjen
            let kortNamn = enhet.name.substring(0, 3).toUpperCase();
            timelineDisplay.innerHTML += `<div class="${nodeKlass}">${kortNamn}</div>`;
        });
    }
}


// --- 5. HANDLINGSEXEKVERING (KLICK-EFFEKTER) ---
function executeAction(typ) {
    let aktivEnhet = combatQueue[activeQueueIndex];
    if (!aktivEnhet || !aktivEnhet.isPlayer) return;
    
    let teolog = selectedSquad.find(s => s.id === aktivEnhet.id);
    
    if (typ === "skill") {
        // Kontrollera om karaktären har råd med sin unika skill
        if (teolog.currentDE < teolog.deKostnad) {
            logSpelBatalj(`⚠️ <strong>${teolog.name}</strong> har inte tillräckligt med Dogmatisk Energi (DE)!`);
            return;
        }
        
        // Dränera energin och kör specialeffekten
        teolog.currentDE -= teolog.deKostnad;
        logSpelBatalj(`✨ <strong>${teolog.name}</strong> aktiverar [${teolog.deHandlingNamn}]! ${teolog.loggEffekt}`);
        
        // MOCKUP-EFFEKT: Vi drar lite skada på måfå för testets skull
        pHeresyLar = Math.max(0, pHeresyLar - 20);
        
    } else {
        // Kör grundhandling (Logos eller Pathos) via d20-motorn
        executeTeologGrundHandling(teolog, typ);
        return; // executeTeologGrundHandling sköter turskiftet själv efteråt
    }
    
    uppdateraUXGranssnitt();
    setTimeout(avanceraTurOrdning, 1000);
}

function executeTeologGrundHandling(teolog, handlingstyp) {
    let tillstand = truppDisadvantage ? "disadvantage" : "normal";
    let tarningsSlag = rollD20(tillstand);
    
    if (tarningsSlag.isFumble) {
        logSpelBatalj(`⚠️ <strong>RETORISKT SNEDSTEG!</strong> <strong>${teolog.name}</strong> misstolkas av massorna. Argumentet tappar all kraft.`);
        avanceraTurOrdning();
        return;
    }
    
    let statMod = handlingstyp === "laran" ? teolog.int : teolog.cha;
    let grundEffekt = rullaKlassEffekt(teolog.klass);
    let totalEffekt = grundEffekt + statMod + 2; // +2 klassbonus
    
    if (tarningsSlag.isCrit) {
        totalEffekt = (grundEffekt * 2) + statMod + 2;
        if (teolog.citat && teolog.citat.length > 0) {
            let valtCitat = teolog.citat[Math.floor(Math.random() * teolog.citat.length)];
            logSpelBatalj(`<span class="text-quote">⭐ <strong>${teolog.name}</strong> dundrar ut: "${valtCitat}"</span>`);
        }
    }
    
    totalEffekt = Math.max(1, totalEffekt);

    if (handlingstyp === "laran") {
        pHeresyLar = Math.max(0, pHeresyLar - totalEffekt);
        if (tarningsSlag.isCrit) {
            logSpelBatalj(`⭐ <strong>PERFEKT ARGUMENT!</strong> <strong>${teolog.name}</strong> blottar kätteriets svaghet! Kärnan tar ${totalEffekt} skada.`);
        } else {
            logSpelBatalj(`📜 <strong>${teolog.name}</strong> attackerar Kärnan med ett Logos-argument! Heresins lära tar ${totalEffekt} skada.`);
        }
    } 
    else if (handlingstyp === "massorna") {
        if (currentHeresy.id === "gnosticism") totalEffekt = Math.max(1, totalEffekt - 4);
        heresyFollowersPct = Math.max(0, heresyFollowersPct - totalEffekt);
        
        if (tarningsSlag.isCrit) {
            logSpelBatalj(`⭐ <strong>PERFEKT ARGUMENT!</strong> <strong>${teolog.name}</strong> omvänder massorna! Heresins inflytande rasar med ${totalEffekt}%.`);
        } else {
            logSpelBatalj(`👥 <strong>${teolog.name}</strong> talar till folket med en Pathos-vädjan! Heresins inflytande minskar med ${totalEffekt}%.`);
        }
    }
    
    uppdateraUXGranssnitt();
    setTimeout(avanceraTurOrdning, 1000);
}


// --- 6. LAIR ACTIONS & TURSKIFTEN ---
function avanceraTurOrdning() {
    activeQueueIndex++;
    if (activeQueueIndex >= combatQueue.length) {
        activeQueueIndex = 0;
        combatRound++;
        logSpelBatalj(`<strong>--- RUNDA ${combatRound} STARTAR ---</strong>`);
        // Här kan vi öka heresins inflytande automatiskt vid rundans slut
        byggInitiativKedja();
    }
    
    ritaTidslinje();
    uppdateraUXGranssnitt();
    
    // Kolla om det är heresiens tur på Initiative 20 (Lair Action!)
    let nastaEnhet = combatQueue[activeQueueIndex];
    if (nastaEnhet && !nastaEnhet.isPlayer) {
        setTimeout(executeLairAction, 1000);
    }
}

function executeLairAction() {
    let actionSlump = Math.floor(Math.random() * 3) + 1;
    
    if (actionSlump === 1) {
        truppDisadvantage = true;
        logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${currentHeresy.lairActions.drev}`);
    } 
    else if (actionSlump === 2) {
        let dmg = heresyFollowersPct >= 75 ? 15 : (heresyFollowersPct >= 50 ? 8 : 3);
        let txt = currentHeresy.lairActions.han.replace("[X]", dmg);
        if (heresyFollowersPct >= 75) txt = `Heresin har över 75% inflytande! Skaran piskar upp en upploppsstämning och gör 15 HP i skada på truppen, samt dränerar 1 DE!`;
        logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${txt}`);
    } 
    else if (actionSlump === 3) {
        if (heresyFollowersPct >= 75) {
            logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${currentHeresy.lairActions.tidsanda}`);
        } else {
            logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> En heretisk våg skapar osäkerhet i debattklimatet. Truppens långsammaste apologet tappar fattningen och förlorar sin tur.`);
        }
    }

    // Slut på Lair Action, gå vidare till nästa karaktär
    setTimeout(avanceraTurOrdning, 1200);
}

// Hjälpfunktion för att trycka ut all text direkt i din nya snygga HTML-debattlogg
function logSpelBatalj(msg) {
    const logBox = document.getElementById('disputation-log');
    if (logBox) {
        logBox.innerHTML += `<div>${msg}</div>`;
        logBox.scrollTop = logBox.scrollHeight; // Auto-scrollar loggen till botten
    }
}

// --- GÖR FUNKTIONERNA TILLGÄNGLIGA FÖR HTML-KNAPPARNA ---
window.registreraSpelare = registreraSpelare;
window.filtreraMentalitet = filtreraMentalitet;
window.klickaTeologSynod = klickaTeologSynod;
window.initieraD20Strid = initieraD20Strid;
window.bytSubMeny = bytSubMeny;
window.klickaSpelarHandling = klickaSpelarHandling;
