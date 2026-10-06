# Solver de Climatitzadors en Estiu

Aplicació web lleugera, neta i interactiva per a la resolució i representació psicromètrica de sistemes de climatització en estiu (100% *client-side*, Vanilla JavaScript, HTML5 i CSS3). Desplegable a **GitHub Pages**.

---

## ⚡ Característiques

* **Taula interactiva tipus full de càlcul (Spreadsheet intel·ligent)**:
  * **Entrada lliure de 2 propietats per punt**: Introdueix qualsevol parella de propietats independents a **Ventilació ($V$)** o **Retorn ($R$)** (per exemple $H_{\text{abs}}$ i $\text{HR}$, $T_{\text{seca}}$ i $T_{\text{humida}}$, $T_{\text{seca}}$ i $H_{\text{abs}}$, etc.).
  * **Càlcul i autocompletat en temps real**: En introduir dues dades en una fila, les 5 propietats restants es calculen i omplen a l'instant.
  * **Distinció visual clara**: Les dades font introduïdes per l'usuari es mostren en fons blanc ressaltat, mentre que les dades deduïdes es mostren en blau càlcul amb indicadors d'estat (`[2/2]`, `✓ [w, φ]`) i botó de neteja ràpida (`×`).
  * **Condicions flexibles d'Impulsió ($I$)**: Possibilitat de fixar la humitat relativa ($\varphi_I$, per defecte 90%), la temperatura d'impulsió ($T_I$) o el cabal total ($Q_I$).
* **Taula de potències tèrmiques i cabals**:
  * Balanços de calor sensible i latent ($q_{si}, q_{li}, q_{sv}, q_{lv}, q_{\text{total}}$), amb suport per introduir directament $q_{si}$ i $FCS_i$.
  * Factors de calor sensible ($FCS_i$ i $FCS_t$).
  * Factor de bypass de la bateria ($FBP$) i cabal d'aigua condensada ($\text{kg/h}$).
* **Diagrama Psicromètric autèntic (Carta Carrier / ASHRAE)**:
  * Gràfic vectorial SVG d'alta fidelitat amb corbes de saturació, línies d'humitat relativa ($\varphi = 10\% \dots 90\%$), línies d'entalpia/temperatura humida i línies de volum específic.
  * Traçat automàtic dels processos: línia de mescla $V - R$, refredament a bateria $M - I$, prolongació a superfície $I - S$ i maniobra de sala $I - R$.
  * **Visualització en Pantalla Completa**: Botó dedicat per estudiar el diagrama psicromètric amb el màxim detall.
* **Resolució Pas a Pas (Debugger)**:
  * Pestanya interactiva que permet avançar o retrocedir pas a pas (de l'1 al 7) en la resolució de l'exercici.
  * **Columna Esquerra**: Equacions teòriques en LaTeX (KaTeX) i substitució amb els valors numèrics reals del càlcul en curs.
  * **Columna Dreta**: Diagrama psicromètric sincronitzat que dibuixa únicament els elements calculats fins al pas seleccionat.
* **Botó de cas de referència**:
  * Permet carregar l'exercici clàssic d'exemple per comprovar i verificar els resultats amb 1 sol clic.

---

## 💻 Execució en Local

Obre directament `index.html` amb qualsevol navegador modern, o serveix el directori amb un servidor estàtic:

```bash
python -m http.server 8000
```

---

## 🌐 Desplegament a GitHub Pages

1. A GitHub, ves a **Settings** > **Pages**.
2. A **Build and deployment**, tria la branca `main` i la carpeta `/ (root)`.
3. Guarda els canvis.
