const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const fs = require('fs');

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Terputus. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startSock();
        } else if (connection === 'open') {
            console.log('✅ Bot terhubung ke WhatsApp!');
            listenFirebase(sock); // Mulai pantau Firebase setelah terhubung
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify' && messages[0]?.message) {
            const msg = messages[0];
            const sender = msg.key.remoteJid;
            const text = msg.message.conversation;

            console.log(`📩 Pesan masuk dari ${sender}: ${text}`);

            if (text?.toLowerCase() === 'hai') {
                await sock.sendMessage(sender, { text: 'Halo dari ESP8266 👋' });
            }

            // ✅ Fitur test manual
            if (text?.toLowerCase() === 'test') {
                const notif = "🔔 Ini adalah notifikasi TEST manual dari bot.";
                await sock.sendMessage(sender, { text: notif });
                console.log("📤 Notifikasi manual terkirim:", notif);
            }
        }
    });
}

function listenFirebase(sock) {
    if (!admin.apps.length) {
        const serviceAccount = require('./iot-k2-smartlight-firebase-adminsdk-fbsvc-23a63690f7.json');

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://iot-k2-smartlight-default-rtdb.asia-southeast1.firebasedatabase.app'
        });
    }

    const db = admin.database();
    const statusRef = db.ref('status_lampu');
    let lastStatus = null;

    statusRef.on('value', async (snapshot) => {
        const status = snapshot.val();
        if (status !== lastStatus) {
            lastStatus = status;
            const pesan = status === "true" || status === true
                ? "💡 Lampu sekarang: NYALA"
                : "❌ Lampu sekarang: MATI";

            const target = '6281232001104@s.whatsapp.net'; // Ganti ke no kamu
            await sock.sendMessage(target, { text: pesan });
            console.log("📤 Notifikasi otomatis terkirim:", pesan);
        }
    });
}

startSock();
