# AUTOBOLT
## A projektről
> Az Autobolt egy olyan autókereskedés, amely új és használt járművek széles választékát kínálja. Az oldalon a látogatók könnyen böngészhetnek különböző márkák és modellek között, legyen szó megbízható használt autóról vagy a legújabb, modern felszereltségű járművekről. A részletes leírások és átlátható keresési lehetőségek segítik a gyors döntést, miközben a kedvező árak és rugalmas ajánlatok minden vásárló számára vonzóvá teszik a kínálatot. Az Autobolt célja, hogy egyszerűvé és biztonságossá tegye az autóvásárlás folyamatát.
---
## Fejlesztési környezet
- **Node.js**
- **MySQL**
---
## Adatbázis
- felhasznalok
  - id
  - email
  - felhasznalonev
  - jelszo
  - admin
- autok
  - id
  - make
  - price
  - year
  - km
  - fuel
  - gearbox
  - status
  - description
  - img
  - subtitle
  - csomagter
  - tomeg
  - hajtas
  - teljesitmeny
    <br/>
    <br/>
  <img width="403" height="831" alt="image" src="https://github.com/user-attachments/assets/5182ceda-328b-42c7-9d45-570799f4532b" />
  <br/>
> <a href="https://drawsql.app/teams/team-5190/diagrams/autoboltt">Adatbázis diagram</a>
---

## Backend
A backend Node.js alapú, Express keretrendszerrel és MySQL adatbázissal működik. Feladata kommunikációs hidat létesíteni a frontend és az adatbázis között. A szerver kezeli a felhasználók hitelesítését, az autók adatait, valamint a képfeltöltéseket.
#### Telepítés és futtatás
```bash
git clone https://github.com/faat1455/autobolt_backend.git
cd autobolt_backend
npm install
npm run dev
```
---
## Mappa struktúra
- autobolt_backend/
  - uploads/ -> Feltöltött képek tárolója
  - index.js -> Az alkalmazás belépési pontja (összes végpont és middleware)
  - autobolt.sql -> Adatbázis struktúra
  - .env -> Környezeti változók (DB kapcsolat, JWT titok)
  - .gitignore -> Nem követett fájlok (pl. .env, node_modules)
  - package.json -> Használt csomagok és függőségek
  - package-lock.json -> Függőségek pontos verziói
  - README.md -> Dokumentáció
---

## Használt packagek
- **[bcryptjs](https://www.npmjs.com/package/bcryptjs)**
- **[cookie-parser](https://www.npmjs.com/package/cookie-parser)**
- **[cors](https://www.npmjs.com/package/cors)**
- **[dotenv](https://www.npmjs.com/package/dotenv)**
- **[express](https://www.npmjs.com/package/express)**
- **[jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)**
- **[multer](https://www.npmjs.com/package/multer)**
- **[mysql2](https://www.npmjs.com/package/mysql2)**
- **[body-parser](https://www.npmjs.com/package/body-parser)**
- **[nodemon](https://www.npmjs.com/package/nodemon)** *(devDependency)*
```bash
"dependencies": {
    "bcryptjs": "^2.4.3",
    "body-parser": "^1.20.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.11.4"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
  ```
---
## Biztonság

- JWT token alapú hitelesítés
- Jelszavak bcryptjs segítségével vannak hashelve
- Middleware szinten történik az authentikáció (`verifyToken`, `verifyAdmin`)
- A `.env` fájl tartalmaz minden érzékeny adatot – ne oszd meg publikusan!
---
## Végpontok

Az `index.js` kezeli az összes végpontot és middleware-t, közlekedési csomópontként igazgatva a kéréseket.

```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Képek
app.post('/api/upload', ...)
app.get('/api/images', ...)
app.delete('/api/upload/:filename', ...)

// Felhasználók
app.post('/api/users/register', ...)
app.post('/api/users/login', ...)
app.post('/api/users/logout', ...)
app.get('/api/me', ...)
app.get('/api/users', ...)
app.get('/api/users/:id', ...)
app.put('/api/users/:id', ...)
app.delete('/api/users/:id', ...)

// Autók
app.get('/api/cars', ...)
app.get('/api/cars/:id', ...)
app.post('/api/cars', ...)
app.put('/api/cars/:id', ...)
app.delete('/api/cars/:id', ...)
```
`index.js`
---
### Kép végpontok

| Művelet | HTTP | Végpont | Leírás |
|---|---|---|---|
| Kép feltöltése | ![POST](https://img.shields.io/badge/POST-49cc90?style=flat-square) | /api/upload | Új kép feltöltése |
| Képek lekérése | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/images | Az összes feltöltött kép listázása |
| Kép törlése | ![DELETE](https://img.shields.io/badge/DELETE-f93e3e?style=flat-square) | /api/upload/:filename | Egy adott kép törlése fájlnév alapján |

```javascript
app.post('/api/upload', upload.single('kep'), ...);
app.get('/api/images', ...);
app.delete('/api/upload/:filename', ...);
```
`index.js`

---

### Felhasználó végpontok

| Művelet | HTTP | Végpont | Leírás |
|---|---|---|---|
| Regisztráció | ![POST](https://img.shields.io/badge/POST-49cc90?style=flat-square) | /api/users/register | Új felhasználó regisztrálása |
| Bejelentkezés | ![POST](https://img.shields.io/badge/POST-49cc90?style=flat-square) | /api/users/login | Felhasználó bejelentkezése |
| Kijelentkezés | ![POST](https://img.shields.io/badge/POST-49cc90?style=flat-square) | /api/users/logout | Felhasználó kijelentkezése (hitelesítés szükséges) |
| Saját profil lekérése | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/me | A bejelentkezett felhasználó adatainak lekérése |
| Összes felhasználó | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/users | Az összes felhasználó listázása (csak admin) |
| Egy felhasználó lekérése | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/users/:id | Egy adott felhasználó adatainak lekérése |
| Felhasználó szerkesztése | ![PUT](https://img.shields.io/badge/PUT-fca130?style=flat-square) | /api/users/:id | Felhasználó adatainak módosítása |
| Felhasználó törlése | ![DELETE](https://img.shields.io/badge/DELETE-f93e3e?style=flat-square) | /api/users/:id | Felhasználó törlése (csak admin) |

```javascript
app.post('/api/users/register', ...);
app.post('/api/users/login', ...);
app.post('/api/users/logout', verifyToken, ...);
app.get('/api/me', verifyToken, ...);
app.get('/api/users', verifyToken, verifyAdmin, ...);
app.get('/api/users/:id', verifyToken, ...);
app.put('/api/users/:id', verifyToken, ...);
app.delete('/api/users/:id', verifyToken, verifyAdmin, ...);
```
`index.js`

---

### Autó végpontok

| Művelet | HTTP | Végpont | Leírás |
|---|---|---|---|
| Összes autó lekérése | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/cars | Az összes autó listázása |
| Egy autó lekérése | ![GET](https://img.shields.io/badge/GET-61affe?style=flat-square) | /api/cars/:id | Egy adott autó adatainak lekérése ID alapján |
| Autó hozzáadása | ![POST](https://img.shields.io/badge/POST-49cc90?style=flat-square) | /api/cars | Új autó felvitele (csak admin) |
| Autó szerkesztése | ![PUT](https://img.shields.io/badge/PUT-fca130?style=flat-square) | /api/cars/:id | Autó adatainak módosítása (csak admin) |
| Autó törlése | ![DELETE](https://img.shields.io/badge/DELETE-f93e3e?style=flat-square) | /api/cars/:id | Autó törlése (csak admin) |

```javascript
app.get('/api/cars', ...);
app.get('/api/cars/:id', ...);
app.post('/api/cars', verifyToken, verifyAdmin, ...);
app.put('/api/cars/:id', verifyToken, verifyAdmin, ...);
app.delete('/api/cars/:id', verifyToken, verifyAdmin, ...);
```
`index.js`

---
## Frontend

- **[Github Repo](https://github.com/faat1455/autobolt)**
- **[Éló oldal](https://autobolt10.netlify.app/)**

---
## Használt eszközök

- **[VS Code](https://code.visualstudio.com/)**
- **[NPM](https://www.npmjs.com/)**
- **[Postman](https://www.postman.com/)**
- **[DrawSQL](https://drawsql.app/)**
- **[W3Schools](https://www.w3schools.com/)**
- **[ChatGPT](https://chatgpt.com/)**
- **[Claude](https://claude.ai/)**
- **[Gemini](https://gemini.google.com/)**
- **[GitHub](https://github.com/)**
- **[PhpMyAdmin](https://www.phpmyadmin.net/)**
