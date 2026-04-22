require('dotenv').config()

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN

// ✅ Cookie beállítás
const COOKIE_NAME = 'auth_token';
const COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

// --- Middleware ---
app.use(cors({ 
  origin: function(origin, callback) {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Adatbázis ---
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('MySQL pool létrehozva!');

// ─── MULTER ────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ─── JWT MIDDLEWARE ────────────────────────────────────────────────────────
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    if (!token && req.cookies && req.cookies[COOKIE_NAME]) {
        token = req.cookies[COOKIE_NAME];
    }
    
    if (!token) return res.status(401).json({ success: false, message: 'Token szükséges!' });
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Érvénytelen token!' });
        req.user = decoded;
        next();
    });
}

function verifyAdmin(req, res, next) {
    if (!req.user.admin) return res.status(403).json({ success: false, message: 'Csak admin férhet hozzá!' });
    next();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KÉP VÉGPONTOK
// ═══════════════════════════════════════════════════════════════════════════════

// ✅ MÓDOSÍTOTT: Csak filename mentése
app.post('/api/upload', upload.single('kep'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nincs feltöltött fájl!' });
    }
    // ✅ Csak a filename megy vissza!
    res.json({ success: true, filename: req.file.filename });
});

app.get('/api/images', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = await fs.readdir(uploadsDir);
        const images = files
            .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
            .map(f => ({
                filename: f
            }));
        res.json({ success: true, images });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Nem sikerült olvasni a képeket!' });
    }
});

app.delete('/api/upload/:filename', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'uploads', req.params.filename);
        await fs.unlink(filePath);
        res.json({ success: true, message: 'Kép törölve!' });
    } catch (err) {
        res.status(404).json({ success: false, message: 'Kép nem található!' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FELHASZNÁLÓ VÉGPONTOK
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/users/register', async (req, res) => {
    const { nev, email, password } = req.body;
    if (!nev || !email || !password) return res.status(400).json({ success: false, message: 'Név, email és jelszó megadása kötelező!' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'A jelszónak legalább 6 karakter hosszúnak kell lennie!' });

    db.query('SELECT id FROM felhasznalok WHERE email = ? OR felhasznalonev = ?', [email, nev], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (results.length > 0) return res.status(409).json({ success: false, message: 'Ez az email cím vagy felhasználónév már foglalt!' });
        try {
            const hashedPassword = await bcryptjs.hash(password, 10);
            db.query('INSERT INTO felhasznalok (felhasznalonev, email, jelszo, admin) VALUES (?, ?, ?, 0)', [nev, email, hashedPassword], (err, result) => {
                if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
                res.status(201).json({ success: true, message: 'Sikeres regisztráció!', id: result.insertId });
            });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Szerver hiba!' });
        }
    });
});

app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email és jelszó megadása kötelező!' });

    db.query('SELECT * FROM felhasznalok WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (results.length === 0) return res.status(401).json({ success: false, message: 'Hibás email vagy jelszó!' });
        const user = results[0];
        try {
            const match = await bcryptjs.compare(password, user.jelszo);
            if (!match) return res.status(401).json({ success: false, message: 'Hibás email vagy jelszó!' });
            const token = jwt.sign({ id: user.id, email: user.email, felhasznalonev: user.felhasznalonev, admin: user.admin }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            
            res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
            
            res.json({ 
                success: true, 
                message: 'Sikeres bejelentkezés!', 
                user: { 
                    id: user.id, 
                    felhasznalonev: user.felhasznalonev, 
                    email: user.email, 
                    admin: user.admin 
                } 
            });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Szerver hiba!' });
        }
    });
});

// ✅ JAVÍTOTT: Logout - COOKIE_OPTS-al törlés
app.post('/api/users/logout', verifyToken, (req, res) => {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    res.status(200).json({ success: true, message: 'Sikeres kijelentkezés!' });
});

app.get('/api/me', verifyToken, (req, res) => {
    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok WHERE id = ?', [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Nem található!' });
        res.json({ success: true, user: results[0] });
    });
});

app.get('/api/users', verifyToken, verifyAdmin, (req, res) => {
    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        res.json({ success: true, users: results });
    });
});

app.get('/api/users/:id', verifyToken, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && !req.user.admin) return res.status(403).json({ success: false, message: 'Nincs jogosultságod!' });
    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok WHERE id = ?', [targetId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Felhasználó nem található!' });
        res.json({ success: true, user: results[0] });
    });
});

app.put('/api/users/:id', verifyToken, async (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.id !== targetId && !req.user.admin) return res.status(403).json({ success: false, message: 'Nincs jogosultságod!' });
    const { nev, email, password } = req.body;
    const fields = [], values = [];
    if (nev)   { fields.push('felhasznalonev = ?'); values.push(nev); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (password) {
        if (password.length < 6) return res.status(400).json({ success: false, message: 'A jelszónak legalább 6 karakter hosszúnak kell lennie!' });
        const hashed = await bcryptjs.hash(password, 10);
        fields.push('jelszo = ?'); values.push(hashed);
    }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Nincs módosítandó adat!' });
    values.push(targetId);
    db.query(`UPDATE felhasznalok SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        res.json({ success: true, message: 'Sikeres módosítás!' });
    });
});

app.delete('/api/users/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query('DELETE FROM felhasznalok WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Felhasználó nem található!' });
        res.json({ success: true, message: 'Felhasználó törölve!' });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTÓ VÉGPONTOK
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/cars', (req, res) => {
    db.query('SELECT * FROM autok', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.get('/api/cars/:id', (req, res) => {
    db.query('SELECT * FROM autok WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length === 0) return res.status(404).json({ message: 'Nem található' });
        res.json(results[0]);
    });
});

app.post('/api/cars', verifyToken, verifyAdmin, (req, res) => {
    const { make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny } = req.body;
    const sql = `INSERT INTO autok (make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres mentés' });
    });
});

app.put('/api/cars/:id', verifyToken, verifyAdmin, (req, res) => {
    const { make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny } = req.body;
    const sql = `UPDATE autok SET make=?, subtitle=?, price=?, year=?, km=?, fuel=?, gearbox=?, status=?, description=?, img=?, csomagter=?, tomeg=?, hajtas=?, teljesitmeny=? WHERE id=?`;
    db.query(sql, [make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres módosítás' });
    });
});

app.delete('/api/cars/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query('DELETE FROM autok WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres törlés' });
    });
});

// ─── Indítás ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});