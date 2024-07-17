const express = require("express");
const cors = require('cors');
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const cron = require("node-cron");

require("dotenv").config();

const app = express();  
const port = 3000;

const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));

const serviceAccount = {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_CERT_URL,
    universe_domain: process.env.UNIVERSE_DOMAIN
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `${process.env.DB_URL}`
});

const db = admin.database();
const customersRef = db.ref("customers");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.get("/", (req, res) => {
    res.send("Hello, this is the SMTP server.");
});


app.post("/sendReminder",(req,res)=>{
    const {customer}=req.body;

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: `${process.env.MY_MAIL}`,
            pass: `${process.env.MY_PASSWORD}`
        }
    });

    const appointmentTime = new Date(customer.date).getTime();
    const currentTime = new Date().getTime();
    const timeDiff = appointmentTime - currentTime;
    const minutesLeft = Math.floor(timeDiff / (1000 * 60));

    const mailOptions = {
        from: `${process.env.MY_MAIL}`,
        to: customer.email, 
        subject: "Randevu Hatırlatma",
        text: `Merhaba ${customer.name},\n\nRandevunuz için 1 saatten az zaman kaldı. Lütfen zamanında gelmeyi unutmayın.\n Kalan zaman:${minutesLeft} dakika.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("E-posta gönderilirken hata oluştu:", error);
        } else {
            console.log("E-posta başarıyla gönderildi:", info.response);
        }
    });

})

app.post("/send", (req, res) => {
    const {  mail, subject, text} = req.body;

    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: `${process.env.MY_MAIL}`,
            pass: `${process.env.MY_PASSWORD}`
        }
    });

    let mailOptions = {
        from: `${process.env.MY_MAIL}`,
        to: mail,
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.status(500).send("E-posta gönderilirken bir hata oluştu.");
        } else {
            console.log("E-posta gönderildi: " + info.response);
            res.status(200).send("E-posta başarıyla gönderildi.");
        }
    });
});

app.post("/sendDailyCustomers",(req,res)=>{
    sendDailyCustomerList();
});

function sendDailyCustomerList() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    customersRef.once("value", (snapshot) => {
        const customerList = [];
        snapshot.forEach((childSnapshot) => {
            const customer = childSnapshot.val();
            const appointmentDate = new Date(customer.date);

            if (appointmentDate >= today && appointmentDate < tomorrow) {
                customerList.push(customer);
            }
        });

        // Randevu saatlerine göre sıralama
        customerList.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (customerList.length > 0) {
            sendDailyEmail(customerList);
        }
    });
}

function sendDailyEmail(customerList) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: `${process.env.MY_MAIL}`,
            pass: `${process.env.MY_PASSWORD}`
        }
    });

    const customerDetails = customerList.map(customer => {
        const appointmentDate = new Date(customer.date);
        // Saatleri 24 saat formatında gösterme
        const hours = String(appointmentDate.getHours()).padStart(2, '0');
        const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
        return `${customer.name} - ${hours}:${minutes}`;
    }).join('\n');

    const mailOptions = {
        from: `${process.env.MY_MAIL}`,
        to: `${process.env.MY_MAIL}`,
        subject: "Günün Müşteri Listesi",
        text: `Bugün gelecek müşteriler:\n\n${customerDetails}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("Günlük müşteri listesi gönderilirken hata oluştu:", error);
        } else {
            console.log("Günlük müşteri listesi başarıyla gönderildi:", info.response);
        }
    });
}


function sendReminderEmail(customer) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: `${process.env.MY_MAIL}`,
            pass: `${process.env.MY_PASSWORD}`
        }
    });

    const appointmentTime = new Date(customer.date).getTime();
    const currentTime = new Date().getTime();
    const timeDiff = appointmentTime - currentTime;
    const minutesLeft = Math.floor(timeDiff / (1000 * 60));

    const mailOptions = {
        from: `${process.env.MY_MAIL}`,
        to: customer.email, 
        subject: "Randevu Hatırlatma",
        text: `Merhaba ${customer.name},\n\nRandevunuz için 1 saatten az zaman kaldı. Lütfen zamanında gelmeyi unutmayın.\n Kalan zaman:${minutesLeft} dakika.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("E-posta gönderilirken hata oluştu:", error);
        } else {
            console.log("E-posta başarıyla gönderildi:", info.response);
        }
    });
}


app.listen(port, () => {
    console.log(`SMTP server is running at http://localhost:${port}`);
});
