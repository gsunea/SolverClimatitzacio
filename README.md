# Solucionador de Climatitzadors en Estiu (ETSEIB - UPC)

Aplicació web interactiva (100% *client-side*, Vanilla JavaScript, HTML5 i CSS3) per a la resolució, anàlisi i representació psicromètrica d'exercicis de **climatització en règim d'estiu** de l'assignatura *Climatització i Refrigeració* (ETSEIB - UPC, segons la formulació del professor Rafael Ruiz).

Hostatjable de forma directa i gratuïta a **GitHub Pages**.

---

## 🚀 Característiques Principals

1. **Taula Tipus Pissarra de Classe**:
   - Calcula i omple automàticament els 5 estats clau:
     - **Ventilació ($V$)**
     - **Retorn ($R$)**
     - **Mescla ($M$)**
     - **Impulsió ($I$)**
     - **Superfície de Bateria ($S$)**
   - Variables psicromètriques completes per a cada estat:
     - Temperatura seca ($T$, $^\circ\text{C}$)
     - Humitat relativa ($\varphi$, $\%$)
     - Humitat absoluta ($w$, $\text{g/kg a.s.}$)
     - Volum específic ($v$, $\text{m}^3/\text{kg a.s.}$)
     - Entalpia específica ($h$, $\text{kJ/kg a.s.}$)
     - Temperatura de rosada ($T_r$, $^\circ\text{C}$)
     - Temperatura humida ($T_h$, $^\circ\text{C}$)
     - Cabals volumètrics ($Q$, $\text{m}^3/\text{h}$) i mèsics ($\dot{m}$, $\text{kg a.s./s}$)

2. **Panell de Balanços Tèrmics i Mètriques**:
   - Càrregues interiors: $q_{si}$, $q_{li}$, $q_i$, $FCS_i$.
   - Càrregues de ventilació: $q_{sv}$, $q_{lv}$, $q_v$.
   - Càrregues totals del sistema: $q_s$, $q_l$, $q_{tot}$, $FCS_t$.
   - Potència frigorífica de la bateria de fred: $q_{\text{bat}}$.
   - Factor de Bypass ($FBP$) i cabal d'aigua condensada a la bateria ($\text{kg/h}$ i $\text{g/s}$).
   - Pressió atmosfèrica corregida per altitud ($Z$).

3. **Diagrama Psicromètric Dinàmic (Plotly.js)**:
   - Dibuix de corbes de saturació ($\varphi = 100\%$) i humitats relatives $\varphi \in [10\%, 90\%]$.
   - Línies d'entalpia constant.
   - Procés de mescla $V - R$ i localització del punt $M$.
   - Procés de bateria $M - I$ i prolongació fins al punt de superfície $S$.
   - Procés d'absorció de càrregues interiors $I - R$ amb el pendent del factor de calor sensible interior $FCS_i$.
   - Tooltips interactius amb totes les propietats termodinàmiques en passar el cursor.

4. **Presets d'Exemples de Classe**:
   - Botó per carregar amb 1 clic l'**Exemple 1 de la pissarra** ($q_{si}=20\text{ kW}, q_{li}=3\text{ kW}, Q_v=1000\text{ m}^3/\text{h}, 31^\circ\text{C}/70\%, 24^\circ\text{C}/50\%, \varphi_I=90\%$).
   - Exemple d'alta humitat estival (litoral).
   - Exemple de clima interior moderat.

---

## 🛠️ Arquitectura i Estructura del Projecte

```text
├── index.html          # Interfície d'usuari i contenidors
├── css/
│   └── styles.css      # Estils moderns d'enginyeria, responsive
├── js/
│   ├── psychrolib.js   # Llibreria psicromètrica oficial ASHRAE (SI)
│   ├── solver.js       # Motor de resolució termodinàmica i balanços
│   ├── chart.js        # Generador del diagrama psicromètric amb Plotly.js
│   └── app.js          # Controlador d'events DOM i reactivitat
├── README.md           # Aquest document
└── plan.md             # Especificació tècnica detallada
```

---

## 💻 Com Executar en Local

Com que és una aplicació 100% estàtica (HTML5 + CSS + JavaScript Vanilla):

1. Clona el repositori:
   ```bash
   git clone https://github.com/gsunea/SolverClimatitzacio.git
   ```
2. Obre directament el fitxer `index.html` amb qualsevol navegador web modern (Chrome, Firefox, Safari, Edge).
3. Opcionalment, pots aixecar un servidor estàtic local:
   ```bash
   python -m http.server 8000
   ```
   I accedir a `http://localhost:8000`.

---

## 🌐 Com Desplegar a GitHub Pages

1. Ves al teu repositori a GitHub: `https://github.com/gsunea/SolverClimatitzacio`.
2. Accedeix a **Settings** > **Pages** (menú lateral esquerre).
3. A la secció **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` i carpeta `/ (root)`
4. Fes clic a **Save**.
5. En uns instants, l'aplicació estarà disponible públicament a:
   `https://gsunea.github.io/SolverClimatitzacio/`

---

## 📐 Fonamentació Teòrica i Equacions (Tema 3 i 5 dels Apunts)

* **Pressió de saturació ($P_{ws}$)**: Equació de formulació d'aire humit ASHRAE.
* **Humitat absoluta ($w$)**: $w = 0.621945 \cdot \frac{P_w}{P - P_w}$.
* **Entalpia específica ($h$)**: $h = 1.006 \cdot T + w \cdot (2501 + 1.86 \cdot T)$.
* **Recta de maniobra de la sala**: $\frac{w_R - w_I}{T_R - T_I} = \frac{1 - FCS_i}{FCS_i} \cdot \frac{c_{pas}}{\Delta h_{lg}}$.
* **Punt de bateria ($S$)**: Intersecció de la recta $M - I$ prolongada amb la corba de saturació ($\varphi = 100\%$).
* **Factor de Bypass ($FBP$)**: $FBP = \frac{h_I - h_S}{h_M - h_S} \approx \frac{T_I - T_S}{T_M - T_S}$.
