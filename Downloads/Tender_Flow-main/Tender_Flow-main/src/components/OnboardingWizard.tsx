import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, Lock, Fingerprint, Info, ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import type { OnboardingStep } from '../../types';
import logo from '../assets/TenderFlow.png';

interface OnboardingWizardProps {
  step: OnboardingStep;
  email: string;
  isSetupComplete?: boolean;
  onComplete: () => void;
  onStepChange: (step: OnboardingStep) => void;
  onBack: () => void;
}

// --- UNIFIED BUBBLE INPUT COMPONENT ---
const BubbleInput = ({ value, onChange, onComplete, secure = false, disabled = false, statusColor = 'blue' }: any) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!disabled) setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    onChange(val);
    if (val.length === 6 && onComplete) {
      setTimeout(() => onComplete(val), 50); 
    }
  };

  const getStatusClasses = () => {
    if (statusColor === 'emerald') return 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]';
    if (statusColor === 'red') return 'bg-red-600 text-white border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.4)]';
    return 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]';
  };

  return (
    <div className="relative w-full h-16">
      <div className="absolute inset-0 flex justify-center gap-2 md:gap-3 pointer-events-none z-10">
        {[...Array(6)].map((_, i) => (
          <motion.div 
            key={i}
            whileHover={{ scale: 1.05 }}
            className={`w-12 h-14 md:w-14 md:h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-300
              ${value[i] ? `${getStatusClasses()} scale-105` : 'bg-slate-900 text-slate-800 border-slate-800' }
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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ 
  step, 
  email, 
  onComplete, 
  isSetupComplete,
  onStepChange,
  onBack 
}) => {
  const [isVerifiedForReset, setIsVerifiedForReset] = useState(!isSetupComplete);
  const [otpStage, setOtpStage] = useState<'IDLE' | 'SENT'>('IDLE');
  const [resetOtp, setResetOtp] = useState('');

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'TWO_FA_BIND' && !qrCodeUrl) {
      const fetchQR = async () => {
        setIsLoading(true);
        try {
          const res = await fetch('http://localhost:3001/api/vault/setup-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (data.qrCode) {
            setQrCodeUrl(data.qrCode);
            setManualCode(data.manualCode);
          }
        } catch (err) {
          setError("Failed to generate 2FA QR Code.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchQR();
    }
  }, [step, email, qrCodeUrl]);

  // --- ACTIONS ---

  const handleSendResetOtp = async () => {
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
        setOtpStage('SENT');
      } else {
        setError("Failed to send OTP.");
      }
    } catch (e) { setError("Network error."); }
    finally { setIsLoading(false); }
  };

  const handleVerifyResetOtp = async (codeToVerify = resetOtp) => {
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
        setIsVerifiedForReset(true); 
      } else {
        setError("Invalid code.");
        setResetOtp('');
      }
    } catch (e) { setError("Verification failed."); }
    finally { setIsLoading(false); }
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 6 || pin !== confirmPin) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/vault/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      if (!res.ok) throw new Error("Failed to save PIN.");
      
      if (isSetupComplete) {
         onComplete();
      } else {
         onStepChange('TWO_FA_BIND');
      }
    } catch (err) {
      setError("System error saving PIN. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (codeToVerify = totpCode) => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/vault/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userCode: codeToVerify, isSetupMode: true }),
      });
      const data = await res.json();
      if (data.success) onComplete();
      else {
        setError("Invalid code. Please try again.");
        setTotpCode('');
      }
    } catch (err) {
      setError("Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans relative">
      
      {/* LEFT SIDE: VISUALS */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-900/20 via-slate-950 to-slate-950 p-16 flex-col justify-between border-r border-slate-800/50 relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Tender<span className="text-blue-500">Flow</span></h1>
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.2em]">Compliance Vault</p>
            </div>
          </div>

          <div className="space-y-12">
            <h2 className="text-5xl font-extrabold text-white leading-tight">
              {isSetupComplete ? "Update Your" : "Secure Your"} <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-amber-300">
                Digital Identity
              </span>
            </h2>
            
            <div className="space-y-8">
              <div className={`flex items-center gap-4 transition-all duration-500 ${step === 'PIN_SETUP' ? 'scale-105 opacity-100' : 'opacity-40'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${step === 'PIN_SETUP' ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-slate-900 border-slate-800'}`}>
                  <Lock className={`w-6 h-6 ${step === 'PIN_SETUP' ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Master PIN</h4>
                  <p className="text-slate-400 text-sm">{isSetupComplete ? 'Update your access key' : 'Create your 6-digit access key'}</p>
                </div>
              </div>

              {!isSetupComplete && (
                <div className={`flex items-center gap-4 transition-all duration-500 ${step === 'TWO_FA_BIND' ? 'scale-105 opacity-100' : 'opacity-40'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${step === 'TWO_FA_BIND' ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-800'}`}>
                    <Fingerprint className={`w-6 h-6 ${step === 'TWO_FA_BIND' ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">2FA Link</h4>
                    <p className="text-slate-400 text-sm">Biometric or App-based security</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 p-8 bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-2">
            <Info className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-bold text-[10px] tracking-widest uppercase">Encryption Standard</span>
          </div>
          <p className="text-slate-400 text-sm italic leading-relaxed">
            "Your vault uses end-to-end hashing and multi-factor validation, ensuring industrial secrets remain private under the 2026 Compliance Act."
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: INTERACTIVE SETUP */}
      <div className="w-full md:w-1/2 flex flex-col p-8 bg-slate-950 relative overflow-y-auto scrollbar-hide">
        
        <button 
          onClick={onBack} 
          className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-white transition-colors z-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-widest">{isSetupComplete ? 'Cancel Update' : 'Back to Login'}</span>
        </button>

        {/* TOP SPACER FOR PERFECT CENTERING */}
        <div className="flex-grow"></div>

        <div className="w-full max-w-md mx-auto relative z-10 shrink-0 py-8">
          <AnimatePresence mode="wait">
            
            {step === 'PIN_SETUP' && !isVerifiedForReset && (
               <motion.div 
                 key="otp-guard"
                 initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                 className="space-y-8"
               >
                 <div className="text-center">
                   <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                   <h3 className="text-3xl font-bold text-white mb-2">Security Verification</h3>
                   <p className="text-slate-500">Verify your identity to change the Master PIN.</p>
                 </div>

                 {otpStage === 'IDLE' ? (
                   <button 
                     onClick={handleSendResetOtp} 
                     disabled={isLoading}
                     className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl disabled:opacity-50"
                   >
                     {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Send Verification Code"}
                   </button>
                 ) : (
                   <div className="space-y-6 text-center">
                      <BubbleInput value={resetOtp} onChange={setResetOtp} onComplete={handleVerifyResetOtp} secure={false} disabled={isLoading} />
                      <button onClick={handleSendResetOtp} disabled={isLoading} className="flex items-center justify-center gap-2 w-full text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Resend Code
                      </button>
                   </div>
                 )}
               </motion.div>
            )}

            {step === 'PIN_SETUP' && isVerifiedForReset && (
              <motion.div 
                key="pin-setup"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">{isSetupComplete ? 'Set New Master PIN' : 'Create Master PIN'}</h3>
                  <p className="text-slate-500">Enter a 6-digit code for physical device access.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center">New PIN</span>
                    <BubbleInput value={pin} onChange={setPin} secure={true} disabled={isLoading} />
                  </div>

                  <div className="space-y-4 pt-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center">Confirm PIN</span>
                    <BubbleInput 
                      value={confirmPin} 
                      onChange={setConfirmPin} 
                      secure={true} 
                      disabled={isLoading} 
                      statusColor={confirmPin.length === 6 ? (pin === confirmPin ? 'emerald' : 'red') : 'blue'}
                    />
                  </div>
                </div>

                <button 
                  onClick={handlePinSubmit} 
                  disabled={isLoading || pin.length !== 6 || pin !== confirmPin}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 relative z-30"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Save Master PIN"}
                </button>
              </motion.div>
            )}

            {step === 'TWO_FA_BIND' && (
              <motion.div 
                key="2fa-setup"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">Link 2FA</h3>
                  <p className="text-slate-500">Scan this QR with your Authenticator app.</p>
                </div>

                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-6">
                    {qrCodeUrl ? <img src={qrCodeUrl} alt="QR" className="w-44 h-44" /> : <div className="w-44 h-44 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}
                  </div>
                  {manualCode && <p className="text-[10px] text-slate-500 font-mono tracking-widest bg-slate-900 px-4 py-2 rounded-full border border-slate-800">{manualCode}</p>}
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center">Enter 6-Digit App Code</span>
                  <BubbleInput value={totpCode} onChange={setTotpCode} onComplete={handle2FAVerify} secure={false} disabled={isLoading} statusColor={totpCode.length === 6 ? 'emerald' : 'blue'} />
                </div>

                <button 
                  onClick={() => handle2FAVerify(totpCode)} 
                  disabled={isLoading || totpCode.length !== 6}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all relative z-30"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <>Verify & Finish <CheckCircle className="w-5 h-5" /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center rounded-2xl flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
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