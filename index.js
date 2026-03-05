const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'autobolt_titkos_kulcs_2024';

// Middleware
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Adatbázis kapcsolat
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'autobolt',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('MySQL pool létrehozva!');

// ─── JWT MIDDLEWARE ───────────────────────────────────────────────────────────
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token szükséges!' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Érvénytelen token!' });
        req.user = decoded;
        next();
    });
}

function verifyAdmin(req, res, next) {
    if (!req.user.admin) {
        return res.status(403).json({ success: false, message: 'Csak admin férhet hozzá!' });
    }
    next();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  FELHASZNÁLÓ VÉGPONTOK
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/users/register  – Regisztráció
// Body: { nev, email, password }
app.post('/api/users/register', async (req, res) => {
    const { nev, email, password } = req.body;

    if (!nev || !email || !password) {
        return res.status(400).json({ success: false, message: 'Név, email és jelszó megadása kötelező!' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'A jelszónak legalább 6 karakter hosszúnak kell lennie!' });
    }

    db.query('SELECT id FROM felhasznalok WHERE email = ? OR felhasznalonev = ?', [email, nev], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (results.length > 0) {
            return res.status(409).json({ success: false, message: 'Ez az email cím vagy felhasználónév már foglalt!' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.query(
                'INSERT INTO felhasznalok (felhasznalonev, email, jelszo, admin) VALUES (?, ?, ?, 0)',
                [nev, email, hashedPassword],
                (err, result) => {
                    if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
                    res.status(201).json({ success: true, message: 'Sikeres regisztráció!', id: result.insertId });
                }
            );
        } catch (e) {
            res.status(500).json({ success: false, message: 'Szerver hiba!' });
        }
    });
});

// POST /api/users/login  – Bejelentkezés
// Body: { email, password }
// Visszaad egy JWT tokent
app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email és jelszó megadása kötelező!' });
    }

    db.query('SELECT * FROM felhasznalok WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Hibás email vagy jelszó!' });
        }

        const user = results[0];

        try {
            const match = await bcrypt.compare(password, user.jelszo);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Hibás email vagy jelszó!' });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, felhasznalonev: user.felhasznalonev, admin: user.admin },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                message: 'Sikeres bejelentkezés!',
                token,
                user: { id: user.id, felhasznalonev: user.felhasznalonev, email: user.email, admin: user.admin }
            });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Szerver hiba!' });
        }
    });
});

// GET /api/me  – Saját profil (token alapján)
// Header: Authorization: Bearer <token>
app.get('/api/me', verifyToken, (req, res) => {
    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok WHERE id = ?', [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Nem található!' });
        res.json({ success: true, user: results[0] });
    });
});

// GET /api/users  – Összes felhasználó (csak admin)
// Header: Authorization: Bearer <token>
app.get('/api/users', verifyToken, verifyAdmin, (req, res) => {
    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        res.json({ success: true, users: results });
    });
});

// GET /api/users/:id  – Egy felhasználó (admin vagy saját maga)
// Header: Authorization: Bearer <token>
app.get('/api/users/:id', verifyToken, (req, res) => {
    const targetId = parseInt(req.params.id);

    if (req.user.id !== targetId && !req.user.admin) {
        return res.status(403).json({ success: false, message: 'Nincs jogosultságod!' });
    }

    db.query('SELECT id, felhasznalonev, email, admin FROM felhasznalok WHERE id = ?', [targetId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Felhasználó nem található!' });
        res.json({ success: true, user: results[0] });
    });
});

// PUT /api/users/:id  – Felhasználó módosítása (admin vagy saját maga)
// Header: Authorization: Bearer <token>
// Body: { nev?, email?, password? }
app.put('/api/users/:id', verifyToken, async (req, res) => {
    const targetId = parseInt(req.params.id);

    if (req.user.id !== targetId && !req.user.admin) {
        return res.status(403).json({ success: false, message: 'Nincs jogosultságod!' });
    }

    const { nev, email, password } = req.body;
    const fields = [];
    const values = [];

    if (nev)   { fields.push('felhasznalonev = ?'); values.push(nev); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'A jelszónak legalább 6 karakter hosszúnak kell lennie!' });
        }
        const hashed = await bcrypt.hash(password, 10);
        fields.push('jelszo = ?');
        values.push(hashed);
    }

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Nincs módosítandó adat!' });
    }

    values.push(targetId);
    db.query(`UPDATE felhasznalok SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Adatbázis hiba!', error: err });
        res.json({ success: true, message: 'Sikeres módosítás!' });
    });
});

// DELETE /api/users/:id  – Felhasználó törlése (csak admin)
// Header: Authorization: Bearer <token>
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

// GET /api/cars
app.get('/api/cars', (req, res) => {
    db.query('SELECT * FROM autok', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// GET /api/cars/:id
app.get('/api/cars/:id', (req, res) => {
    db.query('SELECT * FROM autok WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length === 0) return res.status(404).json({ message: 'Nem található' });
        res.json(results[0]);
    });
});

// POST /api/cars  – Csak bejelentkezett felhasználó
app.post('/api/cars', (req, res) => {
    const { make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny } = req.body;
    const sql = `INSERT INTO autok (make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres mentés' });
    });
});

// PUT /api/cars/:id  – Csak bejelentkezett felhasználó
app.put('/api/cars/:id', (req, res) => {
    const { make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny } = req.body;
    const sql = `UPDATE autok SET make=?, subtitle=?, price=?, year=?, km=?, fuel=?, gearbox=?, status=?, description=?, img=?, csomagter=?, tomeg=?, hajtas=?, teljesitmeny=? WHERE id=?`;
    db.query(sql, [make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres módosítás' });
    });
});

// DELETE /api/cars/:id  – Csak admin
app.delete('/api/cars/:id', (req, res) => {
    db.query('DELETE FROM autok WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Sikeres törlés' });
    });
});


// ─── Indítás ──────────────────────────────────────────────────────────────────
app.listen(PORT,  () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});