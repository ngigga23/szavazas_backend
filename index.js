const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: '*'
}));
app.use(bodyParser.json({ limit: '50mb' })); // A Base64 képek miatt nagyobb limit kell

// Adatbázis kapcsolat
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // XAMPP alapértelmezett
    password: '',      // XAMPP alapértelmezett
    database: 'autobolt'
});

db.connect((err) => {
    if (err) {
        console.error('Hiba az adatbázis csatlakozásakor:', err);
        return;
    }
    console.log('Sikeres MySQL kapcsolat!');
});

// --- API VÉGPONTOK ---

// 1. Összes autó lekérése
app.get('/api/cars', (req, res) => {
    console.log("asdasd")
    const sql = "SELECT * FROM autok";
    db.query(sql, (err, results) => {
        if (err){
            console.log(err);
            return res.status(500).json(err);
        }
        res.json(results);
    });
});

// 2. Új autó hozzáadása
app.post('/api/cars', (req, res) => {
  const { 
    make, 
    subtitle,
    price, 
    year, 
    km, 
    fuel, 
    gearbox, 
    status, 
    description, 
    img,
    csomagter,
    tomeg,
    hajtas,
    teljesitmeny
  } = req.body;

  const sql = `
    INSERT INTO autok
    (make, subtitle, price, year, km, fuel, gearbox, status, description, img, csomagter, tomeg, hajtas, teljesitmeny)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    make, 
    subtitle,
    price, 
    year, 
    km, 
    fuel, 
    gearbox, 
    status, 
    description, 
    img,
    csomagter,
    tomeg,
    hajtas,
    teljesitmeny
  ], 
    (err, result) => {
      if (err){
        console.log(err);
        return res.status(500).json(err);
      } 
      res.json({ message: "Sikeres mentés" });
    }
  );
});

// --- EZ A HIÁNYZÓ RÉSZ: Autó adatainak módosítása (PUT) ---
app.put('/api/cars/:id', (req, res) => {
    const { id } = req.params;
    const { 
        make, 
        subtitle, 
        price, 
        year, 
        km, 
        fuel, 
        gearbox, 
        status, 
        description, 
        img, 
        csomagter, 
        tomeg, 
        hajtas, 
        teljesitmeny 
    } = req.body;

    const sql = `
        UPDATE autok 
        SET make=?, subtitle=?, price=?, year=?, km=?, fuel=?, gearbox=?, 
            status=?, description=?, img=?, csomagter=?, tomeg=?, hajtas=?, teljesitmeny=? 
        WHERE id=?
    `;

    db.query(sql, [
        make, subtitle, price, year, km, fuel, gearbox, 
        status, description, img, csomagter, tomeg, hajtas, teljesitmeny, id
    ], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json(err);
        }
        res.json({ message: "Sikeres módosítás", id: id });
    });
});

// 3. Autó törlése
app.delete('/api/cars/:id', (req, res) => {
    const sql = "DELETE FROM autok WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Sikeres törlés" });
    });
});

// 4. Bejelentkezés ellenőrzése
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM felhasznalok WHERE email = ? AND jelszo = ?";
    
    db.query(sql, [email, password], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.status(401).json({ success: false, message: "Hibás adatok!" });
        }
    });
});

// Indítás a megadott IP címen
app.listen(PORT, '192.168.12.102' , () => {
    console.log(`Szerver fut: http://192.168.12.102:${PORT}`);
});