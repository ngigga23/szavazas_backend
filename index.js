const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const emailValidator = require('node-email-verifier')

// ---config---

const PORT = 3000
const HOST = 'localhost'
const JWT_SECRET = 'nagyon_nagyon_titkos_egyedi_jelszo'
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'auth_token'


// Cookie beállítás
const COOKIE_OPTS = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, //7 nap
}

//adatbázis beállítás
const db = mysql.createPool({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '',
    database: 'szavazas'

})

//APP
const app = express();

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: '*',
    credentials: true

}))

// -- MIDDLEWARE --
function auth(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        return res.status(409).json({ message: "Hiányzó bementi adat" })
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET)
        next();
    } catch (error) {
        return res.status(410).json({ message: "íJA" })
    }
}


// végpontok
app.post('/regisztracio', auth, async (req, res) => {
    const { email, felhasznalonev, jelszo, admin } = req.body;
    if (!email || !felhasznalonev || !jelszo || !admin) {
        return res.status(400).json({ message: "NEM VALOS EMAILT ADTAL MEG" })
    }

    try {

        const isValid = await emailValidator(email)
        if (!isValid) {
            return res.status(401).json({ message: "nem létező email" })
        }
        const emailFelhasznalonevSQL = 'SELECT * FROM felhasznalok WHERE email = ? OR felhasznalonev = ?'
        const [exists] = await db.query(emailFelhasznalonevSQL, [email, felhasznalonev]);
        if (exists.length) {
            return res.status(402).json({ message: "az email cím vagy felhasználónév már foglalt" })
        }

        const hash = await bcrypt.hash(jelszo, 10);
        const regisztracioSQL = 'INSERT INTO felhasznalok (email, felhasznalonev, jelszo, admin) VALUES (?,?,?,?)'
        const result = await db.query(regisztracioSQL, [email, felhasznalonev, hash, admin])

        //válasz a felhasználónak
        return res.status(300).json({
            message: "Sikeres regisztráció",
            id: result.insertId
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Szerverhiba" })
    }
})

app.post('/belepes', async (req, res) => {
    const { felhasznalonevVagyEmail, jelszo } = req.body;
    if (!felhasznalonevVagyEmail || !jelszo) {
        return res.status(400).json({ message: "hiányos belépési adatok" })
    }

    try {
        const isValid = await emailValidator(felhasznalonevVagyEmail)
        let hashJelszo = "";
        let user = {}
        if (isValid) {
            const sql = 'SELECT * FROM felhasznalok WHERE email = ?'
            const [rows] = await db.query(sql, [felhasznalonevVagyEmail]);
            if (rows.length) {
                user = rows[0];
                hashJelszo = user.jelszo;
            } else {
                return res.status(400).json({ message: "Ezzel a email címmel még nem regisztráltak" })
            }
        }
        else {
            const sql = 'SELECT * FROM felhasznalok WHERE felhasznalonev = ?'
            const [rows] = await db.query(sql, [felhasznalonevVagyEmail]);
            if (rows.length) {
                user = rows[0];
                hashJelszo = user.jelszo;
            } else {
                return res.status(400).json({ message: "Ezzel a felhasználónévvel még nem regisztráltak" })
            }
        }


        const ok = bcrypt.compare(jelszo, hashJelszo)
        if (!ok) {
            return res.status(403).json({ message: "Rossz jelszót adtál meg!" })
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, felhasznalonev: user.felhasznalonev, admin: user.admin },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        )

        res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
        res.status(200).json({ message: "Sikeres belépés" })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "szerverhiba" })
    }
})

// VÉDETT
app.post('/kijelentkezes', async (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(200).json({ message: "Sikeres kijelentkezés" })

})


// VÉDETT
app.get('/adataim', auth, async (req, res) => {
    res.status(200).json(req.user)

})

//VÉDETT
app.put('/email', auth, async (req, res) => {

    const { ujEmail } = req.body;
    if (!ujEmail) {
        return res.status(401).json({ message: "Az új email megadása kötelező!" })
    }
    const isValid = await emailValidator(ujEmail)
    if (!isValid) {
        return res.status(402).json({ message: "Nem megfelelo formatum" })
    }
    try {
        const sql1 = 'SELECT * FROM felhasznalok WHERE email= ?'
        const [result] = await db.query(sql1, [ujEmail]);
        if (result.length) {
            return res.status(403).json({ message: "az email cím már foglalt" })
        }

        const sql2 = 'UPDATE felhasznalok SET email = ? WHERE id = ?'
        await db.query(sql2, [ujEmail, req.user.id]);
        return res.status(200).json({ message: "Sikeresen módosult az email" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "szerverhiba" })
    }
})
app.put('/felhasznalonev', auth, async (req, res) => {

    const { ujFelhasznalonev } = req.body;
    if (!ujFelhasznalonev) {
        return res.status(401).json({ message: "Az új felhasználónév megadása kötelező!" })
    }
    try {
        const sql1 = 'SELECT * FROM felhasznalok WHERE felhasznalonev= ?'
        const [result] = await db.query(sql1, [ujFelhasznalonev]);
        if (result.length) {
            return res.status(403).json({ message: "az email cím már foglalt" })
        }

        const sql2 = 'UPDATE felhasznalok SET felhasznalonev = ? WHERE id = ?'
        await db.query(sql2, [ujFelhasznalonev, req.user.id]);
        return res.status(200).json({ message: "Sikeresen módosult a felhasználónév" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "szerverhiba" })
    }
})

app.delete('/fiokom',auth, async(req,res)=>{
    try {
        const sql = 'DELETE FROM felhasznalok WHERE id=?'
        await db.query(sql,[req.user.id])
        res.clearCookie(COOKIE_NAME, {path: '/'});
        res.status(200).json({message:"Sikeres fióktörlés"})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: "Szerverhiba"})
    }
})

// szerver elindítása
app.listen(PORT, HOST, () => {
    console.log(`API fut: htttps://${HOST}:${PORT}/`)
})