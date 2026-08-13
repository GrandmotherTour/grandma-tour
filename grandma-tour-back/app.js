const express = require("express");
const cors = require("cors");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const recommendationRoutes = require("./features/recommendations/routes");
const regionRouter = require('./features/region/region.route');

const app = express();

app.use(cors());
app.use(express.json());

const verificationCodes = new Map();
const CODE_EXPIRY_MS = 10 * 60 * 1000;

function createMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

app.post('/api/auth/email-verifications', async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    const mailer = createMailer();

    if (!email) return res.status(400).json({ message: '이메일을 입력해 주세요.' });
    if (!mailer) {
      return res.status(503).json({ message: '메일 서비스 설정이 필요합니다. 서버의 SMTP 환경 변수를 확인해 주세요.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    verificationCodes.set(email, { code, expiresAt: Date.now() + CODE_EXPIRY_MS });

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: '[할매투어] 이메일 인증번호',
      text: `할매투어 이메일 인증번호는 ${code}입니다. 10분 안에 입력해 주세요.`,
    });

    return res.json({ message: '인증번호를 이메일로 전송했습니다.' });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/email-verifications/confirm', (req, res) => {
  const { email, code } = req.body ?? {};
  const verification = verificationCodes.get(email);

  if (!verification || verification.expiresAt < Date.now()) {
    verificationCodes.delete(email);
    return res.status(400).json({ message: '인증번호가 없거나 만료되었습니다. 다시 요청해 주세요.' });
  }
  if (verification.code !== code) {
    return res.status(400).json({ message: '인증번호가 일치하지 않습니다.' });
  }

  verificationCodes.delete(email);
  return res.json({ message: '이메일 인증이 완료되었습니다.' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.',
    });
  }

  return res.json({
    user: { name: email.split('@')[0] || 'Traveler', email },
    token: 'local-development-token',
  });
});
app.use('/api/regions', regionRouter);

app.use("/api/recommendations", recommendationRoutes);

app.get("/", (req, res) => {
  res.send("할매투어 백엔드 서버가 정상적으로 작동 중입니다!");
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
    error: err.message,
  });
});

module.exports = app;
