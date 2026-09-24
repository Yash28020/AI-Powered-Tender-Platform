import { Request, Response } from 'express';
import { query } from './db';
import { OAuth2Client } from 'google-auth-library';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer'; 

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SALT_ROUNDS = 10;

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});

// Helper to normalize email and prevent case-sensitivity bugs
const normalizeEmail = (e?: string) => e?.trim().toLowerCase();

// 1. LOGIN
export const login = async (req: Request, res: Response) => {
  const { token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email); // Normalized

    if (!email) return res.status(400).json({ error: "Invalid Google Token" });

    console.log(`[AUTH] Attempting login for: ${email}`);

    let result = await query("SELECT * FROM vault_access WHERE recovery_email = $1", [email]);
    
    if (result.rows.length === 0) {
      console.log(`[AUTH] New user detected. Registering...`);
      await query("INSERT INTO vault_access (recovery_email, is_setup_complete) VALUES ($1, false)", [email]);
      result = await query("SELECT * FROM vault_access WHERE recovery_email = $1", [email]);
    }

    const user = result.rows[0];
    const isActuallyComplete = user.is_setup_complete || (!!user.pin_hash && user.is_2fa_enabled);

    res.json({
      email: user.recovery_email,
      is_setup_complete: isActuallyComplete,
      has_pin: !!user.pin_hash
    });
  } catch (err: any) {
    console.error("🔥 LOGIN ERROR:", err.message);
    res.status(500).json({ error: "Login failed", details: err.message });
  }
};

// 2. SETUP PIN (FIXED: Silent DB Failure Removed)
export const setupPin = async (req: Request, res: Response) => {
  const { email, pin } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const pinStr = String(pin);
  
  if (!pinStr || pinStr.length !== 6) return res.status(400).json({ error: "Invalid PIN format" });

  try {
    const hashedPin = await bcrypt.hash(pinStr, SALT_ROUNDS);
    
    const update = await query(
      "UPDATE vault_access SET pin_hash = $1 WHERE recovery_email = $2", 
      [hashedPin, normalizedEmail]
    );
    
    // THE FIX: Actually verify the DB row was updated
    if (update.rowCount === 0) {
      return res.status(404).json({ error: "Account not found in database. Cannot save PIN." });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("PIN Setup Error:", err);
    res.status(500).json({ error: "Failed to set PIN" });
  }
};

// 3. VERIFY VAULT ACCESS (PIN & RECOVERY MODES)
export const verifyVaultAccess = async (req: Request, res: Response) => {
  const { pin, googleToken, mode, email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (mode === 'PIN') {
    try {
      const result = await query("SELECT * FROM vault_access WHERE recovery_email = $1", [normalizedEmail]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Account not found." });

      const user = result.rows[0];
      const pinStr = String(pin); 
      const isMatch = await bcrypt.compare(pinStr, user.pin_hash);
      
      if (isMatch) {
        if (user.is_2fa_enabled) {
          return res.json({ success: true, requires2FA: true, message: "2FA Required" });
        }
        return res.json({ success: true, token: "session_token_approved" });
      }
      return res.status(401).json({ error: "Invalid PIN." });
    } catch (err) {
      return res.status(500).json({ error: "Verification failed." });
    }
  }

  if (mode === 'RECOVERY') {
    try {
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (normalizeEmail(payload?.email) === normalizedEmail) {
        return res.json({ 
          success: true, 
          message: "Identity confirmed via Google. You may now reset your PIN." 
        });
      }
      return res.status(403).json({ error: "Google account does not match registered recovery email." });
    } catch (err) {
      return res.status(403).json({ error: "Google authentication failed." });
    }
  }
};

// 4. SETUP 2FA
export const setup2FA = async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  try {
    const secret = speakeasy.generateSecret({ name: `TenderFlow (${normalizedEmail})` });
    const update = await query("UPDATE vault_access SET two_fa_secret = $1 WHERE recovery_email = $2", [secret.base32, normalizedEmail]);
    if (update.rowCount === 0) return res.status(404).json({ error: "Account not found." });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    res.json({ qrCode: qrCodeUrl, manualCode: secret.base32 });
  } catch (err) {
    res.status(500).json({ error: "2FA setup failed." });
  }
};

// 5. CHECK EMAIL
export const checkEmail = async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  try {
    const result = await query("SELECT id FROM vault_access WHERE recovery_email = $1", [normalizedEmail]);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

// 6. SEND OTP 
export const sendAuthOtp = async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  try {
    const checkUser = await query("SELECT id FROM vault_access WHERE recovery_email = $1", [normalizedEmail]);
    
    if (checkUser.rows.length > 0) {
      await query("UPDATE vault_access SET reset_token = $1, reset_token_expiry = $2 WHERE recovery_email = $3", [otp, expiry, normalizedEmail]);
    } else {
      await query("INSERT INTO vault_access (recovery_email, reset_token, reset_token_expiry, is_setup_complete) VALUES ($1, $2, $3, false)", [normalizedEmail, otp, expiry]);
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail({
        from: `"TenderFlow Security" <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: "Your TenderFlow Verification Code",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Verification Code</h2>
            <p>Your OTP is:</p>
            <h1 style="font-size: 32px; letter-spacing: 5px; color: #000;">${otp}</h1>
            <p>This code expires in 10 minutes.</p>
          </div>
        `
      });
      console.log(`[AUTH] ✅ Email successfully sent to ${normalizedEmail}`);
    } else {
      console.warn(`[AUTH] ⚠️ Missing EMAIL_USER/PASS. Check .env file.`);
    }

    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

// 7. VERIFY OTP
export const verifyAuthOtp = async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const { otp } = req.body;
  try {
    const result = await query("SELECT * FROM vault_access WHERE recovery_email = $1", [normalizedEmail]);
    if (result.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = result.rows[0];
    if (user.reset_token === otp && new Date(user.reset_token_expiry) > new Date()) {
      await query("UPDATE vault_access SET reset_token = NULL, reset_token_expiry = NULL WHERE id = $1", [user.id]);
      res.json({ success: true, is_setup_complete: user.is_setup_complete, has_pin: !!user.pin_hash });
    } else {
      res.status(400).json({ error: "Invalid or expired OTP" });
    }
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
};

// 8. VERIFY 2FA
export const verify2FA = async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const { userCode, isSetupMode } = req.body;
  try {
    const result = await query("SELECT two_fa_secret FROM vault_access WHERE recovery_email = $1", [normalizedEmail]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Account not found." });

    const verified = speakeasy.totp.verify({
      secret: result.rows[0].two_fa_secret,
      encoding: 'base32',
      token: userCode,
      window: 1 
    });
    
    if (verified) {
      if (isSetupMode) {
        await query("UPDATE vault_access SET is_2fa_enabled = true, is_setup_complete = true WHERE recovery_email = $1", [normalizedEmail]);
      } else {
        await query("UPDATE vault_access SET is_2fa_enabled = true WHERE recovery_email = $1", [normalizedEmail]);
      }
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Invalid Code" });
    }
  } catch (err) {
    res.status(500).json({ error: "2FA error" });
  }
};