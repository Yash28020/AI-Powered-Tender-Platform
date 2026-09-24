import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, ArrowRight, Info, CheckCircle2, RefreshCw, ArrowLeft, Lock, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserData } from '../../types';
import logo from '../assets/TenderFlow.png';

interface SignInScreenProps {
  onAuthSuccess: (userData: UserData) => void;
  initialEmail?: string; 
}

// --- UNIFIED BUBBLE INPUT COMPONENT ---
const BubbleInput = ({ value, onChange, onComplete, secure = false, disabled = false }: any) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!disabled) setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    onChange(val);
    if (val.length === 6 && onComplete) {
      setTimeout(() => onComplete(val), 50); // Delay allows the final bubble to render before processing
    }
  };

  return (
    <div className="relative w-full h-20">
      <div className="absolute inset-0 flex justify-center gap-2 md:gap-3 pointer-events-none z-10">
        {[...Array(6)].map((_, i) => (
          <motion.div 
            key={i}
            whileHover={{ scale: 1.05 }}
            className={`w-12 h-14 md:w-14 md:h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-300
              ${value[i] 
                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' 
                : 'bg-slate-900 text-slate-800 border-slate-800' }
              border-2 border-dashed border-opacity-50`}
          >
            {value[i] ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>{secure ? '•' : value[i]}</motion.span> : ''}
          </motion.div>
        ))}
      </div>
      <input 
        ref={inputRef} 
        type="tel" 
        maxLength={6} 
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`absolute inset-0 w-full h-full opacity-0 z-20 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      />
    </div>
  );
};

export const SignInScreen: React.FC<SignInScreenProps> = ({ onAuthSuccess, initialEmail }) => {
  const [email, setEmail] = useState(initialEmail || '');
  
  const [mode, setMode] = useState<'EMAIL_ENTRY' | 'PIN_ENTRY' | 'OTP_ENTRY' | 'TWO_FA_ENTRY' | 'RESET_PIN_ENTRY'>(
    initialEmail ? 'PIN_ENTRY' : 'EMAIL_ENTRY'
  );
  
  const [otpPurpose, setOtpPurpose] = useState<'NEW_USER' | 'FORGOT_PIN'>('NEW_USER');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  
  // Reset PIN State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [tempNewPin, setTempNewPin] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- ACTIONS ---
  const handleEmailSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.exists) {
        setMode('PIN_ENTRY');
      } else {
        await fetch('http://localhost:3001/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        setOtpPurpose('NEW_USER');
        setMode('OTP_ENTRY');
      }
    } catch (err) { setError("Connection failed. Check backend."); } 
    finally { setIsLoading(false); }
  };

  const handleForgotPin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setOtpPurpose('FORGOT_PIN');
        setOtp('');
        setMode('OTP_ENTRY');
      } else {
        setError(data.message || "Failed to send recovery code.");
      }
    } catch (err) { setError("Network error. Cannot send OTP."); } 
    finally { setIsLoading(false); }
  };

  const handleOtpSubmit = async (codeToVerify = otp) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: codeToVerify }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (otpPurpose === 'FORGOT_PIN') {
           setMode('RESET_PIN_ENTRY');
           setResetStep(1);
           setPin('');
        } else {
           onAuthSuccess({ email, is_setup_complete: data.is_setup_complete, has_pin: data.has_pin });
        }
      } else {
        setError("Invalid code.");
        setOtp('');
      }
    } catch (err) { setError("Verification failed."); } 
    finally { setIsLoading(false); }
  };

  const handlePinLogin = async (codeToVerify = pin) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/vault/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: codeToVerify, mode: 'PIN' }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.requires2FA) {
           setMode('TWO_FA_ENTRY');
           setTwoFaCode('');
        } else {
           onAuthSuccess({ email, is_setup_complete: true, has_pin: true });
        }
      } else { 
        setError("Incorrect PIN."); 
        setPin(''); 
      }
    } catch (err) { setError("Login failed."); setPin(''); } 
    finally { setIsLoading(false); }
  };

  const handleTwoFaSubmit = async (codeToVerify = twoFaCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/vault/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userCode: codeToVerify, isSetupMode: false }),
      });
      const data = await res.json();
      
      if (data.success) {
        onAuthSuccess({ email, is_setup_complete: true, has_pin: true });
      } else {
        setError("Invalid Authenticator Code.");
        setTwoFaCode('');
      }
    } catch (err) { setError("Verification failed."); setTwoFaCode(''); } 
    finally { setIsLoading(false); }
  };

  const handleResetPinSubmit = async (codeToVerify = pin) => {
    if (resetStep === 1) {
      setTempNewPin(codeToVerify);
      setPin('');
      setResetStep(2);
      return;
    }
    
    if (codeToVerify !== tempNewPin) {
      setError("PINs do not match. Please try again.");
      setPin('');
      setTempNewPin('');
      setResetStep(1);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/vault/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: codeToVerify }),
      });
      const data = await res.json();
      
      if (data.success) {
         onAuthSuccess({ email, is_setup_complete: true, has_pin: true });
      } else {
         setError(data.error || "Failed to reset PIN.");
      }
    } catch (err) { setError("Network error resetting PIN."); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans relative">
      
      {/* LEFT HALF */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-900/20 via-slate-950 to-slate-950 p-16 flex-col justify-between border-r border-slate-800/50 relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <img src={logo} alt="TenderFlow Logo" className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Tender<span className="text-blue-500">Flow</span></h1>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Industrial Systems</p>
            </div>
          </div>
          
          <div className="space-y-8 max-w-lg">
            <h2 className="text-5xl font-extrabold text-white leading-[1.1]">
              Intelligent <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-amber-300">
                Compliance Vault
              </span>
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 text-slate-300">
                <CheckCircle2 className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <p className="text-lg">AI-powered technical matching for government tenders and RFPs.</p>
              </div>
              <div className="flex items-start gap-4 text-slate-300">
                <CheckCircle2 className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <p className="text-lg">Automated financial risk auditing and compliance document management.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 p-8 bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-3">
            <Info className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-bold text-sm tracking-widest uppercase">The Vision</span>
          </div>
          <p className="text-slate-400 leading-relaxed italic">
            "Eliminating manual overhead in tender processing by bridging the gap between complex industrial specifications and digital compliance automation."
          </p>
        </div>
      </div>

      {/* RIGHT HALF */}
      <div className="w-full md:w-1/2 flex flex-col p-8 bg-slate-950 relative overflow-y-auto scrollbar-hide">
        
        {/* TOP SPACER FOR PERFECT CENTERING */}
        <div className="flex-grow"></div>

        <div className="w-full max-w-md mx-auto relative z-10 shrink-0 py-8">
          <AnimatePresence mode="wait">
            
            {/* STAGE 1: EMAIL */}
            {mode === 'EMAIL_ENTRY' && (
              <motion.div 
                key="email"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2">Initialize Session</h3>
                  <p className="text-slate-500">Access your secure workspace via identity verification.</p>
                </div>

                <div className="w-full flex justify-center py-2">
                  <GoogleLogin
                    onSuccess={async (cred) => {
                      const res = await fetch('http://localhost:3001/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: cred.credential }),
                      });
                      const data = await res.json();
                      onAuthSuccess(data);
                    }}
                  />
                </div>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-slate-600 text-xs font-bold uppercase tracking-widest">or email access</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Organization Email"
                      className="w-full bg-slate-900 border border-slate-800 text-white pl-12 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-700"
                    />
                  </div>
                  <button 
                    onClick={handleEmailSubmit} disabled={isLoading || !email}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
                  >
                    Proceed <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 2: PIN ENTRY */}
            {mode === 'PIN_ENTRY' && (
              <motion.div 
                key="pin"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center text-center space-y-8 w-full"
              >
                <div className="relative w-full flex flex-col items-center">
                  <button 
                    onClick={() => setMode('EMAIL_ENTRY')} 
                    className="absolute -top-10 left-0 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" /> Switch Account
                  </button>
                  <Lock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-3xl font-bold text-white mb-2">Master PIN</h3>
                  <p className="text-slate-500">Identity confirmed for <span className="text-blue-400">{email}</span></p>
                </div>

                <div className="w-full flex justify-center">
                  <BubbleInput value={pin} onChange={setPin} onComplete={handlePinLogin} secure={true} disabled={isLoading} />
                </div>

                <div className="pt-4 w-full">
                  <button onClick={handleForgotPin} disabled={isLoading} className="text-slate-500 text-sm hover:text-amber-400 transition-colors disabled:opacity-50">
                    {isLoading ? "Sending Recovery Code..." : "Forgotten your PIN?"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 3: 2FA ENTRY */}
            {mode === 'TWO_FA_ENTRY' && (
              <motion.div 
                key="2fa"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-8"
              >
                <div>
                  <Fingerprint className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-3xl font-bold text-white mb-2">2FA Required</h3>
                  <p className="text-slate-500">Enter the 6-digit code from your Authenticator app.</p>
                </div>

                <BubbleInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleTwoFaSubmit} secure={false} disabled={isLoading} />
              </motion.div>
            )}

            {/* STAGE 4: OTP ENTRY */}
            {mode === 'OTP_ENTRY' && (
              <motion.div 
                key="otp"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-8"
              >
                <div>
                  <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-3xl font-bold text-white mb-2">Verification</h3>
                  <p className="text-slate-500">Code sent to <span className="text-blue-400">{email}</span></p>
                </div>

                <BubbleInput value={otp} onChange={setOtp} onComplete={handleOtpSubmit} secure={false} disabled={isLoading} />

                <div className="pt-4">
                  <button onClick={handleForgotPin} disabled={isLoading} className="flex items-center justify-center gap-2 w-full text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Resend Code
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 5: RESET PIN */}
            {mode === 'RESET_PIN_ENTRY' && (
              <motion.div 
                key="reset"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-8"
              >
                <div>
                  <Lock className={`w-12 h-12 mx-auto mb-4 ${resetStep === 1 ? 'text-blue-500' : 'text-emerald-500'}`} />
                  <h3 className="text-3xl font-bold text-white mb-2">Reset Master PIN</h3>
                  <p className="text-slate-500">{resetStep === 1 ? "Enter your new 6-digit access key." : "Verify your new access key."}</p>
                </div>

                <BubbleInput value={pin} onChange={setPin} onComplete={handleResetPinSubmit} secure={true} disabled={isLoading} />
              </motion.div>
            )}

          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center rounded-2xl"
            >
              {error}
            </motion.div>
          )}
        </div>

        {/* BOTTOM SPACER FOR PERFECT CENTERING */}
        <div className="flex-grow"></div>

        {/* FOOTER */}
        <footer className="w-full flex justify-center items-center pointer-events-none shrink-0 pb-2">
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 px-6 py-2 rounded-full shadow-2xl">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 tracking-[0.2em] uppercase">
              System developed by <span className="text-blue-400 font-bold">Ansh Pratap Singh</span>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
};