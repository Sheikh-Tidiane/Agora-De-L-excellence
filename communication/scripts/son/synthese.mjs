// Synthèse et traitement audio, en JavaScript pur : aucun son téléchargé, aucun fichier
// externe. Tout est déterministe (bruit à graine fixe) : un même script donne toujours
// exactement la même bande son.
//
// Une bande est un objet { taux, g, d } : taux d’échantillonnage et deux Float32Array.

export const TAUX = 48000;

export const nouvelleBande = (secondes, taux = TAUX) => {
  const n = Math.round(secondes * taux);
  return { taux, g: new Float32Array(n), d: new Float32Array(n) };
};

/** Bruit pseudo-aléatoire à graine fixe (mulberry32), dans [-1, 1]. */
export const hasard = (graine) => {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
};

export const dB = (db) => 10 ** (db / 20);

/** Ajoute un son mono dans la bande, à `debut` secondes, avec un panoramique -1 (gauche) à 1 (droite). */
export const poser = (bande, son, debut, { gain = 1, pan = 0 } = {}) => {
  const i0 = Math.round(debut * bande.taux);
  // Panoramique à puissance constante.
  const angle = ((pan + 1) * Math.PI) / 4;
  const gg = Math.cos(angle) * Math.SQRT2 * gain;
  const gd = Math.sin(angle) * Math.SQRT2 * gain;
  for (let k = 0; k < son.length; k++) {
    const i = i0 + k;
    if (i < 0 || i >= bande.g.length) continue;
    bande.g[i] += son[k] * gg;
    bande.d[i] += son[k] * gd;
  }
};

/** Filtre biquad (RBJ). type : "passe-bande", "passe-bas", "passe-haut". */
export const biquad = (type, frequence, q, taux = TAUX) => {
  const w = (2 * Math.PI * frequence) / taux;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  let b0, b1, b2;
  if (type === "passe-bande") [b0, b1, b2] = [alpha, 0, -alpha];
  else if (type === "passe-bas") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
  else [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + alpha;
  const a1 = -2 * c;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
};

/**
 * Pose d’une tuile sur une table : un choc bref et sec (deux résonances du bois,
 * bruit filtré, décroissance de quelques millisecondes) et un petit corps grave.
 */
export const chocDeTuile = (graine, { clair = 1 } = {}, taux = TAUX) => {
  const alea = hasard(graine);
  const n = Math.round(0.09 * taux);
  const son = new Float32Array(n);
  const f1 = (1700 + alea() * 250) * clair;
  const f2 = (3100 + alea() * 400) * clair;
  const r1 = biquad("passe-bande", f1, 9, taux);
  const r2 = biquad("passe-bande", f2, 7, taux);
  const corps = 210 + alea() * 40;
  for (let k = 0; k < n; k++) {
    const t = k / taux;
    const bruit = alea() * Math.exp(-t / 0.0025);
    const bois = r1(bruit) * 1.0 + r2(bruit) * 0.6;
    const grave = Math.sin(2 * Math.PI * corps * t) * Math.exp(-t / 0.012) * 0.35;
    son[k] = (bois * 2.2 + grave) * Math.min(1, k / 12);
  }
  return son;
};

/**
 * Corde pincée (Karplus-Strong) : la couleur d’une kora ou d’une harpe.
 * `brillance` (0–1) : clarté de l’attaque ; `duree` en secondes.
 */
export const cordePincee = (frequence, duree, graine, { brillance = 0.55, amorti = 0.996 } = {}, taux = TAUX) => {
  const alea = hasard(graine);
  const n = Math.round(duree * taux);
  // Boucle de la corde : un retard d’une période (moins la demi-image du filtre moyenneur),
  // lu avec interpolation fractionnaire pour la justesse. Chaque tour de boucle passe une
  // fois dans le moyenneur (les aigus s’éteignent plus vite) et perd `amorti`.
  const retard = taux / frequence - 0.5;
  const taille = Math.ceil(retard) + 2;
  const tampon = new Float32Array(taille);
  // Excitation : bruit adouci (moins de brillance = attaque plus ronde, comme un pouce),
  // centré pour ne laisser aucune composante continue dans la boucle.
  let prec = 0;
  for (let i = 0; i < taille; i++) {
    prec = prec + brillance * (alea() - prec);
    tampon[i] = prec;
  }
  const moyenne = tampon.reduce((s, v) => s + v, 0) / taille;
  for (let i = 0; i < taille; i++) tampon[i] -= moyenne;
  const mod = (i) => ((i % taille) + taille) % taille;
  const son = new Float32Array(n);
  let ecriture = 0;
  let precLu = 0;
  for (let k = 0; k < n; k++) {
    const pos = ecriture - retard;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    const lu = tampon[mod(i0)] + f * (tampon[mod(i0 + 1)] - tampon[mod(i0)]);
    const y = amorti * 0.5 * (lu + precLu);
    precLu = lu;
    tampon[ecriture] = y;
    ecriture = (ecriture + 1) % taille;
    son[k] = y;
  }
  // Attaque sans clic, fin sans coupure.
  const fin = Math.round(0.05 * taux);
  const attaque = Math.round(0.004 * taux); // 4 ms : une attaque de pouce, pas un clic
  for (let k = 0; k < Math.min(attaque, n); k++) son[k] *= k / attaque;
  for (let k = 0; k < Math.min(fin, n); k++) son[n - 1 - k] *= k / fin;
  return son;
};

/** Impact grave et feutré : une sinusoïde qui descend, un souffle sourd, sans attaque dure. */
export const impactFeutre = (graine, { duree = 1.6, frequence = 62 } = {}, taux = TAUX) => {
  const alea = hasard(graine);
  const n = Math.round(duree * taux);
  const son = new Float32Array(n);
  const sourd = biquad("passe-bas", 380, 0.7, taux);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / taux;
    const f = frequence * (0.72 + 0.28 * Math.exp(-t / 0.18));
    phase += (2 * Math.PI * f) / taux;
    const attaque = Math.min(1, t / 0.008);
    const corps = Math.sin(phase) * Math.exp(-t / 0.55) * attaque;
    const souffle = sourd(alea()) * Math.exp(-t / 0.09) * 1.4;
    son[k] = corps + souffle * attaque;
  }
  return son;
};

/** Petite cloche douce (partiels inharmoniques), pour la signature. */
export const cloche = (frequence, duree, { partiels = [[1, 1, 1.6], [2.76, 0.35, 0.8], [5.4, 0.12, 0.4]] } = {}, taux = TAUX) => {
  const n = Math.round(duree * taux);
  const son = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / taux;
    let v = 0;
    for (const [rapport, amp, dec] of partiels) v += amp * Math.sin(2 * Math.PI * frequence * rapport * t) * Math.exp(-t / dec);
    son[k] = v * Math.min(1, t / 0.004);
  }
  return son;
};

/** Note tenue très douce (bourdon), attaque et relâche lentes. */
export const bourdon = (frequence, duree, { attaque = 1.5, relache = 2 } = {}, taux = TAUX) => {
  const n = Math.round(duree * taux);
  const son = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / taux;
    const env = Math.min(1, t / attaque) * Math.min(1, (duree - t) / relache);
    son[k] = (Math.sin(2 * Math.PI * frequence * t) + 0.25 * Math.sin(4 * Math.PI * frequence * t)) * Math.max(0, env);
  }
  return son;
};

/** Réverbération légère (Schroeder : peignes en parallèle puis passe-tout), en stéréo décorrélée. */
export const reverberation = (bande, { melange = 0.18, taille = 1 } = {}) => {
  const traiter = (entree, decalage) => {
    const peignes = [1557, 1617, 1491, 1422].map((l) => ({ buf: new Float32Array(Math.round((l + decalage) * taille)), i: 0, f: 0 }));
    const passeTout = [556, 441].map((l) => ({ buf: new Float32Array(l + decalage), i: 0 }));
    const sortie = new Float32Array(entree.length);
    for (let k = 0; k < entree.length; k++) {
      const x = entree[k];
      let s = 0;
      for (const p of peignes) {
        const y = p.buf[p.i];
        p.f = y * 0.8 + p.f * 0.2; // amorti des aigus
        p.buf[p.i] = x + p.f * 0.8;
        p.i = (p.i + 1) % p.buf.length;
        s += y;
      }
      s *= 0.25;
      for (const a of passeTout) {
        const y = a.buf[a.i];
        const v = s + y * 0.5;
        a.buf[a.i] = v;
        a.i = (a.i + 1) % a.buf.length;
        s = y - v * 0.5;
      }
      sortie[k] = s;
    }
    return sortie;
  };
  const rg = traiter(bande.g, 0);
  const rd = traiter(bande.d, 23);
  for (let k = 0; k < bande.g.length; k++) {
    bande.g[k] = bande.g[k] * (1 - melange) + rg[k] * melange;
    bande.d[k] = bande.d[k] * (1 - melange) + rd[k] * melange;
  }
};

/** Mélange : bande + autre × gain (même longueur). */
export const ajouter = (bande, autre, gain = 1) => {
  for (let k = 0; k < bande.g.length; k++) {
    bande.g[k] += autre.g[k] * gain;
    bande.d[k] += autre.d[k] * gain;
  }
};

export const gain = (bande, g) => {
  for (let k = 0; k < bande.g.length; k++) {
    bande.g[k] *= g;
    bande.d[k] *= g;
  }
};

/**
 * Limiteur à anticipation : aucun échantillon (ni pic entre échantillons, estimé par
 * suréchantillonnage ×4) au-dessus du plafond. Attaque pendant l’anticipation, relâche douce.
 */
export const limiter = (bande, plafondDb, { anticipation = 0.005, relache = 0.12 } = {}) => {
  const plafond = dB(plafondDb);
  const n = bande.g.length;
  const la = Math.round(anticipation * bande.taux);
  const pic = new Float32Array(n);
  const crete = (x, k) => {
    // Estimation du pic vrai : interpolation cubique (Catmull-Rom) à 4 positions entre k et k+1.
    const p0 = x[Math.max(0, k - 1)], p1 = x[k], p2 = x[Math.min(n - 1, k + 1)], p3 = x[Math.min(n - 1, k + 2)];
    let m = Math.abs(p1);
    for (const t of [0.25, 0.5, 0.75]) {
      const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      m = Math.max(m, Math.abs(v));
    }
    return m;
  };
  for (let k = 0; k < n; k++) pic[k] = Math.max(crete(bande.g, k), crete(bande.d, k));
  // Gain voulu à chaque échantillon : le minimum sur la fenêtre d’anticipation.
  const voulu = new Float32Array(n);
  for (let k = 0; k < n; k++) voulu[k] = pic[k] > plafond ? plafond / pic[k] : 1;
  // 1. Minimum glissant vers l’avant : m[k] = min(voulu[k … k + la]).
  const m = new Float32Array(n);
  for (let k = n - 1; k >= 0; k--) {
    let v = voulu[k];
    for (let j = 1; j <= la && k + j < n; j++) v = Math.min(v, voulu[k + j]);
    m[k] = v;
  }
  // 2. Moyenne sur les la + 1 derniers m : au pic p, tous les termes sont ≤ voulu[p],
  //    donc la moyenne aussi (plafond garanti), et le gain descend en douceur.
  // 3. Relâche : le gain ne remonte que lentement (ce qui ne peut que l’abaisser).
  const coefRelache = Math.exp(-1 / (relache * bande.taux));
  let somme = 0;
  let g = 1;
  let reduitMax = 0;
  for (let k = 0; k < n; k++) {
    somme += m[k];
    if (k > la) somme -= m[k - la - 1];
    // Au tout début (5 ms), la fenêtre est incomplète : on y prend m[k] lui-même.
    const lisse = k < la ? m[k] : somme / (la + 1);
    g = lisse < g ? lisse : lisse + (g - lisse) * coefRelache;
    bande.g[k] *= g;
    bande.d[k] *= g;
    reduitMax = Math.max(reduitMax, -20 * Math.log10(g));
  }
  return reduitMax;
};

/** Fondus d’entrée et de sortie, en secondes. */
export const fondus = (bande, entree, sortie) => {
  const n = bande.g.length;
  const ne = Math.round(entree * bande.taux);
  const ns = Math.round(sortie * bande.taux);
  for (let k = 0; k < n; k++) {
    let f = 1;
    if (k < ne) f = Math.sin((Math.PI / 2) * (k / ne)) ** 2;
    if (k > n - ns) f = Math.min(f, Math.sin((Math.PI / 2) * ((n - k) / ns)) ** 2);
    bande.g[k] *= f;
    bande.d[k] *= f;
  }
};

/** Écrit un WAV PCM 24 bits stéréo. */
export const ecrireWav = async (bande, fichier) => {
  const { writeFileSync } = await import("node:fs");
  const n = bande.g.length;
  const octets = 3;
  const donnees = n * 2 * octets;
  const buf = Buffer.alloc(44 + donnees);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + donnees, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(bande.taux, 24);
  buf.writeUInt32LE(bande.taux * 2 * octets, 28);
  buf.writeUInt16LE(2 * octets, 32);
  buf.writeUInt16LE(octets * 8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(donnees, 40);
  let o = 44;
  for (let k = 0; k < n; k++) {
    for (const v of [bande.g[k], bande.d[k]]) {
      const x = Math.max(-1, Math.min(1, v));
      buf.writeIntLE(Math.round(x * 8388607), o, 3);
      o += 3;
    }
  }
  writeFileSync(fichier, buf);
};
