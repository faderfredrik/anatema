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
let heresyFollowersPct = 40; // Ersätter gamla "heresyTugPct" / Mätaren för "Anhängarna"
let truppDisadvantage = false;

// --- 1. LADDA IN DATA FRÅN JSON (SKAFFERIET) ---
async function laddaSpelData() {
    try {
        const teologerRes = await fetch('teologer.json');
        globalTeologer = await teologRes.json();
        
        const heresierRes = await fetch('heresier.json');
        globalHeresier = await heresierRes.json();
        
        console.log("Skafferiet är laddat! Teologer och Heresier är redo.");
        // Här kan vi trigga din startskärms-UI sen
    } catch (error) {
        console.error("Kunde inte ladda JSON-datafilerna:", error);
    }
}

// Kör igång laddningen direkt när motorn vaknar
window.addEventListener('DOMContentLoaded', laddaSpelData);


// --- 2. DEN DOLDA D20-MOTORN ---
function rollD20(advantageState = "normal") {
    let roll1 = Math.floor(Math.random() * 20) + 1;
    let roll2 = Math.floor(Math.random() * 20) + 1;
    
    let finalDie = roll1;
    if (advantageState === "advantage") {
        finalDie = Math.max(roll1, roll2);
    } else if (advantageState === "disadvantage") {
        finalDie = Math.min(roll1, roll2);
    }
    
    return {
        dieValue: finalDie,
        isCrit: finalDie === 20,
        isFumble: finalDie === 1
    };
}

// Hjälpfunktion för att slå skadetärningar under huven
function rullaKlassEffekt(klass) {
    // Lärare & Apostlar kör d8, Herder & Evangelister kör d6 enligt briefen
    if (klass === "Lärare" || klass === "Apostel") {
        return Math.floor(Math.random() * 8) + 1;
    } else {
        return Math.floor(Math.random() * 6) + 1;
    }
}


// --- 3. EXEKVERA GRUNDHANDLINGAR ---
function executeTeologGrundHandling(teolog, handlingstyp) {
    // 1. Kolla om truppen är drabbad av ett medialt drev (Disadvantage)
    let tillstand = truppDisadvantage ? "disadvantage" : "normal";
    let tarningsSlag = rollD20(tillstand);
    
    // 2. Retoriskt Snedsteg (Nat 1) - Handlingen misslyckas helt
    if (tarningsSlag.isFumble) {
        logSpelBatalj(`⚠️ RETORISKT SNEDSTEG! <strong>${teolog.name}</strong> misstolkas av massorna. Handlingen tappar all kraft denna runda.`);
        avanceraTurOrdning();
        return;
    }
    
    // 3. Räkna ut skada/effekt med dolda modifierare (Stat + Klassbonus på +2)
    let statMod = 0;
    if (handlingstyp === "laran") statMod = teolog.stats.int;
    else if (handlingstyp === "massorna") statMod = teolog.stats.cha;
    else if (handlingstyp === "strukturen") statMod = teolog.stats.cha; // Bonifatius m.fl.
    else if (handlingstyp === "legitimiteten") statMod = teolog.stats.cha; // Bonhoeffer m.fl.
    else if (handlingstyp === "heal") statMod = teolog.stats.wis;
    else if (handlingstyp === "shield") statMod = teolog.stats.str;

    let grundEffekt = rullaKlassEffekt(teolog.klass);
    let totalEffekt = grundEffekt + statMod;
    
    // 4. Hantera Perfekt Argument (Crit / Nat 20) - Dubbel effekt!
    if (tarningsSlag.isCrit) {
        totalEffekt = (grundEffekt * 2) + statMod;
        // Plocka ett slumpmässigt legendariskt citat om det finns i JSON
        if (teolog.citat && teolog.citat.length > 0) {
            let valtCitat = teolog.citat[Math.floor(Math.random() * teolog.citat.length)];
            logSpelBatalj(`<span class="text-quote">⭐ <strong>${teolog.name}</strong> utbrister: "${valtCitat}"</span>`);
        }
    }
    
    // Säkra att effekten aldrig blir mindre än 1 poäng på grund av minusstats
    totalEffekt = Math.max(1, totalEffekt);

    // 5. Applicera effekten på rätt mätare
    if (handlingstyp === "laran") {
        // Kontrollera om heresin har Pelagianismens egenkraftsköld aktiv
        if (currentHeresy.id === "pelagianism" && pHeresyLeg > 0) {
            logSpelBatalj(`🛡️ <strong>Pelagius</strong> hånar er! Hans centrala LÄRA är helt immun så länge heresiens Legitimitet står på benen.`);
        } else {
            pHeresyLar = Math.max(0, pHeresyLar - totalEffekt);
            if (tarningsSlag.isCrit) {
                logSpelBatalj(`⭐ <strong>PERFEKT ARGUMENT!</strong> <strong>${teolog.name}</strong> blottar heresiens svaghet! Kärnan tar ${totalEffekt} skada.`);
            } else {
                logSpelBatalj(`📜 <strong>${teolog.name}</strong> attackerar Kärnan med ett Logos-argument! Heresins lära tar ${totalEffekt} skada.`);
            }
        }
    } 
    else if (handlingstyp === "massorna") {
        // Kolla Gnosticismens modifierare (-4 på slag)
        if (currentHeresy.id === "gnosticism") {
            totalEffekt = Math.max(1, totalEffekt - 4);
        }
        heresyFollowersPct = Math.max(0, heresyFollowersPct - totalEffekt);
        if (tarningsSlag.isCrit) {
            logSpelBatalj(`⭐ <strong>PERFEKT ARGUMENT!</strong> <strong>${teolog.name}</strong> väcker massorna ur deras villfarelse! Heresins inflytande minskar dramatiskt med ${totalEffekt}%.`);
        } else {
            logSpelBatalj(`👥 <strong>${teolog.name}</strong> talar till folket med en Pathos-vädjan! Heresins inflytande över följarskaran minskar med ${totalEffekt}%.`);
        }
    }
    // Fler handlingar (strukturen, legitimiteten, heal, shield) expanderas här i fas 2
    
    uppdateraUXGranssnitt();
    setTimeout(avanceraTurOrdning, 1000);
}


// --- 4. LAIR ACTIONS (INITIATIVE 20) ---
function executeLairAction() {
    // Slumpar fram 1 av de 3 universella Lair Actions
    let actionSlump = Math.floor(Math.random() * 3) + 1;
    
    if (actionSlump === 1) {
        // Det publika drevet
        truppDisadvantage = true;
        let drevText = currentHeresy.lairActions.drev;
        logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${drevText}`);
    } 
    else if (actionSlump === 2) {
        // Massornas hån (Skalar med heresiens inflytande)
        let dmg = 3;
        let hanText = currentHeresy.lairActions.han.replace("[X]", "3");
        
        if (heresyFollowersPct >= 75) {
            dmg = 15;
            hanText = `Heresin har över 75% inflytande! Skaran piskar upp en upploppsstämning och gör 15 HP i skada, samt dränerar 1 DE!`;
            draeneraDogmatiskEnergiFranSquad();
        } else if (heresyFollowersPct >= 50) {
            dmg = 8;
            hanText = currentHeresy.lairActions.han.replace("[X]", "8") + " Följarskaran växer sig alltmer aggressiv.";
        }
        
        skadaHelaTruppen(dmg);
        logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${hanText}`);
    } 
    else if (actionSlump === 3) {
        // Den dominerande tidsandan (Paralysering / Stun)
        if (heresyFollowersPct >= 75) {
            paralyseraHelaTruppen();
            let tidsandaText = currentHeresy.lairActions.tidsanda;
            logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> ${tidsandaText}`);
        } else if (heresyFollowersPct >= 50) {
            paralyseraXTeologer(2);
            logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> Den sekulära tidsandan breder ut sig. De två långsammaste apologeterna blir paralyserade och förlorar sina turer.`);
        } else {
            paralyseraXTeologer(1);
            logSpelBatalj(`🚨 <strong>[LAIR ACTION]</strong> En heretisk våg skapar osäkerhet. Truppens långsammaste apologet tappar fattningen och förlorar sin tur.`);
        }
    }

    uppdateraUXGranssnitt();
    setTimeout(avanceraTurOrdning, 1200);
}


// --- HJÄLPFUNKTIONER FÖR STRIDSLOOP (MOCKUPS FÖR UX-KOPPLING) ---
function logSpelBatalj(msg) {
    console.log(msg); // Kastar ut i konsolen tills vi kopplar på HTML-loggen
}
function uppdateraUXGranssnitt() {
    // Den här funktionen kommer uppdatera HP-bars och Dragkamps-stapeln i HTML sen
}
function avanceraTurOrdning() {
    activeQueueIndex++;
    // Logik för att stega vidare i loopen
}
function skadaHelaTruppen(mängd) {}
function draeneraDogmatiskEnergiFranSquad() {}
function paralyseraHelaTruppen() {}
function paralyseraXTeologer(antal) {}
