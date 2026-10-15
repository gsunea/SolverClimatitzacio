# Solver de Climatitzadors en Estiu

Aplicació web lleugera, neta i interactiva per a la resolució i representació psicromètrica de sistemes de climatització en estiu, feta amb JavaScript, HTML5 i CSS3. Desplegable a **GitHub Pages**.

---
### Taula d'estats

- Per als punts de **Ventilació (V)** i **Retorn (R)** només cal entrar dues propietats qualssevol que siguin independents (per exemple T seca i HR, T seca i T humida, T seca i humitat absoluta...). Les altres cinc es calculen soles en el moment.
- Els valors que entra l'usuari es veuen amb text negre i els calculats en text blau, així es distingeix fàcilment què és dada i què és resultat. Cada fila té un petit indicador de quantes dades hi ha posades i un botó `×` per esborrar-la.
- Per a la **Impulsió (I)** es pot fixar la humitat relativa (per defecte 90%), la temperatura d'impulsió o el cabal total, segons el que doni l'enunciat.

### Potències i cabals

- Calcula les càrregues sensibles i latents ($q_{si}$, $q_{li}$, $q_{sv}$, $q_{lv}$) i la total. També es pot entrar directament $q_{si}$ i el $FCS_i$.
- Factors de calor sensible ($FCS_i$ i $FCS_t$).
- Factor de bypass de la bateria i cabal d'aigua condensada (kg/h).

### Diagrama psicromètric

- El diagrama està fet en SVG seguint l'estil de la carta Carrier / ASHRAE: corba de saturació, línies d'HR del 10% al 90%, entalpia / temperatura humida i volum específic.
- Es dibuixen automàticament els processos: mescla V–R, refredament a la bateria M–I, la prolongació fins a la temperatura de superfície I–S i la recta de la sala I–R.
- Hi ha un botó per veure'l a pantalla completa, que va bé per mirar-lo amb més detall.

### Resolució pas a pas

- Hi ha una pestanya on es pot anar endavant i enrere pels 7 passos de la resolució.
- A l'esquerra surten les equacions (amb KaTeX) i la substitució amb els números del cas que s'està calculant.
- A la dreta hi ha el diagrama, que només mostra el que s'ha calculat fins a aquell pas.

### Cas de referència

Hi ha un botó que carrega l'exercici d'exemple de classe, per poder comprovar que els resultats surten bé.

## Com executar-ho en local

N'hi ha prou amb obrir `index.html` amb el navegador. Si dona problemes, es pot aixecar un servidor local des de la carpeta:

```bash
python -m http.server 8000
```

i obrir `http://localhost:8000`.

## Versió online

Com que només és HTML, CSS i JS, està penjat a GitHub Pages i es pot fer servir sense descarregar res:

https://gsunea.github.io/SolverClimatitzacio