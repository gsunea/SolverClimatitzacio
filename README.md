# Solver de Climatitzadors en Estiu

Aplicació web lleugera, neta i interactiva per a la resolució i representació psicromètrica de sistemes de climatització en estiu (100% *client-side*, Vanilla JavaScript, HTML5 i CSS3). Desplegable a **GitHub Pages**.

---

## ⚡ Característiques

* **Taula interactiva tipus full de càlcul**:
  * Introdueix directament a les cel·les blanques les dades de partida que tinguis (temperatures, humitats, cabal de ventilació o potències interiors).
  * Detecció dinàmica de dades suficients per calcular.
  * Resolució automàtica i omplert de totes les propietats termodinàmiques dels 5 estats: **Ventilació ($V$)**, **Retorn ($R$)**, **Mescla ($M$)**, **Impulsió ($I$)** i **Superfície de Bateria ($S$)**.
* **Taula de potències tèrmiques i cabals**:
  * Balanços de calor sensible i latent ($q_{si}, q_{li}, q_{sv}, q_{lv}, q_{\text{total}}$).
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
